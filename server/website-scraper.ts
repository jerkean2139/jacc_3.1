import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { generateChatResponse } from './openai';

interface ScrapedContent {
  title: string;
  content: string;
  markdownContent: string;
  summary: string;
  bulletPoints: string[];
  sourceUrl: string;
  scrapedAt: string;
  wordCount: number;
}

class WebsiteScrapingService {
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: 'atx',
      hr: '---',
      bulletListMarker: '-',
      codeBlockStyle: 'fenced'
    });

    // Configure turndown to handle common elements
    this.turndownService.addRule('removeStyles', {
      filter: ['style', 'script', 'noscript'],
      replacement: () => ''
    });

    this.turndownService.addRule('cleanLinks', {
      filter: 'a',
      replacement: (content: string, node: any) => {
        const href = node.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
          return content;
        }
        return `[${content}](${href})`;
      }
    });
  }

  async scrapeWebsite(url: string): Promise<ScrapedContent> {
    console.log('🌐 Starting website scraping for:', url);
    
    // Validate URL format
    try {
      const parsedUrl = new URL(url);
      console.log('✅ URL validation passed:', parsedUrl.hostname);
    } catch (urlError) {
      console.error('❌ URL validation failed:', urlError);
      throw new Error(`Invalid URL format: ${url}`);
    }
    
    // Skip Puppeteer and use HTTP-only approach for better reliability
    try {
      console.log('🚀 Using HTTP-only scraping approach...');
      return await this.fallbackScrape(url);
    } catch (httpError: any) {
      console.error('❌ HTTP scraping failed, attempting Puppeteer fallback:', httpError);
      
      // Only try Puppeteer as last resort
      let browser;
      try {
        console.log('🔄 Attempting Puppeteer as fallback...');
        browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        });
        console.log('✅ Browser launched successfully');

        const page = await browser.newPage();
        
        // Set user agent to avoid blocking
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Navigate to the URL with timeout
        console.log('🌐 Navigating to URL...');
        await page.goto(url, { 
          waitUntil: 'networkidle2', 
          timeout: 30000 
        });
        console.log('✅ Page loaded successfully');

        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Extract HTML content
        console.log('📄 Extracting page content...');
        const html = await page.content();
        console.log('✅ HTML content extracted, length:', html.length);

        // Extract title
        const title = await page.title();
        console.log('✅ Page title extracted:', title);

        // Parse with Cheerio for content extraction
        const $ = cheerio.load(html);
        
        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, .sidebar, #sidebar, .menu, #menu').remove();
        
        // Extract main content
        let textContent = '';
        const contentSelectors = ['main', 'article', '.content', '#content', '.main', '#main', 'body'];
        
        for (const selector of contentSelectors) {
          const element = $(selector);
          if (element.length > 0 && element.text().trim().length > 200) {
            textContent = element.text().trim();
            console.log(`✅ Content extracted using selector: ${selector}`);
            break;
          }
        }
        
        // Fallback to body if no main content found
        if (!textContent) {
          textContent = $('body').text().trim();
          console.log('✅ Fallback to body content extraction');
        }

        // Clean up text content
        textContent = textContent
          .replace(/\s+/g, ' ')
          .replace(/\n+/g, '\n')
          .trim();

        console.log('✅ Text content cleaned, length:', textContent.length);

        // Convert to markdown
        const bodyHtml = $('body').html() || '';
        const markdownContent = this.turndownService.turndown(bodyHtml);
        console.log('✅ Markdown conversion completed');

        // Calculate word count
        const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;

        // Generate summary and bullet points using AI
        console.log('🤖 Generating AI summary and bullet points...');
        const { summary, bulletPoints } = await this.generateSummaryAndBulletPoints(textContent, title, url);
        console.log('✅ AI summary generated successfully');

        await browser.close();
        console.log('🎉 Puppeteer scraping completed successfully');

        const result = {
          title,
          content: textContent,
          markdownContent,
          summary,
          bulletPoints,
          sourceUrl: url,
          scrapedAt: new Date().toISOString(),
          wordCount
        };

        console.log('📊 Scraping results:', {
          title: result.title.substring(0, 50) + '...',
          contentLength: result.content.length,
          markdownLength: result.markdownContent.length,
          wordCount: result.wordCount,
          bulletPointsCount: result.bulletPoints.length
        });

        return result;

      } catch (error: any) {
        if (browser) {
          await browser.close();
        }
        
        console.error('❌ Website scraping failed:', error);
        console.error('❌ Error details:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        });
        
        // Fallback to simple HTTP request if Puppeteer fails
        try {
          console.log('🔄 Attempting fallback scraping method...');
          return await this.fallbackScrape(url);
        } catch (fallbackError: any) {
          console.error('❌ Fallback scraping also failed:', fallbackError);
          throw new Error(`Website scraping failed: ${error.message}. Fallback also failed: ${fallbackError.message}`);
        }
      }
    }
  }

  private async fallbackScrape(url: string): Promise<ScrapedContent> {
    console.log('🔄 Using fallback HTTP scraping method for:', url);
    
    try {
      const axios = await import('axios');
      
      const response = await axios.default.get(url, {
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      console.log('✅ HTTP request successful, response length:', response.data.length);

      // Parse with Cheerio
      const $ = cheerio.load(response.data);
      
      // Extract title
      const title = $('title').text().trim() || 'Untitled Document';
      console.log('✅ Title extracted:', title);

      // Remove unwanted elements
      $('script, style, nav, header, footer, aside, .sidebar, #sidebar, .menu, #menu').remove();
      
      // Extract main content
      let textContent = '';
      const contentSelectors = ['main', 'article', '.content', '#content', '.main', '#main', 'body'];
      
      for (const selector of contentSelectors) {
        const element = $(selector);
        if (element.length > 0 && element.text().trim().length > 200) {
          textContent = element.text().trim();
          console.log(`✅ Content extracted using selector: ${selector}`);
          break;
        }
      }
      
      // Fallback to body if no main content found
      if (!textContent) {
        textContent = $('body').text().trim();
        console.log('✅ Fallback to body content extraction');
      }

      // Clean up text content
      textContent = textContent
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, '\n')
        .trim();

      console.log('✅ Text content cleaned, length:', textContent.length);

      // Convert to markdown
      const bodyHtml = $('body').html() || '';
      const markdownContent = this.turndownService.turndown(bodyHtml);
      console.log('✅ Markdown conversion completed');

      // Calculate word count
      const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;

      // Generate summary and bullet points using AI
      console.log('🤖 Generating AI summary and bullet points...');
      const { summary, bulletPoints } = await this.generateSummaryAndBulletPoints(textContent, title, url);
      console.log('✅ AI summary generated successfully');

      const result = {
        title,
        content: textContent,
        markdownContent,
        summary,
        bulletPoints,
        sourceUrl: url,
        scrapedAt: new Date().toISOString(),
        wordCount
      };

      console.log('📊 HTTP scraping results:', {
        title: result.title.substring(0, 50) + '...',
        contentLength: result.content.length,
        markdownLength: result.markdownContent.length,
        wordCount: result.wordCount,
        bulletPointsCount: result.bulletPoints.length
      });

      return result;

    } catch (error: any) {
      console.error('❌ HTTP scraping failed:', error);
      throw new Error(`HTTP scraping failed: ${error.message}`);
    }
  }

  private async generateSummaryAndBulletPoints(content: string, title: string, url: string): Promise<{summary: string, bulletPoints: string[]}> {
    try {
      const prompt = `Please analyze the following web content and provide:
1. A concise summary (2-3 sentences)
2. 3-5 key bullet points highlighting the most important information

Content Title: ${title}
Source URL: ${url}
Content: ${content.substring(0, 3000)}

Please respond in this exact JSON format:
{
  "summary": "Your summary here",
  "bulletPoints": ["Point 1", "Point 2", "Point 3"]
}`;

      const aiResponse = await generateChatResponse(prompt);
      
      try {
        const parsed = JSON.parse(aiResponse);
        if (parsed.summary && Array.isArray(parsed.bulletPoints)) {
          return {
            summary: parsed.summary,
            bulletPoints: parsed.bulletPoints
          };
        }
      } catch (parseError) {
        console.log('Failed to parse AI response as JSON, using fallback');
      }

      // Fallback response
      return {
        summary: `Content extracted from ${title}. This document contains information scraped from the provided URL and has been processed for AI search and retrieval.`,
        bulletPoints: [
          'Web content extracted and converted to markdown format',
          'Content processed for semantic search capabilities',
          'Contains relevant information for merchant services'
        ]
      };
    } catch (error) {
      console.error('Failed to generate AI summary:', error);
      return {
        summary: `Content extracted from ${title}. This document contains information scraped from the provided URL.`,
        bulletPoints: [
          'Web content extracted and converted to markdown format',
          'Content available for search and reference',
          'Processed for search and AI retrieval'
        ]
      };
    }
  }
}

export const websiteScrapingService = new WebsiteScrapingService();
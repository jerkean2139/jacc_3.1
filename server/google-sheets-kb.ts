// MEMORY OPTIMIZATION: Disabled googleapis (123MB)
// import { google } from 'googleapis';
const google: any = null;
import { db } from './db';
import { faqKnowledgeBase, googleSheetsSyncConfig, googleSheetsSyncLog } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface SheetRow {
  question: string;
  answer: string;
  category?: string;
  tags?: string;
  priority?: number;
  isActive?: boolean;
  rowId: string;
}

export class GoogleSheetsKBService {
  private sheets: any;
  private auth: any;

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    try {
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        let keyString = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
        const credentials = JSON.parse(keyString);
        
        // Fix private key formatting
        if (credentials.private_key) {
          credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
        }
        
        this.auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
        
        this.sheets = google.sheets({ version: 'v4', auth: this.auth });
        console.log('Google Sheets KB service initialized successfully');
      } else {
        console.log('No Google Sheets credentials found. Google Sheets sync will be disabled.');
      }
    } catch (error) {
      console.error('Failed to initialize Google Sheets KB service:', error);
    }
  }

  // Get sync configuration
  async getSyncConfig(): Promise<any> {
    const configs = await db.select().from(googleSheetsSyncConfig).where(eq(googleSheetsSyncConfig.syncEnabled, true));
    return configs[0];
  }

  // Column letter to index (A=0, B=1, etc.)
  private columnToIndex(column: string): number {
    let index = 0;
    for (let i = 0; i < column.length; i++) {
      index = index * 26 + column.charCodeAt(i) - 'A'.charCodeAt(0) + 1;
    }
    return index - 1;
  }

  // Read data from Google Sheets
  async readSheetData(spreadsheetId: string, config: any): Promise<SheetRow[]> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const range = `${config.sheetName || 'Sheet1'}!A${config.headerRow + 1}:Z1000`;
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const rows = response.data.values || [];
      const sheetData: SheetRow[] = [];

      // Get column indices
      const questionIdx = this.columnToIndex(config.questionColumn || 'A');
      const answerIdx = this.columnToIndex(config.answerColumn || 'B');
      const categoryIdx = config.categoryColumn ? this.columnToIndex(config.categoryColumn) : null;
      const tagsIdx = config.tagsColumn ? this.columnToIndex(config.tagsColumn) : null;
      const priorityIdx = config.priorityColumn ? this.columnToIndex(config.priorityColumn) : null;
      const isActiveIdx = config.isActiveColumn ? this.columnToIndex(config.isActiveColumn) : null;

      rows.forEach((row: any[], index: number) => {
        const question = row[questionIdx]?.trim();
        const answer = row[answerIdx]?.trim();

        if (question && answer) {
          sheetData.push({
            question,
            answer,
            category: categoryIdx !== null ? (row[categoryIdx] || 'general').trim() : 'general',
            tags: tagsIdx !== null && row[tagsIdx] ? row[tagsIdx].split(',').map((t: string) => t.trim()) : undefined,
            priority: priorityIdx !== null && row[priorityIdx] ? parseInt(row[priorityIdx]) || 1 : 1,
            isActive: isActiveIdx !== null ? row[isActiveIdx]?.toLowerCase() !== 'false' : true,
            rowId: `row_${index + config.headerRow + 1}`
          });
        }
      });

      return sheetData;
    } catch (error) {
      console.error('Error reading Google Sheets:', error);
      throw error;
    }
  }

  // Sync Google Sheets data to FAQ Knowledge Base
  async syncToKnowledgeBase(userId: string): Promise<any> {
    const startTime = Date.now();
    let syncLog: any;

    try {
      // Get active sync configuration
      const config = await this.getSyncConfig();
      if (!config) {
        throw new Error('No active Google Sheets sync configuration found');
      }

      // Create sync log entry
      const [logEntry] = await db.insert(googleSheetsSyncLog).values({
        configId: config.id,
        syncType: 'manual',
        status: 'in_progress',
        startedAt: new Date(),
        triggeredBy: userId
      }).returning();
      syncLog = logEntry;

      // Update sync status
      await db.update(googleSheetsSyncConfig)
        .set({ 
          lastSyncStatus: 'in_progress',
          lastSyncError: null 
        })
        .where(eq(googleSheetsSyncConfig.id, config.id));

      // Read Google Sheets data
      const sheetData = await this.readSheetData(config.spreadsheetId, config);

      // Get existing Google Sheets sourced FAQs
      const existingFAQs = await db.select()
        .from(faqKnowledgeBase)
        .where(eq(faqKnowledgeBase.sourceType, 'google_sheets'));

      // Create a map of existing FAQs by rowId
      const existingMap = new Map(
        existingFAQs.map(faq => [faq.googleSheetRowId, faq])
      );

      let itemsAdded = 0;
      let itemsUpdated = 0;
      let itemsSkipped = 0;

      // Process each row from the sheet
      for (const row of sheetData) {
        const existing = existingMap.get(row.rowId);

        if (existing) {
          // Check if update is needed
          const needsUpdate = 
            existing.question !== row.question ||
            existing.answer !== row.answer ||
            existing.category !== row.category ||
            JSON.stringify(existing.tags) !== JSON.stringify(row.tags) ||
            existing.priority !== row.priority ||
            existing.isActive !== row.isActive;

          if (needsUpdate) {
            await db.update(faqKnowledgeBase)
              .set({
                question: row.question,
                answer: row.answer,
                category: row.category,
                tags: row.tags,
                priority: row.priority,
                isActive: row.isActive,
                lastUpdated: new Date()
              })
              .where(eq(faqKnowledgeBase.id, existing.id));
            itemsUpdated++;
          } else {
            itemsSkipped++;
          }
        } else {
          // Insert new FAQ
          await db.insert(faqKnowledgeBase).values({
            question: row.question,
            answer: row.answer,
            category: row.category,
            tags: row.tags || [],
            priority: row.priority,
            isActive: row.isActive,
            sourceType: 'google_sheets',
            googleSheetRowId: row.rowId,
            createdBy: 'google_sheets_sync'
          });
          itemsAdded++;
        }
      }

      // Update sync log with success
      const duration = Date.now() - startTime;
      await db.update(googleSheetsSyncLog)
        .set({
          status: 'success',
          itemsProcessed: sheetData.length,
          itemsAdded,
          itemsUpdated,
          itemsSkipped,
          duration,
          completedAt: new Date()
        })
        .where(eq(googleSheetsSyncLog.id, syncLog.id));

      // Update sync config
      await db.update(googleSheetsSyncConfig)
        .set({
          lastSyncAt: new Date(),
          lastSyncStatus: 'success',
          lastSyncError: null
        })
        .where(eq(googleSheetsSyncConfig.id, config.id));

      return {
        success: true,
        itemsProcessed: sheetData.length,
        itemsAdded,
        itemsUpdated,
        itemsSkipped,
        duration
      };

    } catch (error: any) {
      console.error('Sync error:', error);

      // Update sync log with error
      if (syncLog) {
        await db.update(googleSheetsSyncLog)
          .set({
            status: 'error',
            errorDetails: error.message,
            completedAt: new Date(),
            duration: Date.now() - startTime
          })
          .where(eq(googleSheetsSyncLog.id, syncLog.id));
      }

      // Update sync config with error
      const config = await this.getSyncConfig();
      if (config) {
        await db.update(googleSheetsSyncConfig)
          .set({
            lastSyncAt: new Date(),
            lastSyncStatus: 'error',
            lastSyncError: error.message
          })
          .where(eq(googleSheetsSyncConfig.id, config.id));
      }

      throw error;
    }
  }

  // Validate spreadsheet access
  async validateSpreadsheet(spreadsheetId: string): Promise<boolean> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title'
      });

      return !!response.data.spreadsheetId;
    } catch (error) {
      console.error('Error validating spreadsheet:', error);
      return false;
    }
  }

  // Get spreadsheet metadata
  async getSpreadsheetInfo(spreadsheetId: string): Promise<any> {
    if (!this.sheets) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const response = await this.sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title,sheets.properties.title'
      });

      return {
        id: response.data.spreadsheetId,
        title: response.data.properties.title,
        sheets: response.data.sheets.map((sheet: any) => sheet.properties.title)
      };
    } catch (error) {
      console.error('Error getting spreadsheet info:', error);
      throw error;
    }
  }
}

export const googleSheetsKBService = new GoogleSheetsKBService();
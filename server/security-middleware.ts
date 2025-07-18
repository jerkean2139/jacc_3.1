import express, { type Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Configure rate limiting
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const documentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit document operations
  message: 'Too many document operations, please try again later.',
});

// Configure security headers
export function setupSecurity(app: Express) {
  // Basic helmet configuration
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.openai.com", "https://api.anthropic.com"],
        frameAncestors: ["'self'", "https://*.replit.app", "https://*.replit.dev"],
      },
    },
    crossOriginEmbedderPolicy: false, // Allow iframe embedding
  }));

  // Apply rate limiting to API routes
  app.use('/api/', apiLimiter);
  app.use('/api/login', authLimiter);
  app.use('/api/signup', authLimiter);
  app.use('/api/documents', documentLimiter);
  
  // Request size limits
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
}
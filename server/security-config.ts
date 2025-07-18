import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { db } from './db';
import { auditLogs } from '@shared/schema';

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

// Encrypt sensitive data
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

// Decrypt sensitive data
export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Session encryption middleware
export function encryptSession(req: Request, res: Response, next: NextFunction) {
  const originalSend = res.send;
  res.send = function(data: any) {
    if (req.session && req.session.user) {
      // Encrypt sensitive session data
      if (req.session.user.email) {
        req.session.user.encryptedEmail = encrypt(req.session.user.email);
        delete req.session.user.email;
      }
    }
    return originalSend.call(this, data);
  };
  next();
}

// Comprehensive security headers
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://apis.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://api.openai.com', 'https://api.anthropic.com', 'https://api.perplexity.ai'],
        frameAncestors: ["'self'", process.env.ISO_HUB_DOMAIN || 'none'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    noSniff: true,
    xssFilter: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permittedCrossDomainPolicies: false,
  });
}

// Rate limiting configurations
export const strictRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // 5 requests per minute
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
  message: 'API rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const documentRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 document requests per 5 minutes
  message: 'Document access rate limit exceeded.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Audit logging
export async function auditLog(
  userId: string,
  action: string,
  resource: string,
  details: any,
  ipAddress: string,
  userAgent: string
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      resource,
      details: JSON.stringify(details),
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Audit log error:', error);
    // Critical: audit failures should not break the application
    // but should be monitored
  }
}

// IP whitelist middleware
const IP_WHITELIST = process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [];

export function ipWhitelist(req: Request, res: Response, next: NextFunction) {
  if (IP_WHITELIST.length === 0) {
    return next(); // No whitelist configured
  }
  
  const clientIp = req.ip || req.connection.remoteAddress || '';
  if (!IP_WHITELIST.includes(clientIp)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

// Request signing verification
export function verifyRequestSignature(secret: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    
    if (!signature || !timestamp) {
      return res.status(401).json({ error: 'Missing signature' });
    }
    
    // Verify timestamp is within 5 minutes
    const requestTime = parseInt(timestamp);
    const currentTime = Date.now();
    if (Math.abs(currentTime - requestTime) > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'Request expired' });
    }
    
    // Verify signature
    const payload = JSON.stringify(req.body) + timestamp;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    next();
  };
}

// Document access control
export async function checkDocumentAccess(
  userId: string,
  documentId: string,
  requiredPermission: string
): Promise<boolean> {
  // Implement document-level access control
  const query = `
    SELECT dp.permission_level
    FROM document_permissions dp
    JOIN users u ON u.id = dp.user_id
    WHERE dp.document_id = $1 AND u.id = $2
  `;
  
  try {
    const result = await db.execute(query, [documentId, userId]);
    if (result.rows.length === 0) return false;
    
    const userPermission = result.rows[0].permission_level;
    return hasPermission(userPermission, requiredPermission);
  } catch (error) {
    console.error('Document access check error:', error);
    return false;
  }
}

function hasPermission(userPermission: string, requiredPermission: string): boolean {
  const permissionHierarchy = ['read', 'write', 'admin'];
  const userLevel = permissionHierarchy.indexOf(userPermission);
  const requiredLevel = permissionHierarchy.indexOf(requiredPermission);
  return userLevel >= requiredLevel;
}

// Secure file upload validation
export function validateFileUpload(file: Express.Multer.File): { valid: boolean; reason?: string } {
  // File size limits by type
  const sizeLimits: { [key: string]: number } = {
    'application/pdf': 50 * 1024 * 1024, // 50MB
    'text/csv': 10 * 1024 * 1024, // 10MB
    'text/plain': 5 * 1024 * 1024, // 5MB
    'image/jpeg': 10 * 1024 * 1024, // 10MB
    'image/png': 10 * 1024 * 1024, // 10MB
  };
  
  // Check file type
  if (!sizeLimits[file.mimetype]) {
    return { valid: false, reason: 'Invalid file type' };
  }
  
  // Check file size
  if (file.size > sizeLimits[file.mimetype]) {
    return { valid: false, reason: 'File too large' };
  }
  
  // Check for malicious patterns
  const buffer = file.buffer;
  const maliciousPatterns = [
    Buffer.from('<%'), // JSP
    Buffer.from('<?php'), // PHP
    Buffer.from('<script'), // JavaScript
    Buffer.from('../../'), // Path traversal
  ];
  
  for (const pattern of maliciousPatterns) {
    if (buffer.includes(pattern)) {
      return { valid: false, reason: 'Potentially malicious content detected' };
    }
  }
  
  return { valid: true };
}

// CSRF token generation and validation
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function validateCSRFToken(req: Request, res: Response, next: NextFunction) {
  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session?.csrfToken;
  
  if (!token || token !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  
  next();
}

// Two-factor authentication
export function generateTOTPSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function verifyTOTPToken(secret: string, token: string): boolean {
  // Implement TOTP verification logic
  // This is a placeholder - use a proper TOTP library in production
  return true;
}
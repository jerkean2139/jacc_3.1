import { Express, Request, Response } from 'express';
import { db } from './db';
import { documents, documentAccessLogs, auditLogs } from '@shared/schema';
import { 
  securityHeaders, 
  apiRateLimit, 
  documentRateLimit, 
  strictRateLimit,
  ipWhitelist,
  validateCSRFToken,
  auditLog
} from './security-config';
import { 
  SecureAuthService, 
  requireSecureAuth, 
  requireRole 
} from './secure-auth';
import { DocumentAccessControl } from './document-security';
import multer from 'multer';

const secureAuth = new SecureAuthService();
const documentAccess = new DocumentAccessControl();

// Configure secure file upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max
    files: 10
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'text/csv',
      'text/plain',
      'image/jpeg',
      'image/png'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

export function setupSecureRoutes(app: Express) {
  // Apply security headers to all routes
  app.use(securityHeaders());
  
  // Apply rate limiting to API routes
  app.use('/api/', apiRateLimit);
  
  // Secure login endpoint with strict rate limiting
  app.post('/api/auth/login', strictRateLimit, async (req: Request, res: Response) => {
    const { username, password, totpToken } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await secureAuth.authenticateUser(
      username,
      password,
      ipAddress,
      userAgent,
      totpToken
    );
    
    if (!result.success) {
      if (result.requiresTOTP) {
        return res.status(200).json({ requiresTOTP: true });
      }
      return res.status(401).json({ error: result.error });
    }
    
    // Set secure session cookie
    res.cookie('sessionId', result.sessionToken!, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000 // 4 hours
    });
    
    res.json({ user: result.user });
  });
  
  // Secure logout endpoint
  app.post('/api/auth/logout', requireSecureAuth, async (req: Request, res: Response) => {
    const sessionToken = req.cookies?.sessionId;
    const ipAddress = req.ip || '';
    const userAgent = req.headers['user-agent'] || '';
    
    if (sessionToken) {
      await secureAuth.logout(sessionToken, ipAddress, userAgent);
    }
    
    res.clearCookie('sessionId');
    res.json({ success: true });
  });
  
  // Get current user with session validation
  app.get('/api/auth/user', requireSecureAuth, (req: Request, res: Response) => {
    res.json(req.user);
  });
  
  // Secure document access with detailed access control
  app.get('/api/documents/:id/view', 
    requireSecureAuth, 
    documentRateLimit,
    async (req: Request, res: Response) => {
      const documentId = req.params.id;
      const userId = req.user!.id;
      const ipAddress = req.ip || '';
      const userAgent = req.headers['user-agent'] || '';
      
      const access = await documentAccess.accessDocument(
        userId,
        documentId,
        'view',
        ipAddress,
        userAgent
      );
      
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(access.content);
  });
  
  // Secure document download with watermarking
  app.get('/api/documents/:id/download',
    requireSecureAuth,
    documentRateLimit,
    async (req: Request, res: Response) => {
      const documentId = req.params.id;
      const userId = req.user!.id;
      const ipAddress = req.ip || '';
      const userAgent = req.headers['user-agent'] || '';
      
      const access = await documentAccess.accessDocument(
        userId,
        documentId,
        'download',
        ipAddress,
        userAgent
      );
      
      if (!access.allowed) {
        return res.status(403).json({ error: access.reason });
      }
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="document.pdf"');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.send(access.content);
  });
  
  // Admin-only audit log endpoint
  app.get('/api/admin/audit-logs',
    requireSecureAuth,
    requireRole(['dev-admin']),
    async (req: Request, res: Response) => {
      const logs = await db
        .select()
        .from(auditLogs)
        .orderBy(auditLogs.timestamp)
        .limit(100);
      
      res.json(logs);
  });
  
  // Admin-only document access logs
  app.get('/api/admin/document-access-logs',
    requireSecureAuth,
    requireRole(['dev-admin']),
    async (req: Request, res: Response) => {
      const logs = await db
        .select()
        .from(documentAccessLogs)
        .orderBy(documentAccessLogs.timestamp)
        .limit(100);
      
      res.json(logs);
  });
  
  // Health check endpoint (no auth required but rate limited)
  app.get('/api/health', apiRateLimit, (req: Request, res: Response) => {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      security: 'bank-level'
    });
  });
}
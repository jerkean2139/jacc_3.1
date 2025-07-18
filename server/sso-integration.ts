import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

interface SSOTokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId?: string;
  exp?: number;
}

export class SSOIntegrationService {
  private static readonly JWT_SECRET = process.env.SSO_JWT_SECRET || 'your-sso-secret-key';
  private static readonly TOKEN_EXPIRY = '24h';

  // Validate SSO token from ISO Hub
  static async validateSSOToken(token: string): Promise<SSOTokenPayload | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as SSOTokenPayload;
      
      // Additional validation can be added here
      if (!decoded.userId || !decoded.email) {
        throw new Error('Invalid token payload');
      }

      return decoded;
    } catch (error) {
      console.error('SSO token validation failed:', error);
      return null;
    }
  }

  // Create JACC session from SSO token
  static async handleSSOLogin(req: Request, res: Response) {
    try {
      const { token, userId } = req.body;

      if (!token || !userId) {
        return res.status(400).json({ error: 'Token and userId required' });
      }

      // Validate the SSO token
      const tokenPayload = await this.validateSSOToken(token);
      if (!tokenPayload || tokenPayload.userId !== userId) {
        return res.status(401).json({ error: 'Invalid SSO token' });
      }

      // Import storage service
      const { storage } = await import('./storage');

      // Get or create user in JACC system
      let user = await storage.getUser(userId);
      if (!user) {
        // Create new user from SSO data
        user = await storage.upsertUser({
          id: userId,
          email: tokenPayload.email,
          role: tokenPayload.role || 'sales-agent',
          firstName: '', // Can be extended based on SSO payload
          lastName: '',
          profileImageUrl: ''
        });
      }

      // Create JACC session
      const sessionId = this.generateSessionId();
      const sessions = await import('./simple-routes').then(m => m.sessions);
      
      sessions.set(sessionId, {
        userId: user.id,
        user: user,
        loginTime: new Date(),
        tenantId: tokenPayload.tenantId
      });

      // Set session cookie
      res.cookie('sessionId', sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        sameSite: 'none' // Required for iframe embedding
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role
        }
      });

    } catch (error) {
      console.error('SSO login error:', error);
      res.status(500).json({ error: 'SSO login failed' });
    }
  }

  // Generate URL with embedded auth token for iframe
  static generateEmbedURL(baseURL: string, userToken: string, userId: string): string {
    const url = new URL(baseURL);
    url.searchParams.set('sso_token', userToken);
    url.searchParams.set('user_id', userId);
    url.searchParams.set('embedded', 'true');
    return url.toString();
  }

  // Auto-login from URL parameters (for iframe embedding)
  static async handleEmbeddedAuth(req: Request, res: Response) {
    try {
      const { sso_token, user_id, embedded } = req.query;

      if (!sso_token || !user_id || embedded !== 'true') {
        return res.redirect('/login');
      }

      // Validate and login
      const result = await this.handleSSOLogin({
        ...req,
        body: { token: sso_token, userId: user_id }
      } as Request, res);

      if (result) {
        // Redirect to main app after successful login
        res.redirect('/');
      }

    } catch (error) {
      console.error('Embedded auth error:', error);
      res.redirect('/login');
    }
  }

  private static generateSessionId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
}
import bcrypt from 'bcrypt';
import session from 'express-session';
import connectPg from 'connect-pg-simple';
import type { Express } from 'express';
import { storage } from './storage';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  return bcrypt.compare(supplied, stored);
}

export function setupAuth(app: Express) {
  const pgStore = connectPg(session);
  
  // Use PostgreSQL session store for production reliability
  app.use(session({
    secret: process.env.SESSION_SECRET || 'demo-secret-key',
    resave: false,
    saveUninitialized: false,
    store: new pgStore({
      conString: process.env.DATABASE_URL,
      tableName: 'sessions',
      createTableIfMissing: true,
      ttl: 60 * 60 * 4, // 4 hours
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 4 * 60 * 60 * 1000, // 4 hours to match session TTL
      sameSite: 'lax', // Better compatibility with iframe embedding
    },
  }));
}

export const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.session?.user) {
    req.user = req.session.user;
    return next();
  }
  return res.status(401).json({ message: "Not authenticated" });
};

export const requireRole = (roles: string[]) => {
  return (req: any, res: any, next: any) => {
    if (!req.session?.user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }
    
    return next();
  };
};
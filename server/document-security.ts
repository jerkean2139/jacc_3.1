import crypto from 'crypto';
import { db } from './db';
import { documents, documentAccessLogs, documentPermissions } from '@shared/schema';
import { encrypt, decrypt, auditLog } from './security-config';
import { eq, and } from 'drizzle-orm';

// Document encryption at rest
export class SecureDocumentStorage {
  private encryptionKey: Buffer;
  
  constructor() {
    this.encryptionKey = Buffer.from(process.env.DOCUMENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'), 'hex');
  }
  
  // Encrypt document content before storage
  async encryptDocument(content: Buffer, metadata: any): Promise<{ encryptedContent: string; encryptedMetadata: string }> {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    const encryptedContent = Buffer.concat([
      cipher.update(content),
      cipher.final()
    ]);
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted content
    const combined = Buffer.concat([iv, authTag, encryptedContent]);
    
    // Encrypt metadata separately
    const encryptedMetadata = encrypt(JSON.stringify(metadata));
    
    return {
      encryptedContent: combined.toString('base64'),
      encryptedMetadata
    };
  }
  
  // Decrypt document content for authorized access
  async decryptDocument(encryptedContent: string, encryptedMetadata: string): Promise<{ content: Buffer; metadata: any }> {
    const combined = Buffer.from(encryptedContent, 'base64');
    
    const iv = combined.slice(0, 16);
    const authTag = combined.slice(16, 32);
    const encrypted = combined.slice(32);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);
    
    const content = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    const metadata = JSON.parse(decrypt(encryptedMetadata));
    
    return { content, metadata };
  }
}

// Document access control with audit trail
export class DocumentAccessControl {
  private secureStorage: SecureDocumentStorage;
  
  constructor() {
    this.secureStorage = new SecureDocumentStorage();
  }
  
  // Check and log document access
  async accessDocument(
    userId: string,
    documentId: string,
    accessType: 'view' | 'download' | 'edit',
    ipAddress: string,
    userAgent: string
  ): Promise<{ allowed: boolean; content?: Buffer; reason?: string }> {
    try {
      // Check user permissions
      const permission = await this.checkPermission(userId, documentId, accessType);
      
      if (!permission.allowed) {
        // Log failed access attempt
        await this.logAccess(userId, documentId, accessType, false, permission.reason, ipAddress, userAgent);
        return { allowed: false, reason: permission.reason };
      }
      
      // Get encrypted document
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId));
      
      if (!document) {
        return { allowed: false, reason: 'Document not found' };
      }
      
      // Decrypt document
      const { content } = await this.secureStorage.decryptDocument(
        document.encryptedContent as string,
        document.encryptedMetadata as string
      );
      
      // Log successful access
      await this.logAccess(userId, documentId, accessType, true, 'Access granted', ipAddress, userAgent);
      
      // Watermark if download
      const finalContent = accessType === 'download' 
        ? await this.addWatermark(content, userId, new Date())
        : content;
      
      return { allowed: true, content: finalContent };
    } catch (error) {
      console.error('Document access error:', error);
      return { allowed: false, reason: 'Access error' };
    }
  }
  
  // Check user permission for document
  private async checkPermission(
    userId: string,
    documentId: string,
    accessType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Get user role and document permissions
    const query = `
      SELECT 
        u.role,
        dp.permission_level,
        d.classification,
        d.department
      FROM users u
      LEFT JOIN document_permissions dp ON dp.user_id = u.id AND dp.document_id = $2
      LEFT JOIN documents d ON d.id = $2
      WHERE u.id = $1
    `;
    
    const result = await db.execute(query, [userId, documentId]);
    
    if (result.rows.length === 0) {
      return { allowed: false, reason: 'User not found' };
    }
    
    const { role, permission_level, classification, department } = result.rows[0];
    
    // Admin always has access
    if (role === 'dev-admin') {
      return { allowed: true };
    }
    
    // Check classification level
    if (classification === 'confidential' && role !== 'client-admin') {
      return { allowed: false, reason: 'Insufficient clearance for confidential documents' };
    }
    
    // Check explicit permissions
    if (!permission_level) {
      return { allowed: false, reason: 'No permission granted for this document' };
    }
    
    // Check permission level matches access type
    const requiredLevel = this.getRequiredLevel(accessType);
    const hasLevel = this.hasPermissionLevel(permission_level, requiredLevel);
    
    if (!hasLevel) {
      return { allowed: false, reason: `Insufficient permission for ${accessType}` };
    }
    
    return { allowed: true };
  }
  
  private getRequiredLevel(accessType: string): string {
    switch (accessType) {
      case 'view': return 'read';
      case 'download': return 'download';
      case 'edit': return 'write';
      default: return 'admin';
    }
  }
  
  private hasPermissionLevel(userLevel: string, requiredLevel: string): boolean {
    const levels = ['read', 'download', 'write', 'admin'];
    return levels.indexOf(userLevel) >= levels.indexOf(requiredLevel);
  }
  
  // Log document access
  private async logAccess(
    userId: string,
    documentId: string,
    accessType: string,
    allowed: boolean,
    reason: string,
    ipAddress: string,
    userAgent: string
  ) {
    await db.insert(documentAccessLogs).values({
      userId,
      documentId,
      accessType,
      allowed,
      reason,
      ipAddress,
      userAgent,
      timestamp: new Date()
    });
    
    // Also create audit log
    await auditLog(
      userId,
      `document_${accessType}`,
      documentId,
      { allowed, reason },
      ipAddress,
      userAgent
    );
  }
  
  // Add watermark to downloaded documents
  private async addWatermark(content: Buffer, userId: string, timestamp: Date): Promise<Buffer> {
    // For PDFs, add watermark (simplified example)
    // In production, use a proper PDF library
    const watermarkText = `Downloaded by ${userId} on ${timestamp.toISOString()}`;
    
    // This is a placeholder - implement proper PDF watermarking
    return content;
  }
}

// Secure document upload with virus scanning
export class SecureDocumentUpload {
  private secureStorage: SecureDocumentStorage;
  
  constructor() {
    this.secureStorage = new SecureDocumentStorage();
  }
  
  async uploadDocument(
    file: Express.Multer.File,
    userId: string,
    classification: string,
    department: string
  ): Promise<{ success: boolean; documentId?: string; error?: string }> {
    try {
      // Virus scan (placeholder - integrate with real AV service)
      const scanResult = await this.scanForVirus(file.buffer);
      if (!scanResult.clean) {
        return { success: false, error: 'Malware detected' };
      }
      
      // Content inspection for sensitive data
      const sensitiveData = await this.scanForSensitiveData(file.buffer);
      if (sensitiveData.found) {
        // Redact or reject based on policy
        if (classification !== 'confidential') {
          return { success: false, error: 'Sensitive data found in non-confidential document' };
        }
      }
      
      // Encrypt document
      const { encryptedContent, encryptedMetadata } = await this.secureStorage.encryptDocument(
        file.buffer,
        {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          uploadedBy: userId,
          uploadedAt: new Date()
        }
      );
      
      // Store encrypted document
      const [document] = await db.insert(documents).values({
        name: file.originalname,
        encryptedContent,
        encryptedMetadata,
        classification,
        department,
        uploadedBy: userId,
        uploadedAt: new Date()
      }).returning();
      
      return { success: true, documentId: document.id };
    } catch (error) {
      console.error('Document upload error:', error);
      return { success: false, error: 'Upload failed' };
    }
  }
  
  private async scanForVirus(buffer: Buffer): Promise<{ clean: boolean; threat?: string }> {
    // Integrate with ClamAV or similar
    // Placeholder implementation
    return { clean: true };
  }
  
  private async scanForSensitiveData(buffer: Buffer): Promise<{ found: boolean; types?: string[] }> {
    const text = buffer.toString('utf-8');
    const patterns = {
      ssn: /\b\d{3}-\d{2}-\d{4}\b/,
      creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
      apiKey: /\b[A-Za-z0-9]{32,}\b/,
      privateKey: /-----BEGIN (RSA )?PRIVATE KEY-----/
    };
    
    const found: string[] = [];
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        found.push(type);
      }
    }
    
    return { found: found.length > 0, types: found };
  }
}

// Data loss prevention
export class DataLossPrevention {
  // Monitor and prevent unauthorized data exfiltration
  async checkDataExport(
    userId: string,
    data: any,
    exportType: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check export limits
    const exportCount = await this.getExportCount(userId, 24); // Last 24 hours
    
    if (exportCount > 100) {
      return { allowed: false, reason: 'Export limit exceeded' };
    }
    
    // Check data sensitivity
    if (this.containsSensitiveData(data)) {
      // Log attempt
      await auditLog(
        userId,
        'sensitive_data_export_attempt',
        exportType,
        { dataSize: JSON.stringify(data).length },
        '',
        ''
      );
      
      return { allowed: false, reason: 'Contains sensitive data' };
    }
    
    return { allowed: true };
  }
  
  private async getExportCount(userId: string, hours: number): Promise<number> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const query = `
      SELECT COUNT(*) as count
      FROM audit_logs
      WHERE user_id = $1 
        AND action LIKE 'document_download%'
        AND timestamp > $2
    `;
    
    const result = await db.execute(query, [userId, since]);
    return parseInt(result.rows[0].count) || 0;
  }
  
  private containsSensitiveData(data: any): boolean {
    const dataStr = JSON.stringify(data);
    return /\b\d{3}-\d{2}-\d{4}\b/.test(dataStr) || // SSN
           /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(dataStr); // Credit card
  }
}
import { Database } from '@journeyapps/sqlcipher';
import { serverConfig } from '../config/server';
import { createHash, randomBytes } from 'crypto';

// Add type declarations for @journeyapps/sqlcipher
declare module '@journeyapps/sqlcipher' {
  interface Database {
    exec(sql: string): void;
    prepare(sql: string): Statement;
    close(): void;
    pragma(pragma: string, value?: string | number | boolean): any;
  }

  interface Statement {
    run(...params: any[]): RunResult;
    get(...params: any[]): any;
    all(...params: any[]): any[];
  }

  interface RunResult {
    changes: number;
    lastInsertRowid: number;
  }
}

export class DatabaseService {
  private db: Database;

  constructor() {
    // Initialize database with SQLCipher encryption
    this.db = new Database(serverConfig.DB.PATH);

    // Configure database settings
    this.db.pragma('cipher', serverConfig.DB.CIPHER);
    this.db.pragma('key', serverConfig.DB.KEY);
    this.db.pragma('journal_mode', serverConfig.DB.JOURNAL_MODE);
    this.db.pragma('secure_delete', 'ON');

    // Enable foreign keys
    this.db.pragma('foreign_keys', 'ON');

    // Initialize schema
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gazette_entries (
        password_hash TEXT PRIMARY KEY,
        encrypted_dek TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        salt TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        metadata TEXT
      );

      -- Index for faster lookups
      CREATE INDEX IF NOT EXISTS idx_gazette_entries_created_at 
      ON gazette_entries(created_at);

      -- Index for version-based queries
      CREATE INDEX IF NOT EXISTS idx_gazette_entries_version 
      ON gazette_entries(version);
    `);
  }

  // Generate a secure salt for password hashing
  private generateSalt(): string {
    return createHash('sha256')
      .update(randomBytes(32).toString('hex'))
      .digest('hex');
  }

  // Insert a new entry with the encrypted DEK
  public insertEntry(
    passwordHash: string, 
    encryptedDEK: string, 
    salt: string
  ): void {
    const now = Date.now();
    
    this.db.prepare(`
      INSERT INTO gazette_entries (
        password_hash, 
        encrypted_dek, 
        created_at, 
        updated_at, 
        salt,
        version,
        metadata
      ) VALUES (?, ?, ?, ?, ?, 1, ?)
    `).run(
      passwordHash, 
      encryptedDEK, 
      now, 
      now, 
      salt
    );
  }

  // Get an entry by password hash
  public getEntry(passwordHash: string): { 
    encryptedDEK: string; 
    salt: string;
    version: number;
  } | null {
    const result = this.db.prepare(`
      SELECT encrypted_dek, salt, version, metadata
      FROM gazette_entries
      WHERE password_hash = ?
    `).get(passwordHash) as { 
      encrypted_dek: string; 
      salt: string;
      version: number;
      metadata: string | null;
    } | undefined;

    if (!result) return null;

    return {
      encryptedDEK: result.encrypted_dek,
      salt: result.salt,
      version: result.version
    };
  }

  // Securely delete an entry
  public deleteEntry(passwordHash: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM gazette_entries
      WHERE password_hash = ?
    `).run(passwordHash);

    return result.changes > 0;
  }

  // Update an existing entry
  public updateEntry(
    passwordHash: string, 
    encryptedDEK: string, 
    salt: string,
    metadata?: Record<string, unknown>
  ): boolean {
    const now = Date.now();
    
    const result = this.db.prepare(`
      UPDATE gazette_entries
      SET 
        encrypted_dek = ?, 
        updated_at = ?, 
        salt = ?,
        version = version + 1,
        metadata = ?
      WHERE password_hash = ?
    `).run(
      encryptedDEK, 
      now, 
      salt,
      metadata ? JSON.stringify(metadata) : null,
      passwordHash
    );

    return result.changes > 0;
  }

  // Get all entries (for maintenance/cleanup)
  public getAllEntries(): Array<{
    passwordHash: string;
    createdAt: number;
    updatedAt: number;
    version: number;
  }> {
    return this.db.prepare(`
      SELECT 
        password_hash as passwordHash,
        created_at as createdAt,
        updated_at as updatedAt,
        version
      FROM gazette_entries
      ORDER BY created_at DESC
    `).all();
  }

  // Clean up old entries
  public cleanupOldEntries(maxAgeMs: number): number {
    const cutoff = Date.now() - maxAgeMs;
    const result = this.db.prepare(`
      DELETE FROM gazette_entries
      WHERE updated_at < ?
    `).run(cutoff);

    return result.changes;
  }

  // Close the database connection
  public close(): void {
    this.db.close();
  }
}

// Export a singleton instance
export const dbService = new DatabaseService(); 
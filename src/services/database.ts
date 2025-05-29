import { Database } from '@signalapp/sqlcipher';
import { serverConfig } from '../config';


export class DatabaseService {
  private db: Database;

  constructor() {
    this.db = new Database(serverConfig.DB.PATH);

    this.db.exec(`PRAGMA cipher = ${serverConfig.DB.CIPHER}`);
    this.db.exec(`PRAGMA key = ${serverConfig.DB.KEY}`);
    this.db.exec(`PRAGMA journal_mode = ${serverConfig.DB.JOURNAL_MODE}`);
    this.db.exec(`PRAGMA secure_delete = ON`);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS gazette_entries (
        password_hash TEXT PRIMARY KEY,
        encrypted_dek TEXT NOT NULL,
        salt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_gazette_entries_password_hash 
        ON gazette_entries(password_hash);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_gazette_entries_password_hash 
        ON gazette_entries(password_hash);
    `);
  }

  public insertEntry(
    passwordHash: string, 
    encryptedDEK: string, 
    salt: string
  ): void {
    this.db.prepare(`
      INSERT INTO gazette_entries (
        password_hash, 
        encrypted_dek, 
        salt
      ) VALUES ($passwordHash, $encryptedDEK, $salt)
    `).run({
        passwordHash, 
        encryptedDEK, 
        salt
      }
    );
  }

  public getEntry(passwordHash: string): { 
    encryptedDEK: string; 
    salt: string;
  } | null {
    const result = this.db.prepare(`
      SELECT encrypted_dek, salt
      FROM gazette_entries
      WHERE password_hash = $passwordHash
    `).get({passwordHash}) as { 
      encrypted_dek: string; 
      salt: string;
    } | undefined;

    if (!result) return null;

    return {
      encryptedDEK: result.encrypted_dek,
      salt: result.salt
    };
  }

  public deleteEntry(passwordHash: string): boolean {
    const result = this.db.prepare(`
      DELETE FROM gazette_entries
      WHERE password_hash = $passwordHash
    `).run({passwordHash});

    return result.changes > 0;
  }

  public close(): void {
    this.db.close();
  }
}

export const dbService = new DatabaseService(); 
import { config } from 'dotenv';
import { resolve } from 'path';

config();

export const serverConfig = {
  PORT: process.env.PORT || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB: {
    PATH: process.env.DB_PATH || resolve(process.cwd(), 'data', 'gazette.db'),
    KEY: process.env.DB_KEY || 'your-secure-key-here', 
    CIPHER: 'aes-256-gcm' as const,
    JOURNAL_MODE: 'WAL' as const,
  }
} as const;

if (serverConfig.NODE_ENV === 'production') {
  const requiredEnvVars = ['DB_KEY'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  }
} 
import { Express, Request, Response, NextFunction } from 'express';
import { dbService } from '../services/database';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
  }
}

async function insertHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { passwordHash, encryptedDEK, salt } = req.body;
    if (!passwordHash || !encryptedDEK || !salt) {
      throw new ApiError(400, 'Missing required fields');
    }

    dbService.insertEntry(passwordHash, encryptedDEK, salt);

    res.json({
      message: 'Entry created successfully',
      passwordHash,
    });
  } catch (error) {
    next(error);
  }
}

async function getHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { passwordHash } = req.body;
    const entry = dbService.getEntry(passwordHash);

    if (!entry) {
      throw new ApiError(404, 'Entry not found');
    }

    res.json(entry);
  } catch (error) {
    next(error);
  }
}

async function deleteHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { passwordHash } = req.body;
    
    dbService.deleteEntry(passwordHash);

    res.json({
      message: 'Entry deleted successfully',
      passwordHash,
    });
  } catch (error) {
    next(error);
  }
}

export function setupRoutes(app: Express): void {
  app.post('/deadman/insert', insertHandler);
  app.get('/deadman/get', getHandler);
  app.delete('/deadman/delete', deleteHandler);

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version,
    });
  });
} 
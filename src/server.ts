import express from 'express';
import http from 'http';
import { serverConfig } from './config';
import { dbService } from './services/database';
import { setupRoutes } from './routes';

const app = express();
setupRoutes(app);
const server = http.createServer(app);

function startServer(): void {
  server.listen(serverConfig.PORT, () => {
    console.log(`Deadman's Gazette running on port ${serverConfig.PORT}`);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', () => gracefulShutdown('UNCAUGHT_EXCEPTION'));
process.on('unhandledRejection', () => gracefulShutdown('UNHANDLED_REJECTION'));

function gracefulShutdown(signal: string): void {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  server.close(() => {
    dbService.close();
    process.exit(0);
  });
}

startServer(); 
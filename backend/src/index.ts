import 'reflect-metadata';
import { config } from 'dotenv';
import { startServer } from './server.js';

config();
await startServer();

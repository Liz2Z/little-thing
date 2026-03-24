import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { sessionRoutes, systemRoutes } from './routes';
import { errorHandler } from './errors';
import { loadSettings, settings } from './config';

// Load settings before starting the server
await loadSettings();

const app = new Hono()
  .onError(errorHandler)
  .use('/*', cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }))
  .route('/sessions', sessionRoutes)
  .route('/system', systemRoutes);

const port = settings.server.port;
const host = settings.server.host;

console.log(`Server running on http://${host}:${port}`);
console.log(`OpenAPI spec available at http://${host}:${port}/openapi.json`);

Bun.serve({
  port: port,
  hostname: host,
  fetch: app.fetch,
});

export { app };
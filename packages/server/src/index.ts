import { cors } from 'hono/cors';
import { Hono } from 'hono';
// must import before other modules
import { settings } from './settings';



import { sessionRoutes, systemRoutes } from './routes';
import { errorHandler } from './errors';


const rawSettings = settings.get();


if (!rawSettings?.server) {
  throw new Error('Server config not loaded');
}

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

const port = rawSettings.server.port;
const host = rawSettings.server.host;

console.log(`Server running on http://${host}:${port}`);
console.log(`OpenAPI spec available at http://${host}:${port}/openapi.json`);

if (import.meta.main) {
  Bun.serve({
    port: port,
    hostname: host,
    fetch: app.fetch,
  });
}

export { app };
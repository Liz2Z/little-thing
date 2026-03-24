import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { sessionRoutes, systemRoutes } from './routes';
import { errorHandler } from './errors';

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

const PORT = process.env.PORT || 3000;

console.log(`Server running on http://localhost:${PORT}`);
console.log(`OpenAPI spec available at http://localhost:${PORT}/openapi.json`);

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

export { app };
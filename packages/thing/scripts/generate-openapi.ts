import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServerApp } from '../src/server/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, '../openapi.json');

async function generateOpenAPI() {
  console.log('生成 OpenAPI 规范...');

  const app = createServerApp();
  const { generateSpecs } = await import('hono-openapi');
  const specs = await generateSpecs(app);

  const openapiSpec = {
    ...specs,
    openapi: '3.1.0',
    info: {
      title: 'Agent Platform API',
      version: '1.0.0',
      description: 'API for Agent Platform - a chat application with session management and real-time events',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(openapiSpec, null, 2));
  console.log('OpenAPI 规范已生成:', OUTPUT_FILE);
  console.log('端点数量:', Object.keys(specs.paths || {}).length);
}

generateOpenAPI();

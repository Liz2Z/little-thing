import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createApp } from '../src/routes.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(__dirname, '../openapi.json');

async function generateOpenAPI() {
  console.log('生成 OpenAPI 规范...');

  const llmConfig = {
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'glm-4.7',
  };

  const app = createApp(llmConfig);

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

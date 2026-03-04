import { createApp } from './routes.js';

const llmConfig = {
  apiKey: process.env.LLM_API_KEY || '',
  baseUrl: `${process.env.LLM_BASE_URL}/v1` || 'https://api.moonshot.cn/v1',
  model: process.env.LLM_MODEL || 'glm-4.7',
};

const app = createApp(llmConfig);

const PORT = process.env.PORT || 3000;

export default {
  port: PORT,
  fetch: app.fetch,
};

console.log(`Server running on http://localhost:${PORT}`);
console.log(`OpenAPI spec available at http://localhost:${PORT}/openapi.json`);
console.log(`Using model: ${llmConfig.model}`);

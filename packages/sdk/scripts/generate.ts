import { $ } from 'bun';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const OPENAPI_URL = `${SERVER_URL}/openapi.json`;
const OUTPUT_FILE = './src/schema.d.ts';

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
      // Server not ready yet
    }
    console.log(`Waiting for server at ${url}... (${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

async function generateSchema() {
  console.log('Fetching OpenAPI schema from:', OPENAPI_URL);
  
  const serverReady = await waitForServer(OPENAPI_URL);
  if (!serverReady) {
    console.error('Server is not responding. Please start the server first:');
    console.error('  bun run dev:server');
    process.exit(1);
  }

  try {
    const response = await fetch(OPENAPI_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch OpenAPI schema: ${response.status}`);
    }
    
    const schema = await response.json();
    console.log('Schema fetched successfully');
    console.log('API Title:', schema.info?.title);
    console.log('API Version:', schema.info?.version);
    console.log('Endpoints:', Object.keys(schema.paths || {}).length);

    await $`bunx openapi-typescript ${OPENAPI_URL} -o ${OUTPUT_FILE}`;
    console.log('Schema generated successfully at:', OUTPUT_FILE);
  } catch (error) {
    console.error('Failed to generate schema:', error);
    process.exit(1);
  }
}

generateSchema();

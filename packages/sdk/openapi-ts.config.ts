import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../server/openapi.json',
  output: 'src',
  plugins: [
    '@hey-api/typescript',
    {
      name: '@hey-api/sdk',
      operations: {
        strategy: 'flat',
      },
    },
  ],
});

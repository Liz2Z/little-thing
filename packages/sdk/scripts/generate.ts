import { $ } from 'bun';
import { writeFileSync, mkdirSync } from 'fs';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const OPENAPI_URL = `${SERVER_URL}/openapi.json`;
const SCHEMA_FILE = './src/schema.d.ts';
const SDK_FILE = './src/generated.ts';

interface OpenAPIPath {
  summary?: string;
  operationId?: string;
  tags?: string[];
  request?: {
    body?: {
      content: Record<string, { schema: any }>;
    };
    params?: any;
  };
  responses: Record<string, any>;
}

interface OpenAPISchema {
  info: { title: string; version: string };
  paths: Record<string, Record<string, OpenAPIPath>>;
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return true;
      }
    } catch {
    }
    console.log(`等待服务器启动 ${url}... (${i + 1}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

function parseOperationId(operationId: string): { namespace: string; method: string }[] {
  const parts = operationId.split('.');
  if (parts.length === 1) {
    return [{ namespace: 'api', method: parts[0] }];
  }
  
  const result: { namespace: string; method: string }[] = [];
  for (let i = 0; i < parts.length - 1; i++) {
    result.push({
      namespace: parts.slice(0, i + 1).join('.'),
      method: parts[i + 1],
    });
  }
  return result;
}

function generateSDKMethods(schema: OpenAPISchema): string {
  const namespaces: Record<string, Map<string, { path: string; method: string; hasBody: boolean; hasParams: boolean }>> = {};
  
  for (const [path, methods] of Object.entries(schema.paths)) {
    for (const [httpMethod, spec] of Object.entries(methods)) {
      if (!spec.operationId) continue;
      
      const opIdParts = spec.operationId.split('.');
      const namespace = opIdParts.length > 1 ? opIdParts.slice(0, -1).join('.') : 'api';
      const methodName = opIdParts[opIdParts.length - 1];
      
      if (!namespaces[namespace]) {
        namespaces[namespace] = new Map();
      }
      
      const hasBody = spec.request?.body?.content?.['application/json'] !== undefined;
      const hasParams = spec.request?.params !== undefined || path.includes('{');
      
      namespaces[namespace].set(methodName, {
        path,
        method: httpMethod.toUpperCase(),
        hasBody,
        hasParams,
      });
    }
  }

  let code = `/**
 * 自动生成的 SDK 客户端
 * 基于 OpenAPI operationId 生成语义化调用链
 * 不要手动修改此文件
 */

import type { paths } from './schema.js';

export type { paths } from './schema.js';

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

`;

  const namespaceNames = Object.keys(namespaces).sort();
  
  for (const namespace of namespaceNames) {
    const methods = namespaces[namespace];
    const className = namespace.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    
    code += `export class ${className}Api {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl = config.baseUrl || 'http://localhost:3000';
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

`;
    
    for (const [methodName, info] of methods) {
      const pathTemplate = info.path.replace(/{(\w+)}/g, '${$1}');
      
      if (info.hasParams && info.hasBody) {
        code += `  async ${methodName}(params: { ${info.path.match(/{(\w+)}/g)?.map(p => p.slice(1, -1)).join(': string; ') || ''}: string }, body: any): Promise<Response> {
    const ${info.path.match(/{(\w+)}/g)?.[0]?.slice(1, -1) || 'id'} = params.${info.path.match(/{(\w+)}/g)?.[0]?.slice(1, -1) || 'id'};
    return fetch(\`\${this.baseUrl}${pathTemplate}\`, {
      method: '${info.method}',
      headers: this.headers,
      body: JSON.stringify(body),
    });
  }

`;
      } else if (info.hasParams) {
        const paramNames = info.path.match(/{(\w+)}/g)?.map(p => p.slice(1, -1)) || [];
        code += `  async ${methodName}(${paramNames.map(p => `${p}: string`).join(', ')}): Promise<Response> {
    return fetch(\`\${this.baseUrl}${pathTemplate}\`, {
      method: '${info.method}',
      headers: this.headers,
    });
  }

`;
      } else if (info.hasBody) {
        code += `  async ${methodName}(body: any): Promise<Response> {
    return fetch(\`\${this.baseUrl}${pathTemplate}\`, {
      method: '${info.method}',
      headers: this.headers,
      body: JSON.stringify(body),
    });
  }

`;
      } else {
        code += `  async ${methodName}(): Promise<Response> {
    return fetch(\`\${this.baseUrl}${pathTemplate}\`, {
      method: '${info.method}',
      headers: this.headers,
    });
  }

`;
      }
    }
    
    code += `}

`;
  }

  code += `export class ApiClient {
  private config: ApiClientConfig;
`;
  
  for (const namespace of namespaceNames) {
    const className = namespace.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const propertyName = namespace.includes('.') ? namespace.split('.')[0] : namespace;
    code += `  ${propertyName}: ${className}Api;\n`;
  }

  code += `
  constructor(config: ApiClientConfig = {}) {
    this.config = config;
`;
  
  for (const namespace of namespaceNames) {
    const className = namespace.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
    const propertyName = namespace.includes('.') ? namespace.split('.')[0] : namespace;
    code += `    this.${propertyName} = new ${className}Api(config);\n`;
  }

  code += `  }
}

export const createApiClient = (config?: ApiClientConfig) => new ApiClient(config);
`;

  return code;
}

async function generateSchema() {
  console.log('从服务器获取 OpenAPI schema:', OPENAPI_URL);
  
  const serverReady = await waitForServer(OPENAPI_URL);
  if (!serverReady) {
    console.error('服务器未响应。请先启动服务器:');
    console.error('  bun run dev:server');
    process.exit(1);
  }

  try {
    const response = await fetch(OPENAPI_URL);
    if (!response.ok) {
      throw new Error(`获取 OpenAPI schema 失败: ${response.status}`);
    }
    
    const schema: OpenAPISchema = await response.json();
    console.log('Schema 获取成功');
    console.log('API 标题:', schema.info?.title);
    console.log('API 版本:', schema.info?.version);
    console.log('端点数量:', Object.keys(schema.paths || {}).length);

    await $`bunx openapi-typescript ${OPENAPI_URL} -o ${SCHEMA_FILE}`;
    console.log('类型定义生成成功:', SCHEMA_FILE);

    const sdkCode = generateSDKMethods(schema);
    mkdirSync('./src', { recursive: true });
    writeFileSync(SDK_FILE, sdkCode);
    console.log('SDK 客户端生成成功:', SDK_FILE);
    
    console.log('\n生成的 API 命名空间:');
    for (const [path, methods] of Object.entries(schema.paths)) {
      for (const [httpMethod, spec] of Object.entries(methods)) {
        if (spec.operationId) {
          console.log(`  ${spec.operationId} -> ${httpMethod.toUpperCase()} ${path}`);
        }
      }
    }
  } catch (error) {
    console.error('生成失败:', error);
    process.exit(1);
  }
}

generateSchema();

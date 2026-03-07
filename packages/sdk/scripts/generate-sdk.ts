import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OPENAPI_FILE = join(__dirname, '../../server/openapi.json');
const OUTPUT_DIR = join(__dirname, '../src');
const TYPES_FILE = join(OUTPUT_DIR, 'api-types.ts');
const SDK_FILE = join(OUTPUT_DIR, 'api-client.ts');

interface OpenAPIProperty {
  type?: string;
  $ref?: string;
  description?: string;
  enum?: string[];
  items?: OpenAPIProperty;
  properties?: Record<string, OpenAPIProperty>;
  required?: string[];
  additionalProperties?: OpenAPIProperty;
}

interface OpenAPISchema {
  type?: string;
  properties?: Record<string, OpenAPIProperty>;
  required?: string[];
  items?: OpenAPIProperty;
  enum?: string[];
  additionalProperties?: OpenAPIProperty;
}

interface OpenAPIRequestBody {
  required?: boolean;
  content?: {
    [contentType: string]: {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPIResponse {
  description: string;
  content?: {
    [contentType: string]: {
      schema: OpenAPISchema;
    };
  };
}

interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: string;
    required?: boolean;
    schema?: OpenAPISchema;
  }>;
  requestBody?: OpenAPIRequestBody;
  responses?: Record<string, OpenAPIResponse>;
}

interface OpenAPIPath {
  get?: OpenAPIOperation;
  post?: OpenAPIOperation;
  put?: OpenAPIOperation;
  delete?: OpenAPIOperation;
  patch?: OpenAPIOperation;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, OpenAPIPath>;
}

function toPascalCase(str: string): string {
  return str
    .split(/[._-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function tsTypeFromSchema(schema?: OpenAPISchema, indent = 0): string {
  if (!schema) return 'unknown';

  if (schema.enum) {
    return schema.enum.map(e => `'${e}'`).join(' | ');
  }

  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array':
      if (schema.items) {
        return `Array<${tsTypeFromSchema(schema.items, indent)}>`;
      }
      return 'Array<unknown>';
    case 'object':
      if (schema.properties) {
        const props = Object.entries(schema.properties);
        if (props.length === 0) {
          return 'Record<string, unknown>';
        }
        const indentStr = '  '.repeat(indent + 1);
        const closingIndent = '  '.repeat(indent);
        const propsStr = props.map(([key, prop]) => {
          const isRequired = schema.required?.includes(key);
          const optional = isRequired ? '' : '?';
          const type = tsTypeFromSchema(prop, indent + 1);
          const desc = prop.description ? `/** ${prop.description} */\n${indentStr}` : '';
          return `${desc}${key}${optional}: ${type};`;
        }).join(`\n${indentStr}`);
        return `{\n${indentStr}${propsStr}\n${closingIndent}}`;
      }
      if (schema.additionalProperties) {
        return `Record<string, ${tsTypeFromSchema(schema.additionalProperties, indent)}>`;
      }
      return 'Record<string, unknown>';
    default:
      return 'unknown';
  }
}

interface RouteInfo {
  path: string;
  httpMethod: string;
  operationId: string;
  summary?: string;
  description?: string;
  pathParams: Array<{ name: string; required: boolean }>;
  requestBody?: OpenAPISchema;
  responseBody?: OpenAPISchema;
}

function parseOpenAPI(spec: OpenAPISpec): RouteInfo[] {
  const routes: RouteInfo[] = [];

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [httpMethod, operation] of Object.entries(methods)) {
      if (!operation?.operationId) continue;

      const pathParams = (operation.parameters || [])
        .filter(p => p.in === 'path')
        .map(p => ({ name: p.name, required: p.required ?? true }));

      const requestBody = operation.requestBody?.content?.['application/json']?.schema;
      const responseBody = operation.responses?.['200']?.content?.['application/json']?.schema ||
                          operation.responses?.['201']?.content?.['application/json']?.schema;

      routes.push({
        path,
        httpMethod: httpMethod.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary,
        description: operation.description,
        pathParams,
        requestBody,
        responseBody,
      });
    }
  }

  return routes;
}

function buildNamespaceTree(routes: RouteInfo[]): Map<string, Map<string, RouteInfo>> {
  const tree = new Map<string, Map<string, RouteInfo>>();
  const methodNames = new Set<string>();
  const namespaceNames = new Set<string>();

  for (const route of routes) {
    const parts = route.operationId.split('.');
    const namespace = parts.length > 1 ? parts.slice(0, -1).join('.') : 'api';
    const method = parts[parts.length - 1];

    methodNames.add(route.operationId);
    if (parts.length > 1) {
      namespaceNames.add(namespace);
    }

    if (!tree.has(namespace)) {
      tree.set(namespace, new Map());
    }
    tree.get(namespace)!.set(method, route);
  }

  const conflicts: string[] = [];
  for (const method of methodNames) {
    if (namespaceNames.has(method)) {
      conflicts.push(method);
    }
  }

  if (conflicts.length > 0) {
    console.error('\n');
    console.error('╔══════════════════════════════════════════════════════════════════════════════╗');
    console.error('║                                                                              ║');
    console.error('║   ⚠️  警告：operationId 存在命名冲突！                                        ║');
    console.error('║                                                                              ║');
    console.error('║   以下 operationId 既是方法名又是命名空间，生成的代码可能存在问题：           ║');
    console.error('║                                                                              ║');
    for (const conflict of conflicts) {
      console.error(`║   - ${conflict.padEnd(72)}║`);
      console.error(`║     作为方法: ${conflict.padEnd(62)}║`);
      console.error(`║     作为命名空间: ${conflict}.*`.padEnd(77) + '║');
    }
    console.error('║                                                                              ║');
    console.error('║   建议修改 OpenAPI 规范中的 operationId 以避免冲突。                         ║');
    console.error('║                                                                              ║');
    console.error('╚══════════════════════════════════════════════════════════════════════════════╝');
    console.error('\n');
  }

  return tree;
}

function generateTypes(routes: RouteInfo[]): string {
  let code = `/**
 * 自动生成的 API 类型定义
 * 基于 OpenAPI schema 生成
 * 不要手动修改此文件
 */

`;

  for (const route of routes) {
    const typeName = toPascalCase(route.operationId);

    if (route.requestBody) {
      code += `export interface ${typeName}Request ${tsTypeFromSchema(route.requestBody, 0)}\n\n`;
    }

    if (route.responseBody) {
      code += `export interface ${typeName}Response ${tsTypeFromSchema(route.responseBody, 0)}\n\n`;
    }
  }

  return code;
}

function generateSDK(routes: RouteInfo[]): string {
  const tree = buildNamespaceTree(routes);
  const sortedNamespaces = Array.from(tree.keys()).sort();

  const nestedNamespaces = new Map<string, string[]>();
  for (const namespace of sortedNamespaces) {
    const parts = namespace.split('.');
    if (parts.length > 1) {
      const parent = parts.slice(0, -1).join('.');
      if (!nestedNamespaces.has(parent)) {
        nestedNamespaces.set(parent, []);
      }
      nestedNamespaces.get(parent)!.push(namespace);
    }
  }

  let code = `/**
 * 自动生成的 SDK 客户端
 * 基于 OpenAPI operationId 生成语义化调用链
 * 不要手动修改此文件
 */

import type {
${routes.map(r => {
  const types: string[] = [];
  const typeName = toPascalCase(r.operationId);
  if (r.requestBody) types.push(`${typeName}Request`);
  if (r.responseBody) types.push(`${typeName}Response`);
  return types.map(t => `  ${t},`).join('\n');
}).filter(Boolean).join('\n')}
} from './api-types.js';

export interface ApiClientConfig {
  baseUrl?: string;
  headers?: Record<string, string>;
}

`;

  for (const namespace of sortedNamespaces) {
    const methods = tree.get(namespace)!;
    const className = namespace.split('.').map(p => toPascalCase(p)).join('') + 'Api';

    code += `export class ${className} {\n`;
    code += `  private baseUrl: string;\n`;
    code += `  private headers: Record<string, string>;\n\n`;
    code += `  constructor(config: ApiClientConfig = {}) {\n`;
    code += `    this.baseUrl = config.baseUrl || 'http://localhost:3000';\n`;
    code += `    this.headers = {\n`;
    code += `      'Content-Type': 'application/json',\n`;
    code += `      ...config.headers,\n`;
    code += `    };\n`;
    code += `  }\n\n`;

    const children = nestedNamespaces.get(namespace) || [];
    const childPropertyNames = new Set(children.map(c => c.split('.').pop()!));

    for (const [methodName, route] of methods) {
      if (childPropertyNames.has(methodName)) continue;

      const typeName = toPascalCase(route.operationId);
      const params: string[] = [];

      for (const param of route.pathParams) {
        params.push(`${param.name}: string`);
      }

      if (route.requestBody) {
        params.push(`body: ${typeName}Request`);
      }

      const returnType = route.responseBody ? `${typeName}Response` : 'void';
      const paramStr = params.length > 0 ? params.join(', ') : '';

      code += `  /**\n`;
      if (route.summary) code += `   * ${route.summary}\n`;
      if (route.description) code += `   * ${route.description}\n`;
      code += `   */\n`;
      code += `  async ${methodName}(${paramStr}): Promise<${returnType}> {\n`;

      const pathTemplate = route.path.replace(/{(\w+)}/g, '${$1}');
      code += `    const response = await fetch(\`\${this.baseUrl}${pathTemplate}\`, {\n`;
      code += `      method: '${route.httpMethod}',\n`;
      code += `      headers: this.headers,\n`;
      if (route.requestBody) {
        code += `      body: JSON.stringify(body),\n`;
      }
      code += `    });\n\n`;
      code += `    if (!response.ok) {\n`;
      code += `      throw new Error(\`Request failed: \${response.status}\`);\n`;
      code += `    }\n\n`;
      if (route.responseBody) {
        code += `    return response.json() as Promise<${returnType}>;\n`;
      } else {
        code += `    return;\n`;
      }
      code += `  }\n\n`;
    }

    for (const child of children) {
      const childClassName = child.split('.').map(p => toPascalCase(p)).join('') + 'Api';
      const childPropertyName = child.split('.').pop()!;
      code += `  ${childPropertyName}!: ${childClassName};\n\n`;
    }

    code += `}\n\n`;
  }

  code += `export class ApiClient {\n`;
  code += `  private config: ApiClientConfig;\n`;

  const rootNamespaces = sortedNamespaces.filter(ns => !ns.includes('.'));
  for (const namespace of rootNamespaces) {
    const className = namespace.split('.').map(p => toPascalCase(p)).join('') + 'Api';
    code += `  ${namespace}: ${className};\n`;
  }

  code += `\n`;
  code += `  constructor(config: ApiClientConfig = {}) {\n`;
  code += `    this.config = config;\n`;

  for (const namespace of sortedNamespaces) {
    const className = namespace.split('.').map(p => toPascalCase(p)).join('') + 'Api';
    const parts = namespace.split('.');

    if (parts.length === 1) {
      code += `    this.${namespace} = new ${className}(config);\n`;
    } else {
      const parentParts = parts.slice(0, -1);
      const parentNamespace = parentParts.join('.');
      const propertyName = parts[parts.length - 1];
      code += `    this.${parentParts[0]}.${propertyName} = new ${className}(config);\n`;
    }
  }

  code += `  }\n`;
  code += `}\n\n`;
  code += `export const createApiClient = (config?: ApiClientConfig) => new ApiClient(config);\n`;

  return code;
}

function main() {
  console.log('读取 OpenAPI 规范:', OPENAPI_FILE);

  let openapiContent: string;
  try {
    openapiContent = readFileSync(OPENAPI_FILE, 'utf-8');
  } catch {
    console.error('\n❌ 无法读取 OpenAPI 文件:', OPENAPI_FILE);
    console.error('请先运行: cd packages/server && bun run generate:openapi');
    process.exit(1);
  }

  const spec: OpenAPISpec = JSON.parse(openapiContent);

  console.log('API 标题:', spec.info.title);
  console.log('API 版本:', spec.info.version);

  const routes = parseOpenAPI(spec);
  console.log('解析到', routes.length, '个路由');

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const typesCode = generateTypes(routes);
  writeFileSync(TYPES_FILE, typesCode);
  console.log('类型定义已生成:', TYPES_FILE);

  const sdkCode = generateSDK(routes);
  writeFileSync(SDK_FILE, sdkCode);
  console.log('SDK 已生成:', SDK_FILE);

  console.log('\n生成的 API 命名空间:');
  for (const route of routes) {
    console.log(`  ${route.operationId} -> ${route.httpMethod} ${route.path}`);
  }
}

main();

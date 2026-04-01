/**
 * 从 models.dev 拉取模型数据并按白名单过滤
 *
 * 使用方式: bun run packages/thing/scripts/fetch-models.ts
 */

const MODELS_DEV_API = "https://models.dev/api.json";

/** Provider ID 白名单 */
const PROVIDER_WHITELIST = [
  "zhipuai-coding-plan",
  // "kimi", // 如需要请取消注释
];

interface ModelData {
  id: string;
  name: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  temperature?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: {
    input: string[];
    output: string[];
  };
  open_weights?: boolean;
  cost?: {
    input?: number;
    output?: number;
    reasoning?: number;
    cache_read?: number;
    cache_write?: number;
    input_audio?: number;
    output_audio?: number;
  };
  limit?: {
    context?: number;
    input?: number;
    output?: number;
  };
}

interface ProviderData {
  id: string;
  name: string;
  env: string[];
  npm: string;
  api?: string;
  doc?: string;
  models: Record<string, ModelData>;
}

type ApiResponse = Record<string, ProviderData>;

async function fetchModels(): Promise<ApiResponse> {
  console.log("Fetching models from models.dev...");
  const response = await fetch(MODELS_DEV_API);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch models: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function filterByWhitelist(
  data: ApiResponse,
  whitelist: string[],
): ApiResponse {
  const filtered: ApiResponse = {};

  for (const providerId of whitelist) {
    if (data[providerId]) {
      filtered[providerId] = data[providerId];
      console.log(
        `✓ Included provider: ${providerId} (${Object.keys(data[providerId].models).length} models)`,
      );
    } else {
      console.warn(`✗ Provider not found: ${providerId}`);
    }
  }

  return filtered;
}

async function main() {
  try {
    // 1. 拉取数据
    const allData = await fetchModels();
    console.log(`Total providers available: ${Object.keys(allData).length}`);

    // 2. 按白名单过滤
    const filteredData = filterByWhitelist(allData, PROVIDER_WHITELIST);

    if (Object.keys(filteredData).length === 0) {
      console.error("No providers matched the whitelist!");
      process.exit(1);
    }

    // 3. 写入文件
    const outputPath = new URL("../src/providers/models.json", import.meta.url);
    await Bun.write(outputPath, JSON.stringify(filteredData, null, 2));
    console.log(`\n✓ Models written to: ${outputPath.pathname}`);

    // 4. 输出统计信息
    const totalModels = Object.values(filteredData).reduce(
      (sum, provider) => sum + Object.keys(provider.models).length,
      0,
    );
    console.log(`\nSummary:`);
    console.log(`  Providers: ${Object.keys(filteredData).length}`);
    console.log(`  Total models: ${totalModels}`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();

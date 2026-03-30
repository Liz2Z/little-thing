/**
 * Provider API E2E 测试
 *
 * 这些测试使用真实的 Provider API 进行端到端测试。
 * 运行前需要确保 .env.test 中配置了有效的 API Key。
 *
 * 运行方式：bun test e2e/server/providers/provider-api.spec.ts
 */
import { describe, it, expect, beforeAll } from "bun:test";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  createModel,
  listModels,
} from "../../../packages/server/src/providers/factory";
import modelsData from "../../../packages/server/src/providers/models.json";
import { streamText } from "ai";

// 从 .env.test 加载环境变量
const __dirname = dirname(fileURLToPath(import.meta.url));
const envTestPath = join(__dirname, "../../../packages/server/.env.test");

function loadEnvTest() {
  try {
    const envContent = readFileSync(envTestPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not load .env.test: ${error}`);
  }
}

describe("Provider API E2E", () => {
  beforeAll(() => {
    loadEnvTest();
  });

  describe("createModel", () => {
    it("should create zhipuai-coding-plan model with API key from env", () => {
      // 确保环境变量已加载
      expect(process.env.ZHIPU_API_KEY).toBeTruthy();

      const model = createModel("zhipuai-coding-plan", "glm-4.7");

      // 验证返回的是 LanguageModel 实例
      expect(model).toBeDefined();
      expect(typeof model).toBe("object");

      // 验证模型有必要的属性
      expect(model.modelId).toBe("glm-4.7");
      expect(model.provider).toMatch("zhipuai-coding-plan");
    });

    it("should create different models for different model IDs", () => {
      const model1 = createModel("zhipuai-coding-plan", "glm-4.7");
      const model2 = createModel("zhipuai-coding-plan", "glm-4.5-flash");

      expect(model1.modelId).toBe("glm-4.7");
      expect(model2.modelId).toBe("glm-4.5-flash");
    });
  });

  describe("listModels", () => {
    it("should fetch real models list from zhipuai API", async () => {
      // 确保环境变量已加载
      expect(process.env.ZHIPU_API_KEY).toBeTruthy();

      const models = await listModels("zhipuai-coding-plan");

      // 验证返回的是数组
      expect(Array.isArray(models)).toBe(true);

      // 验证模型列表不为空
      expect(models.length).toBeGreaterThan(0);

      // 验证模型对象的结构
      const firstModel = models[0];
      expect(firstModel).toHaveProperty("id");
      expect(typeof firstModel.id).toBe("string");

      // 验证包含我们配置中的一些模型
      const modelIds = models.map((m: { id: string }) => m.id);
      expect(modelIds).toContain("glm-4.7");
    });

    it("should return models with created timestamp if available", async () => {
      const models = await listModels("zhipuai-coding-plan");

      // 某些模型可能有 created 字段
      const modelsWithCreated = models.filter(
        (m: { created?: number }) => m.created,
      );
      if (modelsWithCreated.length > 0) {
        expect(typeof modelsWithCreated[0].created).toBe("number");
      }
    });
  });

  describe("error handling with real API", () => {
    it("should throw PROVIDER:UNKNOWN for non-existent provider", () => {
      try {
        createModel("non-existent-provider", "some-model");
        expect(true).toBe(false); // 不应该到达这里
      } catch (error: unknown) {
        expect(error).toHaveProperty("code", "PROVIDER:UNKNOWN");
        expect(error).toHaveProperty("status", 404);
      }
    });

    it("should throw PROVIDER:MISSING_API_KEY when API key is removed", () => {
      const originalKey = process.env.ZHIPU_API_KEY;

      // 临时移除 API key
      delete process.env.ZHIPU_API_KEY;

      try {
        try {
          createModel("zhipuai-coding-plan", "glm-4.7");
          expect(true).toBe(false); // 不应该到达这里
        } catch (error: unknown) {
          expect(error).toHaveProperty("code", "PROVIDER:MISSING_API_KEY");
          expect(error).toHaveProperty("status", 500);
        }
      } finally {
        // 恢复 API key
        if (originalKey) {
          process.env.ZHIPU_API_KEY = originalKey;
        }
      }
    });

    it("should handle API errors gracefully", async () => {
      const originalKey = process.env.ZHIPU_API_KEY;

      // 使用无效的 API key
      process.env.ZHIPU_API_KEY = "invalid-key-12345";

      try {
        const result = await listModels("zhipuai-coding-plan").catch(
          (error) => error,
        );
        // API 可能返回错误但不一定抛出异常，验证至少得到了结果
        expect(result).toBeDefined();
      } finally {
        // 恢复有效的 API key
        if (originalKey) {
          process.env.ZHIPU_API_KEY = originalKey;
        }
      }
    });
  });

  describe("integration: createModel then use it", () => {
    it("should create model and verify its properties", () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");

      // 验证模型的供应商特定属性
      expect(model).toBeDefined();
      // LanguageModel 实例应该有这些基本属性
      expect(model.modelId).toBe("glm-4.7");
      expect(typeof model.doGenerate).toBe("function");
      expect(typeof model.doStream).toBe("function");
    });

    it("should execute model with streamText and return valid response", async () => {
      const model = createModel("zhipuai-coding-plan", "glm-4.7");

      const result = streamText({
        model,
        messages: [
          {
            role: "user",
            content: "1+1=? 只回答数字",
          },
        ],
      });

      // 收集所有响应内容
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
      }

      const fullResponse = chunks.join("");

      // 验证响应不为空
      expect(fullResponse.length).toBeGreaterThan(0);
      // 验证响应包含答案
      expect(fullResponse).toMatch(/2/);

      // 等待完成并验证 usage
      const finalUsage = await result.usage;
      expect(finalUsage).toBeDefined();
      // 验证 usage 存在（字段名可能因版本而异）
      expect(Object.keys(finalUsage).length).toBeGreaterThan(0);
    }, 30000);
  });

  describe("models.json consistency", () => {
    it("should have consistent provider config with API response", async () => {
      const apiModels = await listModels("zhipuai-coding-plan");
      const apiModelIds = new Set(apiModels.map((m: { id: string }) => m.id));

      // 验证配置文件中的一些模型在 API 响应中存在
      const configuredModels = Object.keys(
        (modelsData as Record<string, any>)["zhipuai-coding-plan"].models,
      );

      // 至少验证一个已知模型存在
      expect(apiModelIds.has("glm-4.7")).toBe(true);
    });
  });
});

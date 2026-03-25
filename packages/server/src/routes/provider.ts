import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { AnthropicProvider } from "../providers/anthropic.js";
import { InternalError } from "../errors/index.js";

const app = new Hono();

app.get(
  "/models",
  describeRoute({
    operationId: "provider.models.list",
    summary: "获取可用模型列表",
    description: "从当前配置的 LLM Provider 获取可用模型列表",
    tags: ["Provider"],
    responses: {
      200: {
        description: "可用模型列表",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                models: z.array(
                  z.object({
                    id: z.string().meta({ description: "模型 ID" }),
                    name: z.string().meta({ description: "模型名称" }),
                    displayName: z.string().optional().meta({ description: "显示名称" }),
                    description: z.string().optional().meta({ description: "模型描述" }),
                    contextLength: z.number().optional().meta({ description: "上下文长度" }),
                  }),
                ),
              }),
            ),
          },
        },
      },
      401: {
        description: "未授权",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                error: z.string().meta({ description: "错误信息" }),
              }),
            ),
          },
        },
      },
      500: {
        description: "服务器错误",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                error: z.string().meta({ description: "错误信息" }),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    try {
      const provider = new AnthropicProvider();
      const models = await provider.getModels();
      return c.json(models);
    } catch (error) {
      if (error instanceof InternalError) {
        if (error.status === 401) {
          return c.json({ error: "API Key 未配置或无效" }, 401);
        }
      }
      return c.json({ error: "获取模型列表失败" }, 500);
    }
  },
);

export const providerRoutes = app;

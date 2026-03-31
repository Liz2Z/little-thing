import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { listModels } from "../providers/factory.js";

const app = new Hono();

app.get(
  "/providers/:providerId/models",
  describeRoute({
    operationId: "provider.models.listByProvider",
    summary: "获取指定 provider 的模型列表",
    description: "从指定 provider 的 API 获取可用模型列表",
    tags: ["Provider"],
    parameters: [
      {
        name: "providerId",
        in: "path",
        required: true,
        schema: { type: "string", description: "供应商 ID" },
      },
    ],
    responses: {
      200: {
        description: "可用模型列表",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                object: z.literal("list"),
                data: z.array(
                  z.object({
                    id: z.string().meta({ description: "模型 ID" }),
                    object: z.literal("model"),
                    created: z
                      .number()
                      .optional()
                      .meta({ description: "创建时间戳" }),
                    owned_by: z
                      .string()
                      .optional()
                      .meta({ description: "所有者" }),
                  }),
                ),
              }),
            ),
          },
        },
      },
    },
  }),
  async (c) => {
    const providerId = c.req.param("providerId");
    const models = await listModels(providerId);
    return c.json({
      object: "list",
      data: models,
    });
  },
);

export const providerRoutes = app;

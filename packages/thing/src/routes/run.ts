import { Hono } from "hono";
import { describeRoute, resolver } from "hono-openapi";
import { z } from "zod";
import { getSessionService } from "../app/services.js";

const app = new Hono();
const sessionService = getSessionService();

app.post(
  "/:runId/abort",
  describeRoute({
    operationId: "runs.abort",
    summary: "终止运行",
    description: "按 runId 终止 Agent 运行",
    tags: ["Agent"],
    responses: {
      200: {
        description: "终止结果",
        content: {
          "application/json": {
            schema: resolver(
              z.object({
                success: z.boolean().meta({ description: "是否成功终止" }),
              }),
            ),
          },
        },
      },
    },
  }),
  (c) => {
    const runId = c.req.param("runId");
    const success = sessionService.abort(runId);
    return c.json({ success });
  },
);

export const runRoutes = app;

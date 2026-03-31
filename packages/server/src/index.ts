import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { AppError, InternalError } from "./lib/error";

import { providerRoutes, sessionRoutes, systemRoutes } from "./routes";
// must import before other modules
import { settings } from "./settings";

function errorHandler(err: Error, c: Context) {
  if (err instanceof AppError) {
    return c.json(
      err.toJSON(),
      err.status as 200 | 400 | 401 | 403 | 404 | 408 | 429 | 500,
    );
  }

  console.error("Unhandled error:", err);

  const internalError = new InternalError(
    ["INTERNAL:UNHANDLED", 500, "服务器内部错误"] as const,
    {
      ...(process.env.NODE_ENV !== "production" && {
        stack: err.stack,
        originalMessage: err.message,
      }),
    },
  );

  return c.json(internalError.toJSON(), 500);
}

class ConfigNotLoadedError extends InternalError {
  constructor() {
    super(["CONFIG:NOT_LOADED", 500, "服务器配置未加载"] as const);
  }
}

const rawSettings = settings.get();

if (!rawSettings?.server) {
  throw new ConfigNotLoadedError();
}

const port = rawSettings.server.port;
const host = rawSettings.server.host;

const app = new Hono()
  .onError(errorHandler)
  .use(
    "/*",
    cors({
      origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:3000",
      ],
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    }),
  )
  .route("/sessions", sessionRoutes)
  .route("/system", systemRoutes)
  .route("/provider", providerRoutes);

app.get("/openapi.json", async (c) => {
  const { generateSpecs } = await import("hono-openapi");
  const specs = await generateSpecs(app);
  return c.json({
    ...specs,
    openapi: "3.1.0",
    info: {
      title: "Little Thing API",
      version: "1.0.0",
      description:
        "API for Little Thing a agent application with session management and real-time events",
    },
    servers: [
      {
        url: `http://${host}:${port}`,
        description: "Development server",
      },
    ],
  });
});

console.log(`Server running on http://${host}:${port}`);
console.log(`OpenAPI spec available at http://${host}:${port}/openapi.json`);

if (import.meta.main) {
  Bun.serve({
    port: port,
    hostname: host,
    fetch: app.fetch,
  });
}

export { app };

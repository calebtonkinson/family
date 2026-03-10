import { beforeAll, describe, expect, it } from "vitest";

let app: {
  request: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>;
};

beforeAll(async () => {
  process.env.DATABASE_URL ??= "postgresql://user:password@localhost:5432/home_test";
  const mod = await import("./app.js");
  app = mod.default;
});

describe("server app", () => {
  it("serves the health endpoint without auth", async () => {
    const response = await app.request("/health");

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
  });

  it("exposes the OpenAPI document without auth", async () => {
    const response = await app.request("/openapi.json");

    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.openapi).toBe("3.0.0");
    expect(body.info?.title).toBe("Home Management API");
  });
});

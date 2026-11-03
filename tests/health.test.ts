import { describe, test, expect, vi } from "vitest";

const db = {
  execute: vi.fn(),
};

vi.mock("../src/db/connection.js", () => ({
  getDb: vi.fn(() => db),
  default: vi.fn(() => db),
}));

import create_app from "../src/app.js";
import { TEST_ENV } from "./env.js";

const app = create_app();

const request = (path: string) => app.request(path, undefined, TEST_ENV);

describe("Home", () => {
  test("GET /", async () => {
    const response = await request("/");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({"message":{"app":"uptime-monitor","version":"1.0.0"}});
  })
})

describe("Health", () => {
  test("GET /health", async () => {
    vi.mocked(db.execute).mockResolvedValue([] as any);
    const response = await request("/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: "OK" })
  })
})

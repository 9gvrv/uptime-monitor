import { describe, test, expect } from "vitest";
import create_app from "../src/app.js";

const app = create_app();

describe("Home", () => {
  test("GET /", async () => {
    const response = await app.request("/");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({"message":{"app":"uptime-monitor","version":"1.0.0"}});
  })
})

describe("Health", () => {
  test("GET /health", async () => {
    const response = await app.request("/health")
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: "OK" })
  })
})

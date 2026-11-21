import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../src/db/connection.js";
import { checkWebsite } from "../src/lib/checkWebsite.js";
import { type Monitor, runMonitorCheck } from "../src/lib/runMonitorCheck.js";

// Keep the real module (validationSchema imports ERROR_TYPES from it) and only
// stub the network call.
vi.mock("../src/lib/checkWebsite.js", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../src/lib/checkWebsite.js")>();
  return { ...actual, checkWebsite: vi.fn() };
});

const monitor: Monitor = {
  id: 7,
  userId: 1,
  groupId: null,
  name: "Example",
  url: "https://example.com",
  isActive: true,
  intervalSeconds: 300,
  timeoutMs: 5000,
  nextCheckAt: new Date(),
  lastCheckedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const healthCheckRow = {
  id: 1,
  monitorId: monitor.id,
  status: "up" as const,
  statusCode: 200,
  finalUrl: monitor.url,
  redirectCount: 0,
  ttfbMs: 12,
  totalMs: 20,
  errorType: null,
  errorMessage: null,
  region: null as string | null,
  checkedAt: new Date(),
};

const returning = vi.fn();
const values = vi.fn(() => ({ returning }));
const where = vi.fn().mockResolvedValue([]);
const set = vi.fn(() => ({ where }));
const db = {
  insert: vi.fn(() => ({ values })),
  update: vi.fn(() => ({ set })),
} as unknown as Database;

describe("runMonitorCheck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    returning.mockResolvedValue([healthCheckRow]);
    vi.mocked(checkWebsite).mockResolvedValue({
      url: monitor.url,
      checkedAt: new Date().toISOString(),
      status: "up",
      isUp: true,
      statusCode: 200,
      finalUrl: monitor.url,
      redirectCount: 0,
      timings: { ttfbMs: 12, totalMs: 20 },
      error: null,
    });
  });

  it("saves the check and reschedules the monitor", async () => {
    const result = await runMonitorCheck(monitor, { db, region: "test" });

    expect(result).toMatchObject({ id: 1, status: "up", monitorId: 7 });
    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ monitorId: 7, region: "test" }),
    );
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCheckedAt: expect.anything(),
        nextCheckAt: expect.anything(),
      }),
    );
    expect(where).toHaveBeenCalledOnce();
  });

  it("records a null region when the caller has none", async () => {
    await runMonitorCheck(monitor, { db });

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({ region: null }),
    );
  });
});

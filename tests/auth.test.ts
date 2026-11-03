import { describe, test, expect, vi, beforeEach } from "vitest";

// db is mocked BEFORE any import of the app — vi.mock is hoisted above imports.
// Every test is deterministic: no network, no real data, reproducible forever.
vi.mock("../src/db/connection.js", () => ({
  default: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

// bcrypt is mocked so password checks are instant and completely controlled.
// JWT signing stays REAL (hono/jwt is not mocked) so /me tests exercise the
// actual sign/verify round trip.
vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

import create_app from "../src/app.js";
import db from "../src/db/connection.js";
import bcrypt from "bcrypt";
import { generateToken } from "../src/modules/auth/security.js";

const app = create_app();

const DB_USER_FOR = (email: string) => ({
  id: 1,
  email,
  passwordHash: "irrelevant-because-bcrypt-is-mocked",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
});

/** Mock `db.select().from().where().limit()` to resolve to `rows`. */
const mockSelect = (rows: unknown[]) => {
  vi.mocked(db.select).mockReturnValue({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  } as any);
};

/** Mock `db.insert().values().returning()` to resolve to `[row]`. */
const mockInsert = (row: unknown) => {
  vi.mocked(db.insert).mockReturnValue({
    values: () => ({ returning: () => Promise.resolve([row]) }),
  } as any);
};

/** Mock the insert to reject with a Postgres unique_violation (SQLSTATE 23505). */
const mockInsertUniqueViolation = (message: string) => {
  const error = Object.assign(new Error(message), { code: "23505" });
  vi.mocked(db.insert).mockReturnValue({
    values: () => ({ returning: () => Promise.reject(error) }),
  } as any);
};

/** Decode a JWT's payload section without verifying (tests only read it). */
const decodeJwtPayload = (token: string) => {
  const [, payload] = token.split(".");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json) as {
    sub: string;
    email: string;
    iat: number;
    exp: number;
  };
};

const signupRequest = (body: unknown) =>
  app.request("/api/v1/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const loginRequest = (body: unknown) =>
  app.request("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

const meRequest = (token: string | null) =>
  app.request("/api/v1/auth/me", {
    method: "GET",
    headers: token === null ? {} : { Authorization: `Bearer ${token}` },
  });

const EMAIL = "test1@gmail.com";

beforeEach(() => {
  // Wipe call history AND implementations so no test sees stale state.
  vi.resetAllMocks();
});

describe("POST /api/v1/auth/signup", () => {
  test("creates a user and returns the email (201)", async () => {
    mockSelect([]); // email not taken
    mockInsert(DB_USER_FOR(EMAIL));
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    const res = await signupRequest({
      email: EMAIL,
      password: "password123",
      confirmPassword: "password123",
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      success: true,
      statusCode: 201,
      message: "User created successfully",
      data: { email: EMAIL },
    });
  });

  test("returns the formatted validation error (400)", async () => {
    const res = await signupRequest({
      email: EMAIL,
      password: "password123",
      confirmPassword: "password456", // mismatch
    });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      success: false,
      message: "Validation failed",
      errors: [{ field: "confirmPassword", message: "Passwords do not match" }],
      data: null,
    });
  });

  test("rejects an already-registered email (409)", async () => {
    mockSelect([DB_USER_FOR(EMAIL)]); // email EXISTS

    const res = await signupRequest({
      email: EMAIL,
      password: "password123",
      confirmPassword: "password123",
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toBe("Email is already registered");
  });

  test("maps a unique-violation race on insert to 409", async () => {
    // Two concurrent signups pass the select-check simultaneously; the loser
    // must be rejected by the insert's unique constraint, not a raw 500.
    mockSelect([]);
    mockInsertUniqueViolation(
      "duplicate key value violates unique constraint ix_users_email",
    );
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed-password");

    const res = await signupRequest({
      email: EMAIL,
      password: "password123",
      confirmPassword: "password123",
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.message).toBe("Email is already registered");
  });

  test("rejects a malformed JSON body (400, not 500)", async () => {
    const res = await app.request("/api/v1/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not-json",
    });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Invalid or missing JSON Body");
  });
});

describe("POST /api/v1/auth/login", () => {
  test("logs in with valid credentials and returns a well-formed JWT (200)", async () => {
    mockSelect([DB_USER_FOR(EMAIL)]);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    const res = await loginRequest({ email: EMAIL, password: "password123" });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.email).toBe(EMAIL);
    expect(typeof body.data.token).toBe("string");

    const payload = decodeJwtPayload(body.data.token);
    expect(payload.sub).toBe("1"); // user id as `sub`
    expect(payload.email).toBe(EMAIL);
    expect(payload.exp - payload.iat).toBe(60 * 60); // exp in SECONDS, 1h TTL
  });

  test("returns a uniform 401 for an unknown email", async () => {
    mockSelect([]); // no user found

    const res = await loginRequest({ email: EMAIL, password: "password123" });

    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe("Invalid email or password");
  });

  test("returns a uniform 401 for a wrong password (no user enumeration)", async () => {
    mockSelect([DB_USER_FOR(EMAIL)]); // user exists...
    vi.mocked(bcrypt.compare).mockResolvedValue(false); // ...but password wrong

    const res = await loginRequest({ email: EMAIL, password: "wrongpassword" });

    expect(res.status).toBe(401);
    const body = await res.json();
    // must be identical to the unknown-email error so attackers can't
    // distinguish which part failed
    expect(body.message).toBe("Invalid email or password");
  });

  test("rejects a malformed email in the request (400)", async () => {
    const res = await loginRequest({ email: "not-an-email", password: "password123" });

    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("Validation failed");
  });
});

describe("GET /api/v1/auth/me", () => {
  test("returns the authenticated user for a valid token (200)", async () => {
    const token = await generateToken({ id: 1, email: EMAIL });
    mockSelect([DB_USER_FOR(EMAIL)]);

    const res = await meRequest(token);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ id: 1, email: EMAIL });
  });

  test("accepts the round trip from a real login response", async () => {
    // full round trip: login (mocked db) -> token -> /me
    mockSelect([DB_USER_FOR(EMAIL)]);
    vi.mocked(bcrypt.compare).mockResolvedValue(true);

    const login = await loginRequest({ email: EMAIL, password: "password123" });
    const { token } = (await login.json()).data;

    const res = await meRequest(token);
    expect(res.status).toBe(200);
    expect((await res.json()).data.email).toBe(EMAIL);
  });

  test("rejects a request with no Authorization header (401)", async () => {
    const res = await meRequest(null);

    expect(res.status).toBe(401);
    expect((await res.json()).message).toContain("Bearer");
  });

  test("rejects a garbage token (401)", async () => {
    const res = await meRequest("not-a-real-token");

    expect(res.status).toBe(401);
    expect((await res.json()).message).toBe("Invalid or expired token");
  });

  test("returns 404 when the token is valid but the user was deleted", async () => {
    const token = await generateToken({ id: 42, email: EMAIL });
    mockSelect([]); // row gone between issue time and verification

    const res = await meRequest(token);

    expect(res.status).toBe(404);
    expect((await res.json()).message).toBe("User not found");
  });
});

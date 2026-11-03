import { Hono } from "hono";
import { signupSchema, signupReturnSchema, loginSchema, loginReturnSchema } from "./schema.js";
import { ApiError } from "../../lib/apiError.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { hashPassword, comparePassword, generateToken } from "./security.js";
import db from "../../db/connection.js";
import { users } from "../users/schema.js";
import { eq } from "drizzle-orm";
import { readJson } from "../../lib/readJson.js";
import { isUniqueViolation, withRetry } from "../../db/dbUtils.js";
import { requireAuth, type AppEnv } from "../../middleware/auth.js";
import { logger } from "../../lib/logger.js";

const router = new Hono<AppEnv>().basePath("/auth");

router.post("/signup", async (c) => {
  // readJson itself throws a 400 ApiError on a malformed body.
  const body = await readJson(c);

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 400,
      message: "Validation failed",
      errors: [parsed.error], // the ZodError, NOT the safeParse result
    });
  }

  const { email, password } = parsed.data;

  // Wrapped + retried: a transient Neon/network failure must not become a raw
  // non-ApiError (which onError would render as a generic 500).
  const [existingUser] = await withRetry(() =>
    db.select().from(users).where(eq(users.email, email)).limit(1)
  );

  if (existingUser) {
    throw new ApiError({
      statusCode: 409,
      message: "Email is already registered",
    });
  }

  const hashedPassword = await hashPassword(password);

  try {
    const [user] = await withRetry(() =>
      db
        .insert(users)
        .values({
          email,
          passwordHash: hashedPassword,
        })
        .returning()
    );

    // The select above catches the normal case; this unique-violation check
    // covers the race where two concurrent signups pass the select at once.
    // Matched via SQLSTATE 23505 through the cause chain, not message text.
    const result = signupReturnSchema.safeParse(user);
    if (!result.success) {
      logger.error({ issues: result.error.issues }, "signup return schema mismatch");
      throw new ApiError({ statusCode: 500, message: "Signup response schema mismatch" });
    }

    return c.json(
      new ApiResponse({
        statusCode: 201,
        message: "User created successfully",
        data: result.data,
      }),
      201
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError({
        statusCode: 409,
        message: "Email is already registered",
      });
    }
    // Anything unexpected still gets logged by app.onError, but with the real
    // stack instead of being silently swallowed.
    throw error;
  }
});

router.post("/login", async (c) => {
  const body = await readJson(c);

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError({
      statusCode: 400,
      message: "Validation failed",
      errors: [parsed.error],
    });
  }

  const data = parsed.data;

  const [user] = await withRetry(() =>
    db.select().from(users).where(eq(users.email, data.email)).limit(1)
  );

  // Uniform 401 for "no such user" and "wrong password" so the endpoint
  // doesn't reveal which emails exist (previously leaked via a 404).
  if (!user) {
    throw new ApiError({
      statusCode: 401,
      message: "Invalid email or password",
    });
  }

  const isPasswordValid = await comparePassword(data.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError({
      statusCode: 401,
      message: "Invalid email or password",
    });
  }

  const token = await generateToken(user);

  // loginReturnSchema was written for { email, token }; strip the rest of the
  // row (passwordHash, timestamps) explicitly instead of spreading the user.
  const result = loginReturnSchema.safeParse({ email: user.email, token });
  if (!result.success) {
    // Should be impossible while the schema matches the code — surface it
    // loudly instead of failing silently with a generic 500.
    logger.error({ issues: result.error.issues }, "login return schema mismatch");
    throw new ApiError({ statusCode: 500, message: "Login response schema mismatch" });
  }

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Login successful",
      data: result.data,
    }),
    200
  );
});


/** GET /api/v1/auth/me — returns the currently authenticated user. */
router.get("/me", requireAuth, async (c) => {
  const { id } = c.get("user");

  const [user] = await withRetry(() =>
    db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1)
  );

  // The token is valid but the row is gone (deleted after issuing).
  if (!user) {
    throw new ApiError({
      statusCode: 404,
      message: "User not found",
    });
  }

  return c.json(
    new ApiResponse({
      statusCode: 200,
      message: "Authenticated user",
      data: user,
    }),
    200
  );
});

export default router;

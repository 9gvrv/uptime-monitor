import { Hono } from "hono";
import { logger } from "../../lib/logger.js";
import { ApiResponse } from "../../lib/apiResponse.js";
import { requireAuth, type AppEnv } from "../../middleware/auth.js";

import { getDb } from "../../db/connection.js";
import { getConfig } from "../../config.js";
import { readJson } from "../../lib/readJson.js";
import { ApiError } from "../../lib/apiError.js";
import { withRetry } from "../../db/dbUtils.js";
import { eq, and } from "drizzle-orm";
import { groups } from "./schema.js";
import { monitors } from "../monitors/schema.js";

const router = new Hono<AppEnv>();

router.get('/', requireAuth, async (c) => {
  logger.info("GET /groups");
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");
  const { page, limit } = c.req.query();
  const parsedPage = Number(page) || 1;
  const parsedLimit = Number(limit) || 10;

  const groupsData = await withRetry(() =>
    db.select()
      .from(groups)
      .where(eq(groups.userId, id))
      .offset((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
  );

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Groups",
    data: groupsData,
  }))
});

router.get("/:id/monitors", requireAuth, async (c) => {
  logger.info("GET /groups/:id/monitors");
  const db = getDb(getConfig(c.env).database_url);
  const userId = c.get("user").id;
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [group] = await withRetry(() =>
    db.select()
      .from(groups)
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, userId)
      ))
      .limit(1)
  )

  if (!group) throw new ApiError({ statusCode: 404, message: "Group not found" });

  const { page, limit } = c.req.query();
  const parsedPage = Number(page) || 1;
  const parsedLimit = Number(limit) || 10;

  const monitorsData = await withRetry(() =>
    db.select()
      .from(monitors)
      .where(and(
        eq(monitors.groupId, id),
        eq(monitors.userId, userId)
      ))
      .offset((parsedPage - 1) * parsedLimit)
      .limit(parsedLimit)
  )

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Group monitors",
    data: monitorsData,
  }))
})

router.get("/:id", requireAuth, async (c) => {
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [group] = await withRetry(() =>
    db.select()
      .from(groups)
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, c.get("user").id)
      ))
      .limit(1)
  )

  if (!group) throw new ApiError({ statusCode: 404, message: "Group not found" });

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Group",
    data: group,
  }))
})

router.post("/", requireAuth, async (c) => {
  logger.info("POST /groups");
  const db = getDb(getConfig(c.env).database_url);
  const { id } = c.get("user");

  const body = await readJson(c);

  const name = body?.name;
  const description = body?.description;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new ApiError({ statusCode: 400, message: "Name is required" });
  }
  if (name.length > 255) {
    throw new ApiError({ statusCode: 400, message: "Name must be at most 255 characters" });
  }
  if (description != null && typeof description !== "string") {
    throw new ApiError({ statusCode: 400, message: "Description must be a string" });
  }
  if (typeof description === "string" && description.length > 255) {
    throw new ApiError({ statusCode: 400, message: "Description must be at most 255 characters" });
  }

  const [group] = await withRetry(() =>
    db.insert(groups).values({
      userId: id,
      name: name.trim(),
      description: description ?? null,
    }).returning()
  )

  if (!group) throw new ApiError({ statusCode: 500, message: "Failed to create group" });

  return c.json(new ApiResponse({
    statusCode: 201,
    message: "Group created",
    data: group,
  }))
})

router.put("/:id", requireAuth, async (c) => {
  logger.info("PUT /groups/:id");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const body = await readJson(c);

  const updates: {
    name?: string;
    description?: string | null;
    updatedAt?: Date;
  } = {};

  if (body?.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new ApiError({ statusCode: 400, message: "Name is required" });
    }
    if (body.name.length > 255) {
      throw new ApiError({ statusCode: 400, message: "Name must be at most 255 characters" });
    }
    updates.name = body.name.trim();
  }

  if (body?.description !== undefined) {
    if (body.description != null && typeof body.description !== "string") {
      throw new ApiError({ statusCode: 400, message: "Description must be a string" });
    }
    if (typeof body.description === "string" && body.description.length > 255) {
      throw new ApiError({ statusCode: 400, message: "Description must be at most 255 characters" });
    }
    updates.description = body.description ?? null;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError({ statusCode: 400, message: "No fields to update" });
  }

  updates.updatedAt = new Date();

  const [result] = await withRetry(() =>
    db.update(groups)
      .set(updates)
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, c.get("user").id),
      ))
      .returning()
  )

  if (!result) throw new ApiError({ statusCode: 404, message: "Group not found" });

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Group updated",
    data: result,
  }))
})

router.delete("/:id", requireAuth, async (c) => {
  logger.info("DELETE /groups/:id");
  const db = getDb(getConfig(c.env).database_url);
  const id = Number(c.req.param("id"));

  if (!id) throw new ApiError({ statusCode: 400, message: "Missing id" });

  const [result] = await withRetry(() =>
    db.delete(groups)
      .where(and(
        eq(groups.id, id),
        eq(groups.userId, c.get("user").id),
      ))
      .returning()
  )

  if (!result) throw new ApiError({ statusCode: 404, message: "Group not found" });

  return c.json(new ApiResponse({
    statusCode: 200,
    message: "Group deleted",
    data: result,
  }))
})

export default router;

import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Local development reads the same `.dev.vars` file that `wrangler dev` uses.
// Production ops load `.env.production` explicitly, e.g.
//   ENV_FILE=.env.production pnpm db:studio
loadEnv({ path: process.env.ENV_FILE ?? ".dev.vars", quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to run drizzle-kit");
}

export default defineConfig({
  dialect: "postgresql",
  schema: ["./src/modules/**/schema.ts"],
  out: "./drizzle",
  dbCredentials: { url: databaseUrl },
  migrations: { schema: "drizzle", table: "__drizzle_migrations" },
  verbose: true,
});

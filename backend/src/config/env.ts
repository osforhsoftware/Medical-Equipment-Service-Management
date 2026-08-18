import dotenv from "dotenv";
import { existsSync } from "fs";
import { z } from "zod";
import path from "path";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(__dirname, "../../.env"),
  path.resolve(__dirname, "../../../.env"),
];
const envFile = envPaths.find((candidate) => existsSync(candidate));
dotenv.config(envFile ? { path: envFile } : undefined);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  PORT: z.string().default("4000").transform(Number),
  HOST: z.string().default("0.0.0.0"),
  BACKEND_URL: z.string().default("http://localhost:4000"),
  FRONTEND_URL: z.string().default("http://localhost:8080"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:8080"),
  DEFAULT_TENANT_ID: z.string().default("tenant_medtech_01"),
  PRIVATE_STORAGE_PATH: z.string().default("./storage/private"),
  MAX_UPLOAD_BYTES: z.string().default("10485760").transform(Number),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌  Invalid environment variables:");
  parsed.error.errors.forEach((e) => console.error(`   ${e.path.join(".")}: ${e.message}`));
  process.exit(1);
}

export const env = parsed.data;

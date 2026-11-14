import path from "node:path";
import { defineConfig } from "vitest/config";

const databaseUrl = `file:${path.join(__dirname, "prisma", "test.db")}`;

process.env.DATABASE_URL = databaseUrl;
process.env.OWNER_EMAIL = "owner@example.com";
process.env.OWNER_NAME = "Alex";
process.env.DIGEST_TO = "owner@example.com";
process.env.EMAIL_PROVIDER = "log";
process.env.EMAIL_FROM = "Cashback Hunter <hunter@localhost>";
process.env.DEAL_PROVIDER = "mock";
process.env.RAKUTEN_CLIENT_ID = "";
process.env.RAKUTEN_CLIENT_SECRET = "";
process.env.RAKUTEN_ACCESS_TOKEN = "";
process.env.RAKUTEN_USERNAME = "";
process.env.RAKUTEN_PASSWORD = "";
process.env.SMTP_HOST = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.RESEND_API_KEY = "";
process.env.MAX_DEALS = "5";
process.env.DIGEST_LEAD_DAYS = "14";
process.env.SCHEDULER_ENABLED = "false";
process.env.OWNER_TIMEZONE = "UTC";
process.env.CRON_SECRET = "";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 30000,
    env: {
      DATABASE_URL: databaseUrl,
      OWNER_EMAIL: "owner@example.com",
      OWNER_NAME: "Alex",
      DIGEST_TO: "owner@example.com",
      EMAIL_PROVIDER: "log",
      DEAL_PROVIDER: "mock",
      RAKUTEN_CLIENT_ID: "",
      RAKUTEN_CLIENT_SECRET: "",
      RAKUTEN_ACCESS_TOKEN: "",
      SMTP_HOST: "",
      RESEND_API_KEY: "",
      MAX_DEALS: "5",
      DIGEST_LEAD_DAYS: "14",
      SCHEDULER_ENABLED: "false",
      OWNER_TIMEZONE: "UTC",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

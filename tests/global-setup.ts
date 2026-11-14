import { execSync } from "node:child_process";
import path from "node:path";

export default function setup() {
  process.env.DATABASE_URL = `file:${path.join(process.cwd(), "prisma", "test.db")}`;
  execSync("npx prisma db push --skip-generate --accept-data-loss", {
    stdio: "inherit",
    env: process.env,
  });
}

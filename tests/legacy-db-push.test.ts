import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { purchaseMatchesOccurrence } from "@/lib/completion";

const repoRoot = process.cwd();
const prismaBin = path.join(repoRoot, "node_modules", ".bin", "prisma");
const tempRoot = mkdtempSync(path.join(tmpdir(), "gift-hunter-legacy-"));
const databasePath = path.join(tempRoot, "legacy.db");
const oldSchemaPath = path.join(tempRoot, "old.prisma");

function schemaWithoutPurchaseOccurrenceKey(source: string): string {
  const start = source.indexOf("model Purchase {");
  const end = source.indexOf("model SearchRun {");
  if (start < 0 || end < 0) throw new Error("Could not find the Purchase model.");
  const purchase = source.slice(start, end);
  const stripped = purchase
    .replace(/\n  \/\/\/[^\n]*\n  \/\/\/[^\n]*\n  occurrenceKey\s+String\??[^\n]*/, "")
    .replace(/\n  @@unique\(\[occasionId, occurrenceKey\]\)/, "");
  if (stripped.includes("occurrenceKey")) throw new Error("Purchase still declares occurrenceKey.");
  return source.slice(0, start) + stripped + source.slice(end);
}

function pushSchema(schemaPath: string) {
  execFileSync(prismaBin, ["db", "push", "--schema", schemaPath, "--skip-generate", "--accept-data-loss"], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: `file:${databasePath}` },
    stdio: "pipe",
    encoding: "utf8",
  });
}

describe("legacy purchase rows survive db push", () => {
  afterAll(() => {
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it("pushes a nullable occurrenceKey onto a database that already has duplicate purchases", async () => {
    const current = readFileSync(path.join(repoRoot, "prisma", "schema.prisma"), "utf8");
    writeFileSync(oldSchemaPath, schemaWithoutPurchaseOccurrenceKey(current));
    pushSchema(oldSchemaPath);

    const sqlite = new DatabaseSync(databasePath);
    const columns = sqlite.prepare("PRAGMA table_info(Purchase)").all() as { name: string }[];
    expect(columns.map((column) => column.name)).not.toContain("occurrenceKey");

    const now = "2026-06-01T00:00:00.000Z";
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.prepare('INSERT INTO "User" ("id", "email", "name", "createdAt") VALUES (?, ?, ?, ?)').run("user-1", "owner@example.com", "Alex", now);
    sqlite
      .prepare(
        'INSERT INTO "Person" ("id", "userId", "name", "relationship", "email", "likes", "dislikes", "hobbies", "defaultBudgetCents", "notes", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run("person-1", "user-1", "Maya Chen", "Sister", "", "[]", "[]", "[]", 6000, "", now, now);
    sqlite
      .prepare(
        'INSERT INTO "Occasion" ("id", "personId", "kind", "title", "date", "recurring", "notes", "status", "lastCompletedOn", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run("occasion-1", "person-1", "birthday", "Birthday", "1990-06-01T00:00:00.000Z", 1, "", "open", "2027-06-01T00:00:00.000Z", now);
    const insertPurchase = sqlite.prepare(
      'INSERT INTO "Purchase" ("id", "personId", "occasionId", "occasionTitle", "occasionKind", "occurrenceOn", "title", "priceCents", "store", "link", "purchasedOn", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    );
    insertPurchase.run(
      "purchase-1",
      "person-1",
      "occasion-1",
      "Birthday",
      "birthday",
      "2026-06-01T00:00:00.000Z",
      "First pen",
      2000,
      "REI",
      "https://example.com/first",
      "2026-06-01T00:00:00.000Z",
      "2026-06-01T00:00:00.000Z",
    );
    insertPurchase.run(
      "purchase-2",
      "person-1",
      "occasion-1",
      "Birthday",
      "birthday",
      "2027-06-01T00:00:00.000Z",
      "Second pen",
      2200,
      "REI",
      "https://example.com/second",
      "2027-06-01T00:00:00.000Z",
      "2027-06-02T00:00:00.000Z",
    );
    sqlite.close();

    expect(() => pushSchema(path.join(repoRoot, "prisma", "schema.prisma"))).not.toThrow();

    const migrated = new DatabaseSync(databasePath);
    const keyColumn = (migrated.prepare("PRAGMA table_info(Purchase)").all() as { name: string; notnull: number }[]).find(
      (column) => column.name === "occurrenceKey",
    );
    expect(keyColumn?.notnull).toBe(0);
    migrated.close();

    const client = new PrismaClient({ datasourceUrl: `file:${databasePath}` });
    try {
      const person = await client.person.findUnique({
        where: { id: "person-1" },
        include: { purchases: { orderBy: { createdAt: "asc" } }, occasions: true },
      });
      expect(person?.name).toBe("Maya Chen");
      expect(person?.purchases).toHaveLength(2);
      expect(person?.purchases.map((purchase) => purchase.title)).toEqual(["First pen", "Second pen"]);
      expect(person?.purchases.map((purchase) => purchase.occurrenceKey)).toEqual([null, null]);
      expect(purchaseMatchesOccurrence(person!.purchases[0], "occasion-1", "2026-06-01")).toBe(true);
      expect(purchaseMatchesOccurrence(person!.purchases[0], "occasion-1", "2027-06-01")).toBe(false);
      expect(purchaseMatchesOccurrence(person!.purchases[1], "occasion-1", "2027-06-01")).toBe(true);
      expect(person?.occasions[0]?.status).toBe("open");
    } finally {
      await client.$disconnect();
    }
  });
});

#!/usr/bin/env node
/**
 * Delete the local SQLite database so the next request re-seeds demo content.
 * Usage: npm run db:reset
 */
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
const files = ["iwannalearn.db", "iwannalearn.db-shm", "iwannalearn.db-wal"];

for (const file of files) {
  const target = path.join(dir, file);
  if (existsSync(target)) {
    rmSync(target);
    console.log(`removed ${file}`);
  }
}

console.log("Database reset. The next page load re-seeds the demo workspace.");

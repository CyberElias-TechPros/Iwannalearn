#!/usr/bin/env node
/**
 * Delete the local SQLite database so the next request re-seeds demo content.
 * Usage: npm run db:reset
 *
 * Note: a running dev server keeps an open handle to the old file, so restart
 * `npm run dev` afterwards. The script checks the port and says so if it finds
 * a server still listening.
 */
import { rmSync, existsSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";

const dir = path.join(process.cwd(), "data");
const files = ["iwannalearn.db", "iwannalearn.db-shm", "iwannalearn.db-wal"];

let removed = 0;
for (const file of files) {
  const target = path.join(dir, file);
  if (existsSync(target)) {
    rmSync(target);
    console.log(`removed ${file}`);
    removed += 1;
  }
}

console.log(
  removed === 0
    ? "Nothing to remove — the database is already clean."
    : `Database reset (${removed} file${removed === 1 ? "" : "s"}). The next page load re-seeds the demo workspace.`,
);

// Warn loudly if a server is still holding the deleted file: SQLite keeps
// writing to the unlinked inode, so the new database looks empty to the app.
const serverRunning = await new Promise((resolve) => {
  const socket = connect({ port: Number(process.env.PORT ?? 3000), host: "127.0.0.1" });
  socket.setTimeout(600);
  socket.on("connect", () => {
    socket.destroy();
    resolve(true);
  });
  socket.on("error", () => resolve(false));
  socket.on("timeout", () => {
    socket.destroy();
    resolve(false);
  });
});

if (serverRunning) {
  console.log("\n  ⚠  A server is still listening on port 3000.");
  console.log("     Restart `npm run dev` so it opens the fresh database.\n");
}

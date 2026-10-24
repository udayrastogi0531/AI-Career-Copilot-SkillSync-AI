/**
 * Local development runner for machines without a reachable MongoDB.
 *
 * It starts an in-memory MongoDB (mongodb-memory-server), points the API at it,
 * then boots the real server. Data is discarded on exit unless MEMORY_DB_PATH is
 * set, in which case the data directory is kept so a restart can reopen it.
 *
 * Usage: node scripts/dev-inmemory.js
 *        MEMORY_DB_PATH=/tmp/skillsync-db node scripts/dev-inmemory.js
 * Never use this for production or for data you want to keep long term.
 */
import fs from "node:fs/promises";
import { MongoMemoryServer } from "mongodb-memory-server";

const port = process.env.PORT || "5050";
const dbPath = process.env.MEMORY_DB_PATH ? String(process.env.MEMORY_DB_PATH) : "";

// mongodb-memory-server scans an existing dbPath; create it first.
if (dbPath) await fs.mkdir(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { dbName: "skillsync_local", ...(dbPath ? { dbPath } : {}) }
});

process.env.MONGODB_URI = mongod.getUri("skillsync_local");
process.env.MONGODB_URI_STANDARD = "";
process.env.PORT = port;
process.env.LATEX_ALLOW_LOCAL = process.env.LATEX_ALLOW_LOCAL || "true";

console.log(`[dev] in-memory MongoDB ready at ${process.env.MONGODB_URI}${dbPath ? ` (persistent: ${dbPath})` : ""}`);

await import("../src/server.js");

const shutdown = async (signal) => {
  console.log(`[dev] ${signal} received, stopping in-memory MongoDB`);
  try {
    await mongod.stop({ doCleanup: !dbPath });
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

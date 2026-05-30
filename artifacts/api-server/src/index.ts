import app from "./app";
import { logger } from "./lib/logger";

import fs from "fs/promises";
import path from "path";

const rawPort = process.env["PORT"] || "8080";

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Ensure storage directories exist
const dataDir = path.join(process.cwd(), "data");
await fs.mkdir(path.join(dataDir, "uploads"), { recursive: true }).catch(() => {});
await fs.mkdir(path.join(dataDir, "converted"), { recursive: true }).catch(() => {});
await fs.mkdir(path.join(dataDir, "temp"), { recursive: true }).catch(() => {});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});

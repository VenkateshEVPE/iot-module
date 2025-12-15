/**
 * Logging utility
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "../../logs");
const LOG_FILE = path.join(
  LOG_DIR,
  `concox-${new Date().toISOString().split("T")[0]}.log`
);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Console output
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  // File output
  const fileMessage = data
    ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
    : `${logMessage}\n`;

  fs.appendFileSync(LOG_FILE, fileMessage, "utf8");
}

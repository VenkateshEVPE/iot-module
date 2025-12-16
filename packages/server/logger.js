/**
 * Logging utility
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "../../logs");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Get the log file path for the current date
 * Creates a new file name each day: concox-YYYY-MM-DD.log
 */
function getLogFile() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `concox-${today}.log`);
}

export function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Console output
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  // File output - calculate log file dynamically for daily rotation
  const logFile = getLogFile();
  const fileMessage = data
    ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
    : `${logMessage}\n`;

  fs.appendFileSync(logFile, fileMessage, "utf8");
}

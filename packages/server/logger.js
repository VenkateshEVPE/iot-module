/**
 * Logging utility
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE_LOGGING_ENABLED =
  String(process.env.CONCOX_FILE_LOGGING || "false").toLowerCase() === "true";
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "../../logs");
const LOG_RETENTION_DAYS = Number.parseInt(
  process.env.CONCOX_LOG_RETENTION_DAYS || "7",
  10,
);
let lastCleanupDate = null;

// Ensure log directory exists only when file logging is enabled.
if (FILE_LOGGING_ENABLED && !fs.existsSync(LOG_DIR)) {
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

function cleanupOldLogs() {
  const today = new Date().toISOString().split("T")[0];
  if (lastCleanupDate === today) {
    return;
  }

  lastCleanupDate = today;

  try {
    const retention = Number.isNaN(LOG_RETENTION_DAYS)
      ? 7
      : Math.max(LOG_RETENTION_DAYS, 1);
    const files = fs
      .readdirSync(LOG_DIR)
      .filter((file) => /^concox-\d{4}-\d{2}-\d{2}\.log$/.test(file))
      .sort();

    if (files.length <= retention) {
      return;
    }

    const filesToDelete = files.slice(0, files.length - retention);
    for (const fileName of filesToDelete) {
      fs.unlinkSync(path.join(LOG_DIR, fileName));
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Failed to cleanup old logs`, {
      error: error.message,
    });
  }
}

export function log(message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;

  // Console output
  console.log(logMessage);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }

  if (FILE_LOGGING_ENABLED) {
    cleanupOldLogs();

    // File output - calculate log file dynamically for daily rotation
    const logFile = getLogFile();
    const fileMessage = data
      ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
      : `${logMessage}\n`;

    fs.appendFileSync(logFile, fileMessage, "utf8");
  }
}

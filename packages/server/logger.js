/**
 * Logging utility — paths and file logging are configured via .env (see below).
 *
 * CONCOX_FILE_LOGGING=true|false  — write daily concox-YYYY-MM-DD.log files
 * LOG_DIR=./logs                  — relative to process.cwd() (host app root), not node_modules
 * CONCOX_LOG_RETENTION_DAYS=7     — days of concox-*.log files to keep
 * CONCOX_LOG_TO_CONSOLE=true|false — print library log() to stdout (default true). Set false when
 *                                    the host app also logs the same traffic to avoid duplicate lines.
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

function resolveLogDir() {
  const cwd = process.cwd();
  const raw = process.env.LOG_DIR?.trim();
  if (!raw) {
    return path.join(cwd, "logs");
  }
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, raw);
}

const LOG_DIR = resolveLogDir();
process.env.LOG_DIR = LOG_DIR;

const FILE_LOGGING_ENABLED =
  String(process.env.CONCOX_FILE_LOGGING || "false").toLowerCase() === "true";
const LOG_TO_CONSOLE =
  String(process.env.CONCOX_LOG_TO_CONSOLE ?? "true").toLowerCase() !== "false";
const LOG_RETENTION_DAYS = Number.parseInt(
  process.env.CONCOX_LOG_RETENTION_DAYS || "7",
  10,
);
let lastCleanupDate = null;

if (FILE_LOGGING_ENABLED && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Resolved absolute log directory (also set on process.env.LOG_DIR).
 */
export function getLogDir() {
  return LOG_DIR;
}

export function isFileLoggingEnabled() {
  return FILE_LOGGING_ENABLED;
}

export function isLogToConsoleEnabled() {
  return LOG_TO_CONSOLE;
}

function getLogFile() {
  const today = new Date().toISOString().split("T")[0];
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

  if (LOG_TO_CONSOLE) {
    console.log(logMessage);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }
  }

  if (FILE_LOGGING_ENABLED) {
    cleanupOldLogs();

    const logFile = getLogFile();
    const fileMessage = data
      ? `${logMessage}\n${JSON.stringify(data, null, 2)}\n`
      : `${logMessage}\n`;

    fs.appendFileSync(logFile, fileMessage, "utf8");
  }
}

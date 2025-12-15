/**
 * Server entry point
 */

import ConcoxV5Server from "./index.js";
import { setupAPI } from "./api.js";
import { log } from "./logger.js";
import dotenv from "dotenv";

dotenv.config();

const server = new ConcoxV5Server();
const API_PORT = process.env.API_PORT || 3000;

server.start().then(() => {
  // Start HTTP API server
  setupAPI(server, API_PORT);
}).catch((error) => {
  console.error("Failed to start Concox V5 Server:", error);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  log("SIGTERM received, shutting down...");
  server.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  log("SIGINT received, shutting down...");
  server.stop();
  process.exit(0);
});

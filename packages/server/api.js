/**
 * HTTP API Server for Concox V5 Server
 * Provides REST endpoints for device control and monitoring
 */

import express from "express";
import { log } from "./logger.js";

/**
 * Setup HTTP API for Concox server
 * @param {ConcoxV5Server} server - Concox server instance
 * @param {number} port - API server port (default: 3000)
 * @returns {express.Application} Express app instance
 */
export function setupAPI(server, port = 3000) {
  const app = express();
  app.use(express.json());

  // Enable CORS
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      tcpPort: process.env.CONCOX_PORT || 5027,
      connectedDevices: server.clients.size,
    });
  });

  // Get all connected devices
  app.get("/api/devices", (req, res) => {
    try {
      const devices = Array.from(server.clients.entries()).map(
        ([imei, client]) => ({
          imei,
          connectedAt: client.connectedAt,
          address: client.clientInfo.address,
          port: client.clientInfo.port,
          connectionId: client.clientInfo.id,
        })
      );

      res.json({
        success: true,
        count: devices.length,
        devices,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get specific device info
  app.get("/api/devices/:imei", (req, res) => {
    try {
      const { imei } = req.params;
      const client = server.clients.get(imei);

      if (!client) {
        return res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }

      res.json({
        success: true,
        device: {
          imei,
          connectedAt: client.connectedAt,
          address: client.clientInfo.address,
          port: client.clientInfo.port,
          connectionId: client.clientInfo.id,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Immobilize vehicle (cut fuel/electricity)
  app.post("/api/devices/:imei/immobilize", (req, res) => {
    try {
      const { imei } = req.params;
      const success = server.immobilizeVehicle(imei);

      if (success) {
        log(`🌐 API: Immobilize request for ${imei}`);
        res.json({
          success: true,
          message: "Vehicle immobilized (fuel/electricity cut)",
          imei,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Mobilize vehicle (restore fuel/electricity)
  app.post("/api/devices/:imei/mobilize", (req, res) => {
    try {
      const { imei } = req.params;
      const success = server.mobilizeVehicle(imei);

      if (success) {
        log(`🌐 API: Mobilize request for ${imei}`);
        res.json({
          success: true,
          message: "Vehicle mobilized (fuel/electricity restored)",
          imei,
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Request device status
  app.post("/api/devices/:imei/status", (req, res) => {
    try {
      const { imei } = req.params;
      const success = server.requestDeviceStatus(imei);

      if (success) {
        log(`🌐 API: Status request for ${imei}`);
        res.json({
          success: true,
          message: "Status request sent to device",
          imei,
          note: "Check logs for device response",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Send custom command
  app.post("/api/devices/:imei/command", (req, res) => {
    try {
      const { imei } = req.params;
      const { command } = req.body;

      if (!command) {
        return res.status(400).json({
          success: false,
          error: "Command is required",
        });
      }

      const success = server.sendCommand(imei, command);

      if (success) {
        log(`🌐 API: Command sent to ${imei}: ${command}`);
        res.json({
          success: true,
          message: "Command sent to device",
          imei,
          command,
          note: "Check logs for device response",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Request location (WHERE command)
  app.post("/api/devices/:imei/location", (req, res) => {
    try {
      const { imei } = req.params;
      const success = server.sendCommand(imei, "WHERE#");

      if (success) {
        log(`🌐 API: Location request for ${imei}`);
        res.json({
          success: true,
          message: "Location request sent to device",
          imei,
          note: "Check logs for GPS location response",
        });
      } else {
        res.status(404).json({
          success: false,
          error: "Device not connected",
          imei,
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Get server statistics
  app.get("/api/stats", (req, res) => {
    try {
      res.json({
        success: true,
        stats: {
          connectedDevices: server.clients.size,
          tcpPort: process.env.CONCOX_PORT || 5027,
          apiPort: port,
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  // Start the API server
  app.listen(port, () => {
    log(`🌐 HTTP API server started on port ${port}`);
    log(`📡 API endpoints available at http://localhost:${port}/api`);
  });

  return app;
}

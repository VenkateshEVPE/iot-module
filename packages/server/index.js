/**
 * Concox V5 TCP Server
 * Complete implementation with all protocol handlers
 */

import net from "net";
import dotenv from "dotenv";
import { parsePacket, getProtocolName, PROTOCOL_NUMBERS } from "@concox/shared";

// Protocol handlers
import { parseLogin, createLoginAck } from "@concox/protocols/login.js";
import {
  parseHeartbeat,
  createHeartbeatAck,
} from "@concox/protocols/heartbeat.js";
import { parseGPSLocation } from "@concox/protocols/gps.js";
import { parseAlarm, createAlarmAck } from "@concox/protocols/alarm.js";
import {
  parseLBSAlarm,
  createLBSAlarmAck,
} from "@concox/protocols/lbs-alarm.js";
import { parseLBSExtension } from "@concox/protocols/lbs-extension.js";
import { parseWiFi, createWiFiResponse } from "@concox/protocols/wifi.js";
import { parseCommandResponse } from "@concox/protocols/command-response.js";
import { parseCommandResponseJM01 } from "@concox/protocols/command-response-jm01.js";
import {
  parseAlarmHVT001,
  createAlarmHVT001Ack,
} from "@concox/protocols/alarm-hvt001.js";
import {
  parseExternalDeviceTransfer,
  createExternalDeviceResponse,
} from "@concox/protocols/external-device.js";
import {
  parseExternalModuleTransmission,
  createExternalModuleResponse,
} from "@concox/protocols/external-module.js";
import {
  parseFileTransfer,
  createFileTransferAck,
} from "@concox/protocols/file-transfer.js";
import {
  parseTimeCalibration,
  createTimeCalibrationResponse,
} from "@concox/protocols/time-calibration.js";
import { parseInformationTransmission } from "@concox/protocols/information-transmission.js";
import { calculateCRCITU } from "@concox/shared";
import { log } from "./logger.js";

dotenv.config();

const PORT = process.env.CONCOX_PORT || 5027;

class ConcoxV5Server {
  constructor() {
    this.server = null;
    this.clients = new Map(); // Map of device IMEI to socket info
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.handleConnection(socket);
      });

      this.server.on("error", (error) => {
        console.error("Concox TCP Server error:", error);
        reject(error);
      });

      this.server.listen(PORT, () => {
        log(`📡 Concox V5 Server started on port ${PORT}`);
        resolve();
      });
    });
  }

  handleConnection(socket) {
    const clientInfo = {
      address: socket.remoteAddress,
      port: socket.remotePort,
      id: `${socket.remoteAddress}:${socket.remotePort}`,
    };

    log(`🔌 New connection from ${clientInfo.id}`);

    socket.deviceImei = null;
    let buffer = Buffer.alloc(0);

    socket.on("data", (data) => {
      buffer = Buffer.concat([buffer, data]);

      while (buffer.length > 0) {
        const result = parsePacket(buffer);

        if (!result) {
          break;
        }

        const { packet, protocolNumber, remaining } = result;
        buffer = remaining;

        this.handlePacket(socket, packet, protocolNumber, clientInfo);
      }
    });

    socket.on("error", (error) => {
      log(`❌ Connection error from ${clientInfo.id}: ${error.message}`);
    });

    socket.on("close", () => {
      log(
        `🔌 Connection closed: ${clientInfo.id}${
          socket.deviceImei ? ` (IMEI: ${socket.deviceImei})` : ""
        }`
      );
      if (socket.deviceImei) {
        this.clients.delete(socket.deviceImei);
      }
    });
  }

  handlePacket(socket, packet, protocolNumber, clientInfo) {
    if (!packet) return;

    const packetHex = packet.toString("hex").toUpperCase();
    const protocolName = getProtocolName(protocolNumber);

    const packetInfo = {
      protocol: `0x${protocolNumber
        .toString(16)
        .padStart(2, "0")
        .toUpperCase()}`,
      protocolName: protocolName,
      length: packet.length,
      rawHex: packetHex,
    };

    log(
      `📦 Received packet from ${socket.deviceImei || clientInfo.id}`,
      packetInfo
    );

    // Debug: Log all protocol numbers to catch any unhandled command responses
    if (protocolNumber === 0x21 || protocolNumber === 0x15) {
      log(
        `🔍 DEBUG: Command response protocol detected: 0x${protocolNumber
          .toString(16)
          .padStart(2, "0")
          .toUpperCase()}`
      );
    }

    try {
      switch (protocolNumber) {
        case PROTOCOL_NUMBERS.LOGIN:
          this.handleLogin(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.HEARTBEAT:
          this.handleHeartbeat(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.GPS_LOCATION:
          this.handleGPSLocation(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.ALARM:
          this.handleAlarm(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.LBS_ALARM:
          this.handleLBSAlarm(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.LBS_EXTENSION:
          this.handleLBSExtension(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.WIFI:
          this.handleWiFi(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.COMMAND_RESPONSE:
          this.handleCommandResponse(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.COMMAND_RESPONSE_JM01:
          this.handleCommandResponseJM01(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.ALARM_HVT001:
          this.handleAlarmHVT001(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.EXTERNAL_DEVICE_TRANSFER:
          this.handleExternalDeviceTransfer(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.EXTERNAL_MODULE_TRANSMISSION:
          this.handleExternalModuleTransmission(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.LARGE_FILE_TRANSFER:
          this.handleFileTransfer(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.TIME_CALIBRATION:
          this.handleTimeCalibration(socket, packet, clientInfo);
          break;
        case PROTOCOL_NUMBERS.INFORMATION_TRANSMISSION:
          this.handleInformationTransmission(socket, packet, clientInfo);
          break;
        default:
          log(`❓ Unknown protocol number: 0x${protocolNumber.toString(16)}`, {
            imei: socket.deviceImei || "unknown",
            ...packetInfo,
          });
      }
    } catch (error) {
      log(`❌ Error handling packet: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
        stack: error.stack,
        ...packetInfo,
      });
    }
  }

  handleLogin(socket, packet, clientInfo) {
    const { imei, serialNumber } = parseLogin(packet);

    log(`🔐 Login packet`, {
      imei,
      client: clientInfo.id,
      serialNumber: `0x${serialNumber
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()}`,
    });

    socket.deviceImei = imei;
    this.clients.set(imei, {
      socket: socket,
      clientInfo: clientInfo,
      connectedAt: new Date().toISOString(),
      lastBatteryVoltage: null, // Vehicle battery voltage (from 0x94, sub-protocol 0x00)
      lastBatteryVoltageAt: null,
    });

    const ack = createLoginAck(serialNumber);
    socket.write(ack);

    log(`✅ Login acknowledged`, {
      imei,
      ackHex: ack.toString("hex").toUpperCase(),
    });
  }

  handleHeartbeat(socket, packet, clientInfo) {
    const data = parseHeartbeat(packet);
    const batteryLevels = [
      "No Power",
      "Extremely Low",
      "Very Low",
      "Low",
      "Medium",
      "High",
      "Full",
    ];
    const signalLevels = [
      "No Signal",
      "Extremely Weak",
      "Weak",
      "Good",
      "Strong",
    ];

    log(`💓 Heartbeat`, {
      imei: socket.deviceImei || "unknown",
      battery:
        batteryLevels[data.batteryLevel] || `Unknown (${data.batteryLevel})`,
      signal: signalLevels[data.gsmSignal] || `Unknown (${data.gsmSignal})`,
      ...data.info,
      oilElectricityStatus: data.info.oilElectricityDisconnected
        ? "IMMOBILIZED (Cut Off)"
        : "MOBILIZED (Connected)",
    });

    const ack = createHeartbeatAck(data.serialNumber);
    socket.write(ack);
  }

  handleGPSLocation(socket, packet, clientInfo) {
    try {
      const data = parseGPSLocation(packet);
      const uploadModes = {
        0x00: "Time Interval",
        0x01: "Distance Interval",
        0x02: "Inflection Point",
        0x03: "ACC Status",
        0x04: "Re-upload Last GPS",
        0x05: "Network Recovery",
        0x06: "Update Ephemeris",
        0x07: "Side Key Triggered",
        0x08: "Power On",
        0x0a: "Static Update",
        0x0d: "Static Location",
        0x0e: "GPS Dup Upload",
      };

      const locationData = {
        imei: socket.deviceImei || "unknown",
        timestamp: `${data.datetime.year}-${String(
          data.datetime.month
        ).padStart(2, "0")}-${String(data.datetime.day).padStart(
          2,
          "0"
        )} ${String(data.datetime.hour).padStart(2, "0")}:${String(
          data.datetime.minute
        ).padStart(2, "0")}:${String(data.datetime.second).padStart(2, "0")}`,
        latitude: data.latitude.toFixed(6),
        longitude: data.longitude.toFixed(6),
        speed: data.speed,
        course: data.course,
        satellites: data.satellites,
        positioned: data.gpsPositioned,
        lbs: data.lbs,
      };

      if (data.mileage !== null) {
        locationData.mileage_meters = data.mileage;
        locationData.mileage_km = (data.mileage / 1000).toFixed(2);
      }
      if (data.acc !== null) {
        locationData.acc = data.acc === 0x01 ? "High (On)" : "Low (Off)";
      }
      if (data.dataUploadMode !== null) {
        locationData.uploadMode =
          uploadModes[data.dataUploadMode] ||
          `Unknown (0x${data.dataUploadMode.toString(16)})`;
      }

      log(`📍 GPS Location`, locationData);
    } catch (error) {
      log(`❌ Error parsing GPS location: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
        stack: error.stack,
      });
    }
  }

  handleAlarm(socket, packet, clientInfo) {
    try {
      const data = parseAlarm(packet);
      log(`🚨 Alarm`, {
        imei: socket.deviceImei || "unknown",
        alarmType: data.alarmType,
        timestamp: `${data.datetime.year}-${String(
          data.datetime.month
        ).padStart(2, "0")}-${String(data.datetime.day).padStart(
          2,
          "0"
        )} ${String(data.datetime.hour).padStart(2, "0")}:${String(
          data.datetime.minute
        ).padStart(2, "0")}:${String(data.datetime.second).padStart(2, "0")}`,
      });

      const ack = createAlarmAck(data.serialNumber);
      socket.write(ack);
    } catch (error) {
      log(`❌ Error parsing alarm: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
      });
    }
  }

  handleLBSAlarm(socket, packet, clientInfo) {
    try {
      const data = parseLBSAlarm(packet);
      log(`📡 LBS Alarm`, {
        imei: socket.deviceImei || "unknown",
        ...data,
      });

      const ack = createLBSAlarmAck(data.serialNumber);
      socket.write(ack);
    } catch (error) {
      log(`❌ Error parsing LBS alarm: ${error.message}`);
    }
  }

  handleLBSExtension(socket, packet, clientInfo) {
    try {
      const data = parseLBSExtension(packet);
      log(`📡 LBS Extension`, {
        imei: socket.deviceImei || "unknown",
        ...data,
      });
    } catch (error) {
      log(`❌ Error parsing LBS extension: ${error.message}`);
    }
  }

  handleWiFi(socket, packet, clientInfo) {
    try {
      const data = parseWiFi(packet);
      log(`📶 WiFi Packet`, {
        imei: socket.deviceImei || "unknown",
        ...data,
      });

      const response = createWiFiResponse(data.serialNumber);
      socket.write(response);
    } catch (error) {
      log(`❌ Error parsing WiFi: ${error.message}`);
    }
  }

  handleCommandResponse(socket, packet, clientInfo) {
    try {
      const data = parseCommandResponse(packet);
      const imei = socket.deviceImei || "unknown";
      const responseTime = Date.now();

      // Check if this matches a pending command
      let matchedCommand = null;
      if (socket.pendingCommands) {
        matchedCommand = socket.pendingCommands.get(data.serialNumber);
        if (matchedCommand) {
          const responseDelay = responseTime - matchedCommand.sentAt;
          socket.pendingCommands.delete(data.serialNumber);
          log(`📨 Command Response (0x21) - Matched!`, {
            imei: imei,
            originalCommand: matchedCommand.command,
            response: data.response,
            serverFlag: data.serverFlag,
            serialNumber: data.serialNumber,
            responseDelayMs: responseDelay,
            rawResponse: data.response,
          });
        }
      }

      if (!matchedCommand) {
        log(`📨 Command Response (0x21)`, {
          imei: imei,
          response: data.response,
          serverFlag: data.serverFlag,
          serialNumber: data.serialNumber,
          rawResponse: data.response,
          note: "No matching pending command found",
        });
      }

      // Check if response indicates success or failure
      const responseUpper = data.response.toUpperCase();
      if (
        responseUpper.includes("OK") ||
        responseUpper.includes("SUCCESS") ||
        responseUpper.includes("RELAY")
      ) {
        log(`✅ Command executed successfully: ${data.response}`);
      } else if (
        responseUpper.includes("ERROR") ||
        responseUpper.includes("FAIL") ||
        responseUpper.includes("INVALID")
      ) {
        log(`❌ Command failed: ${data.response}`);
      } else {
        log(`ℹ️ Command response received: ${data.response}`);
      }
    } catch (error) {
      log(`❌ Error parsing command response: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
        hex: packet.toString("hex").toUpperCase(),
      });
    }
  }

  handleCommandResponseJM01(socket, packet, clientInfo) {
    try {
      const data = parseCommandResponseJM01(packet);
      const imei = socket.deviceImei || "unknown";
      const responseTime = Date.now();

      // Check if this matches a pending command
      let matchedCommand = null;
      if (socket.pendingCommands) {
        matchedCommand = socket.pendingCommands.get(data.serialNumber);
        if (matchedCommand) {
          const responseDelay = responseTime - matchedCommand.sentAt;
          socket.pendingCommands.delete(data.serialNumber);
          log(`📨 Command Response (JM01 - 0x15) - Matched!`, {
            imei: imei,
            originalCommand: matchedCommand.command,
            response: data.response,
            serialNumber: data.serialNumber,
            responseDelayMs: responseDelay,
            rawResponse: data.response,
          });
        }
      }

      if (!matchedCommand) {
        log(`📨 Command Response (JM01 - 0x15)`, {
          imei: imei,
          response: data.response,
          serialNumber: data.serialNumber,
          rawResponse: data.response,
          note: "No matching pending command found",
        });
      }

      // Check if response indicates success or failure
      const responseUpper = data.response.toUpperCase();
      if (
        responseUpper.includes("OK") ||
        responseUpper.includes("SUCCESS") ||
        responseUpper.includes("RELAY")
      ) {
        log(`✅ Command executed successfully: ${data.response}`);
      } else if (
        responseUpper.includes("ERROR") ||
        responseUpper.includes("FAIL") ||
        responseUpper.includes("INVALID")
      ) {
        log(`❌ Command failed: ${data.response}`);
      } else {
        log(`ℹ️ Command response received: ${data.response}`);
      }
    } catch (error) {
      log(`❌ Error parsing JM01 command response: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
        hex: packet.toString("hex").toUpperCase(),
      });
    }
  }

  handleAlarmHVT001(socket, packet, clientInfo) {
    try {
      const data = parseAlarmHVT001(packet);
      log(`🚨 Alarm (HVT001)`, {
        imei: socket.deviceImei || "unknown",
        ...data,
      });

      const ack = createAlarmHVT001Ack(data.serialNumber);
      socket.write(ack);
    } catch (error) {
      log(`❌ Error parsing HVT001 alarm: ${error.message}`);
    }
  }

  handleExternalDeviceTransfer(socket, packet, clientInfo) {
    try {
      const data = parseExternalDeviceTransfer(packet);
      log(`🔌 External Device Transfer (X3)`, {
        imei: socket.deviceImei || "unknown",
        dataLength: data.dataLength,
        transparentData: data.transparentData,
      });

      // Optionally send response data back
      const response = createExternalDeviceResponse(data.serialNumber);
      socket.write(response);
    } catch (error) {
      log(`❌ Error parsing external device transfer: ${error.message}`);
    }
  }

  handleExternalModuleTransmission(socket, packet, clientInfo) {
    try {
      const data = parseExternalModuleTransmission(packet);
      log(`🔌 External Module Transmission (U20)`, {
        imei: socket.deviceImei || "unknown",
        moduleId: data.moduleId,
        dataLength: data.dataLength,
        transparentData: data.transparentData,
      });

      const response = createExternalModuleResponse(
        data.serialNumber,
        data.moduleId
      );
      socket.write(response);
    } catch (error) {
      log(`❌ Error parsing external module transmission: ${error.message}`);
    }
  }

  handleFileTransfer(socket, packet, clientInfo) {
    try {
      const data = parseFileTransfer(packet);
      log(`📁 File Transfer (HVT001)`, {
        imei: socket.deviceImei || "unknown",
        fileType: data.fileType,
        fileLength: data.fileLength,
        progress: data.progress,
        isComplete: data.isComplete,
      });

      // TODO: Store file chunks and reconstruct complete file
      const ack = createFileTransferAck(data.serialNumber, true);
      socket.write(ack);
    } catch (error) {
      log(`❌ Error parsing file transfer: ${error.message}`);
    }
  }

  handleTimeCalibration(socket, packet, clientInfo) {
    const { serialNumber } = parseTimeCalibration(packet);
    log(`🕐 Time Calibration Request`, {
      imei: socket.deviceImei || "unknown",
    });

    const now = new Date();
    const ack = createTimeCalibrationResponse(serialNumber, now);
    socket.write(ack);

    log(`✅ Time response sent`, {
      imei: socket.deviceImei || "unknown",
      time: now.toISOString(),
    });
  }

  handleInformationTransmission(socket, packet, clientInfo) {
    try {
      const data = parseInformationTransmission(packet);
      const imei = socket.deviceImei || "unknown";

      // Sub-protocol 0x00 = External Power Voltage (Vehicle Battery)
      if (
        data.subProtocol === 0x00 &&
        data.data &&
        data.data.type === "voltage"
      ) {
        const voltage = data.data.voltage;
        const status =
          voltage >= 12.0
            ? "Good"
            : voltage >= 11.5
            ? "Low"
            : voltage >= 10.5
            ? "Critical"
            : "Very Low";

        // Store battery voltage in client data
        const clientData = this.clients.get(imei);
        if (clientData) {
          clientData.lastBatteryVoltage = voltage;
          clientData.lastBatteryVoltageAt = new Date().toISOString();
        }

        log(`🔋 Vehicle Battery Voltage`, {
          imei,
          voltage: `${voltage.toFixed(2)}V`,
          status,
          rawHex: packet
            .slice(packet[0] === 0x79 ? 6 : 5, packet[0] === 0x79 ? 8 : 7)
            .toString("hex")
            .toUpperCase(),
        });

        return;
      }

      // Handle other sub-protocols
      log(`📊 Information Transmission`, {
        imei,
        subProtocol: `0x${data.subProtocol.toString(16).padStart(2, "0")}`,
        ...data.data,
      });
    } catch (error) {
      log(`❌ Error parsing information transmission: ${error.message}`);
    }
  }

  sendCommand(imei, command) {
    const clientData = this.clients.get(imei);
    if (!clientData) {
      log(`❌ Device ${imei} not connected`);
      return false;
    }

    const socket = clientData.socket;
    const commandBytes = Buffer.from(command, "ascii");
    const serverFlag = Buffer.from([0x00, 0x00, 0x00, 0x00]);
    const language = Buffer.from([0x00, 0x02]); // English
    const serialNumber = Math.floor(Math.random() * 65535);

    // commandLength = ServerFlag(4) + Command(N) + Language(2)
    const commandLength = 4 + commandBytes.length + 2;

    // packetLength = Protocol(1) + CommandLength(1) + CommandContent + Serial(2) + CRC(2)
    const packetLength = 1 + 1 + commandLength + 2 + 2;

    let packet;
    if (packetLength < 256) {
      // Build the complete packet BEFORE calculating CRC
      const buffer = Buffer.from([
        0x78,
        0x78, // Start
        packetLength, // Length byte
        0x80, // Protocol: Online Command
        commandLength, // Command length
      ]);

      // Concatenate all data that goes BEFORE CRC
      const dataBeforeCRC = Buffer.concat([
        buffer,
        serverFlag, // 4 bytes
        commandBytes, // N bytes
        language, // 2 bytes
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff]), // 2 bytes
      ]);

      // Calculate CRC from Length byte to Serial Number (indices 2 to end)
      const crc = calculateCRCITU(dataBeforeCRC, 2, dataBeforeCRC.length);

      // Build final packet
      packet = Buffer.concat([
        dataBeforeCRC,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a]),
      ]);
    } else {
      // Long packet (0x79 0x79) - for commands > ~240 chars
      const buffer = Buffer.from([
        0x79,
        0x79, // Start
        (packetLength >> 8) & 0xff,
        packetLength & 0xff, // Length (2 bytes)
        0x80, // Protocol
        commandLength, // Command length
      ]);

      const dataBeforeCRC = Buffer.concat([
        buffer,
        serverFlag,
        commandBytes,
        language,
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff]),
      ]);

      // For long packets, CRC starts at index 2 (after 0x79 0x79)
      const crc = calculateCRCITU(dataBeforeCRC, 2, dataBeforeCRC.length);

      packet = Buffer.concat([
        dataBeforeCRC,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a]),
      ]);
    }

    socket.write(packet);
    const commandSentTime = Date.now();

    log(`📤 Sent command to ${imei}`, {
      command: command,
      hex: packet.toString("hex").toUpperCase(),
      protocol: "0x80",
      serialNumber: `0x${serialNumber
        .toString(16)
        .padStart(4, "0")
        .toUpperCase()}`,
      packetLength: packet.length,
      note: "Waiting for device response (protocol 0x21 or 0x15)",
    });

    // Store command info for tracking responses
    if (!socket.pendingCommands) {
      socket.pendingCommands = new Map();
    }
    socket.pendingCommands.set(serialNumber, {
      command: command,
      sentAt: commandSentTime,
      imei: imei,
    });

    // Clean up old pending commands after 60 seconds
    setTimeout(() => {
      if (socket.pendingCommands && socket.pendingCommands.has(serialNumber)) {
        log(`⏱️ Command timeout - no response received`, {
          imei: imei,
          command: command,
          serialNumber: `0x${serialNumber.toString(16).padStart(4, "0")}`,
        });
        socket.pendingCommands.delete(serialNumber);
      }
    }, 60000);

    return true;
  }

  mobilizeVehicle(imei) {
    return this.sendCommand(imei, "RELAY,0#");
  }

  immobilizeVehicle(imei) {
    return this.sendCommand(imei, "RELAY,1#");
  }

  requestDeviceStatus(imei) {
    return this.sendCommand(imei, "STATUS#");
  }

  /**
   * Request vehicle battery voltage from device
   * Sends BATPARAM,0# command to request battery voltage
   * @param {string} imei - Device IMEI
   * @returns {boolean} True if command sent successfully
   */
  requestBatteryVoltage(imei) {
    log(`📤 Requesting vehicle battery voltage from ${imei}`);
    return this.sendCommand(imei, "BATPARAM,0#");
  }

  /**
   * Request all device parameters (includes battery voltage)
   * Sends PARAM# command to request all device parameters
   * @param {string} imei - Device IMEI
   * @returns {boolean} True if command sent successfully
   */
  requestDeviceParameters(imei) {
    log(`📤 Requesting all device parameters from ${imei}`);
    return this.sendCommand(imei, "PARAM#");
  }

  /**
   * Configure device to send battery voltage periodically
   * @param {string} imei - Device IMEI
   * @param {number} intervalMinutes - Reporting interval in minutes (default: 30)
   * @returns {boolean} True if command sent successfully
   */
  configureBatteryReporting(imei, intervalMinutes = 30) {
    log(
      `📤 Configuring battery reporting every ${intervalMinutes} minutes for ${imei}`
    );
    return this.sendCommand(imei, `BATINTERVAL,${intervalMinutes}#`);
  }

  /**
   * Get last known vehicle battery voltage for a device
   * @param {string} imei - Device IMEI
   * @returns {Object|null} Battery voltage data or null if not available
   */
  getBatteryVoltage(imei) {
    const clientData = this.clients.get(imei);
    if (!clientData || clientData.lastBatteryVoltage === null) {
      return null;
    }
    return {
      voltage: clientData.lastBatteryVoltage,
      voltageFormatted: `${clientData.lastBatteryVoltage.toFixed(2)}V`,
      status:
        clientData.lastBatteryVoltage >= 12.0
          ? "Good"
          : clientData.lastBatteryVoltage >= 11.5
          ? "Low"
          : clientData.lastBatteryVoltage >= 10.5
          ? "Critical"
          : "Very Low",
      lastUpdated: clientData.lastBatteryVoltageAt,
    };
  }

  stop() {
    if (this.server) {
      this.server.close();
      log("🛑 Concox V5 Server stopped");
    }
  }
}

export default ConcoxV5Server;

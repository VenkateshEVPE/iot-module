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
      log(`📨 Command Response`, {
        imei: socket.deviceImei || "unknown",
        response: data.response,
        serverFlag: data.serverFlag,
      });
    } catch (error) {
      log(`❌ Error parsing command response: ${error.message}`);
    }
  }

  handleCommandResponseJM01(socket, packet, clientInfo) {
    try {
      const data = parseCommandResponseJM01(packet);
      log(`📨 Command Response (JM01)`, {
        imei: socket.deviceImei || "unknown",
        response: data.response,
      });
    } catch (error) {
      log(`❌ Error parsing JM01 command response: ${error.message}`);
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
      log(`📊 Information Transmission`, {
        imei: socket.deviceImei || "unknown",
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
    const language = Buffer.from([0x00, 0x02]);
    const serialNumber = Math.floor(Math.random() * 65535);

    const commandLength = 4 + commandBytes.length + 2;

    let packet;
    if (commandLength < 256) {
      const buffer = Buffer.from([
        0x78,
        0x78,
        commandLength + 5,
        0x80,
        commandLength,
      ]);

      packet = Buffer.concat([
        buffer,
        serverFlag,
        commandBytes,
        language,
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff]),
      ]);

      const crc = calculateCRCITU(packet, 2, packet.length);
      packet = Buffer.concat([
        packet,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a]),
      ]);
    } else {
      const totalLength = commandLength + 5;
      const buffer = Buffer.from([
        0x79,
        0x79,
        (totalLength >> 8) & 0xff,
        totalLength & 0xff,
        0x80,
        commandLength,
      ]);

      packet = Buffer.concat([
        buffer,
        serverFlag,
        commandBytes,
        language,
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff]),
      ]);

      const crc = calculateCRCITU(packet, 2, packet.length);
      packet = Buffer.concat([
        packet,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a]),
      ]);
    }

    socket.write(packet);
    log(`📤 Sent command to ${imei}`, {
      command: command,
      hex: packet.toString("hex").toUpperCase(),
    });

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

  stop() {
    if (this.server) {
      this.server.close();
      log("🛑 Concox V5 Server stopped");
    }
  }
}

export default ConcoxV5Server;

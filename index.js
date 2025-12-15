import net from "net";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.CONCOX_PORT || 5027;
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, "logs");
const LOG_FILE = path.join(
  LOG_DIR,
  `concox-${new Date().toISOString().split("T")[0]}.log`
);

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Logging function
function log(message, data = null) {
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

class ConcoxV5Server {
  constructor() {
    this.server = null;
    this.clients = new Map(); // Map of device IMEI to socket info
    this.crcTable = null; // CRC lookup table cache
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
        log(`📝 Logging to: ${LOG_FILE}`);
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

      // Process all complete packets in buffer
      while (buffer.length > 0) {
        const result = this.parsePacket(buffer);
        
        if (!result) {
          // Incomplete packet, wait for more data
          break;
        }

        const { packet, protocolNumber, remaining } = result;
        buffer = remaining;

        // Handle the packet
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

  parsePacket(buffer) {
    if (buffer.length < 5) return null;

    const startByte1 = buffer[0];
    const startByte2 = buffer[1];

    let lengthBytes, lengthValue, headerSize;

    // Check packet type by start bytes (Manual page 4)
    if (startByte1 === 0x78 && startByte2 === 0x78) {
      // Single byte length
      lengthBytes = 1;
      lengthValue = buffer[2];
      headerSize = 3; // Start(2) + Length(1)
    } else if (startByte1 === 0x79 && startByte2 === 0x79) {
      // Two byte length
      if (buffer.length < 6) return null;
      lengthBytes = 2;
      lengthValue = buffer.readUInt16BE(2);
      headerSize = 4; // Start(2) + Length(2)
    } else {
      // Invalid start bytes, try to find next valid packet
      const next78 = buffer.indexOf(0x78, 1);
      const next79 = buffer.indexOf(0x79, 1);
      
      let nextStart = -1;
      if (next78 !== -1 && next79 !== -1) {
        nextStart = Math.min(next78, next79);
      } else if (next78 !== -1) {
        nextStart = next78;
      } else if (next79 !== -1) {
        nextStart = next79;
      }
      
      if (nextStart === -1) {
        return { packet: null, protocolNumber: null, remaining: Buffer.alloc(0) };
      }
      
      return { packet: null, protocolNumber: null, remaining: buffer.slice(nextStart) };
    }

    // Total packet size = Header + Length Value + Stop(2)
    const totalSize = headerSize + lengthValue + 2;

    if (buffer.length < totalSize) {
      return null; // Incomplete packet
    }

    const packet = buffer.slice(0, totalSize);
    const protocolNumber = packet[headerSize];
    const stopByte1 = packet[totalSize - 2];
    const stopByte2 = packet[totalSize - 1];

    // Verify stop bytes
    if (stopByte1 !== 0x0d || stopByte2 !== 0x0a) {
      log(`⚠️  Invalid stop bytes: 0x${stopByte1.toString(16)} 0x${stopByte2.toString(16)}`);
    }

    return {
      packet,
      protocolNumber,
      remaining: buffer.slice(totalSize),
    };
  }

  handlePacket(socket, packet, protocolNumber, clientInfo) {
    if (!packet) return;

    const packetHex = packet.toString("hex").toUpperCase();
    const protocolName = this.getProtocolName(protocolNumber);

    const packetInfo = {
      protocol: `0x${protocolNumber.toString(16).padStart(2, "0").toUpperCase()}`,
      protocolName: protocolName,
      length: packet.length,
      rawHex: packetHex,
    };

    log(`📦 Received packet from ${socket.deviceImei || clientInfo.id}`, packetInfo);

    try {
      switch (protocolNumber) {
        case 0x01:
          this.handleLogin(socket, packet, clientInfo);
          break;
        case 0x13:
          this.handleHeartbeat(socket, packet, clientInfo);
          break;
        case 0x22:
          this.handleGPSLocation(socket, packet, clientInfo);
          break;
        case 0x26:
          this.handleAlarm(socket, packet, clientInfo);
          break;
        case 0x19:
          this.handleLBSAlarm(socket, packet, clientInfo);
          break;
        case 0x28:
          this.handleLBSExtension(socket, packet, clientInfo);
          break;
        case 0x2C:
          this.handleWiFi(socket, packet, clientInfo);
          break;
        case 0x94:
          this.handleInformationTransmission(socket, packet, clientInfo);
          break;
        case 0x8A:
          this.handleTimeCalibration(socket, packet, clientInfo);
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
    // Login packet structure (Manual page 5):
    // Start(2) + Length(1) + Protocol(1) + TerminalID(8) + ModelID(2) + TimeZoneLang(2) + Serial(2) + CRC(2) + Stop(2)
    
    const isLongPacket = packet[0] === 0x79 && packet[1] === 0x79;
    const headerSize = isLongPacket ? 4 : 3;
    
    // Extract Terminal ID (IMEI) - 8 bytes after protocol number
    const imeiBytes = packet.slice(headerSize + 1, headerSize + 9);
    const imei = this.extractIMEI(imeiBytes);
    
    // Extract serial number (2 bytes before CRC)
    const serialNumber = packet.readUInt16BE(packet.length - 6);

    log(`🔐 Login packet`, {
      imei: imei,
      client: clientInfo.id,
      serialNumber: `0x${serialNumber.toString(16).padStart(4, "0").toUpperCase()}`,
      imeiBytes: imeiBytes.toString("hex").toUpperCase(),
    });

    // Store device info
    socket.deviceImei = imei;
    this.clients.set(imei, {
      socket: socket,
      clientInfo: clientInfo,
      connectedAt: new Date().toISOString(),
    });

    // Send login acknowledgment (Manual page 6)
    const ack = this.createLoginAck(serialNumber);
    socket.write(ack);

    log(`✅ Login acknowledged`, {
      imei: imei,
      ackHex: ack.toString("hex").toUpperCase(),
    });
  }

  handleHeartbeat(socket, packet, clientInfo) {
    // Heartbeat packet structure (Manual page 7):
    // Start(2) + Length(1) + Protocol(1) + TerminalInfo(1) + BatteryLevel(1) + GSMSignal(1) + Language(2) + Serial(2) + CRC(2) + Stop(2)
    
    const isLongPacket = packet[0] === 0x79 && packet[1] === 0x79;
    const headerSize = isLongPacket ? 4 : 3;
    
    const terminalInfo = packet[headerSize + 1];
    const batteryLevel = packet[headerSize + 2];
    const gsmSignal = packet[headerSize + 3];
    const serialNumber = packet.readUInt16BE(packet.length - 6);

    // Parse terminal info bits (Manual page 7-8)
    const info = {
      oilElectricityDisconnected: (terminalInfo & 0x80) !== 0,  // Bit 7
      gpsTracking: (terminalInfo & 0x40) !== 0,                 // Bit 6
      charging: (terminalInfo & 0x04) !== 0,                     // Bit 2
      accHigh: (terminalInfo & 0x02) !== 0,                      // Bit 1
      defenseActivated: (terminalInfo & 0x01) !== 0,             // Bit 0
    };

    const batteryLevels = ["No Power", "Extremely Low", "Very Low", "Low", "Medium", "High", "Full"];
    const signalLevels = ["No Signal", "Extremely Weak", "Weak", "Good", "Strong"];

    log(`💓 Heartbeat`, {
      imei: socket.deviceImei || "unknown",
      battery: batteryLevels[batteryLevel] || `Unknown (${batteryLevel})`,
      signal: signalLevels[gsmSignal] || `Unknown (${gsmSignal})`,
      gpsTracking: info.gpsTracking,
      accHigh: info.accHigh,
      charging: info.charging,
      oilElectricityStatus: info.oilElectricityDisconnected ? "IMMOBILIZED (Cut Off)" : "MOBILIZED (Connected)",
      defenseActivated: info.defenseActivated,
      serialNumber: `0x${serialNumber.toString(16).padStart(4, "0").toUpperCase()}`,
    });

    // Send heartbeat acknowledgment (Manual page 8)
    const ack = this.createHeartbeatAck(serialNumber);
    socket.write(ack);
  }

  handleGPSLocation(socket, packet, clientInfo) {
    // GPS Location packet structure (Manual page 9):
    // Start(2) + Length(1) + Protocol(1) + DateTime(6) + GPSSatellites(1) + Lat(4) + Lon(4) + Speed(1) + CourseStatus(2) + MCC(2) + MNC(1) + LAC(2) + CellID(3) + ACC(1) + DataUploadMode(1) + GPSRealTime(1) + Mileage(4) + Serial(2) + CRC(2) + Stop(2)
    
    const isLongPacket = packet[0] === 0x79 && packet[1] === 0x79;
    const headerSize = isLongPacket ? 4 : 3;
    const dataStart = headerSize + 1;

    try {
      const datetime = {
        year: 2000 + packet[dataStart],     // Year byte + 2000
        month: packet[dataStart + 1],
        day: packet[dataStart + 2],
        hour: packet[dataStart + 3],
        minute: packet[dataStart + 4],
        second: packet[dataStart + 5],
      };

      // Debug: Log raw date bytes
      log(`🕐 Raw date bytes`, {
        yearByte: `0x${packet[dataStart].toString(16).padStart(2, '0')} (${packet[dataStart]})`,
        monthByte: `0x${packet[dataStart + 1].toString(16).padStart(2, '0')} (${packet[dataStart + 1]})`,
        dayByte: `0x${packet[dataStart + 2].toString(16).padStart(2, '0')} (${packet[dataStart + 2]})`,
        calculatedYear: datetime.year
      });

      const gpsInfo = packet[dataStart + 6];
      const gpsLength = (gpsInfo >> 4) & 0x0F;
      const satellites = gpsInfo & 0x0F;

      const latitude = packet.readUInt32BE(dataStart + 7) / 1800000.0;
      const longitude = packet.readUInt32BE(dataStart + 11) / 1800000.0;
      const speed = packet[dataStart + 15];

      // Parse course and status (2 bytes) - Manual page 10
      const courseStatus = packet.readUInt16BE(dataStart + 16);
      
      // BYTE_2 (lower byte) + BYTE_1 (upper byte)
      const byte1 = (courseStatus >> 8) & 0xFF;  // Upper byte
      const byte2 = courseStatus & 0xFF;          // Lower byte
      
      // Course is 10 bits: BYTE_1[1:0] + BYTE_2[7:0]
      const course = ((byte1 & 0x03) << 8) | byte2;
      
      // Status bits from BYTE_1
      const gpsPositioned = (byte1 & 0x10) !== 0;     // Bit 4
      const gpsRealTimeStatus = (byte1 & 0x20) === 0;  // Bit 5 (0=real-time, 1=differential)
      const latitudeNS = (byte1 & 0x04) !== 0 ? "N" : "S";   // Bit 2
      const longitudeEW = (byte1 & 0x08) !== 0 ? "W" : "E";  // Bit 3

      const finalLatitude = latitudeNS === "S" ? -latitude : latitude;
      const finalLongitude = longitudeEW === "W" ? -longitude : longitude;

      // LBS data after course/status
      const mcc = packet.readUInt16BE(dataStart + 18); // Mobile Country Code
      const mnc = packet[dataStart + 20]; // Mobile Network Code
      const lac = packet.readUInt16BE(dataStart + 21); // Location Area Code
      const cellId = packet.readUIntBE(dataStart + 23, 3); // Cell ID (3 bytes)
      
      // Additional fields
      let acc = null;
      let dataUploadMode = null;
      let gpsReupload = null;
      let mileage = null;
      
      // Check if packet is long enough for these fields
      if (packet.length >= dataStart + 30) {
        acc = packet[dataStart + 26]; // ACC status
        dataUploadMode = packet[dataStart + 27]; // Data upload mode
        gpsReupload = packet[dataStart + 28]; // GPS real-time re-upload
      }
      
      // Mileage is 4 bytes, positioned before Serial Number (2 bytes), CRC (2 bytes), Stop (2 bytes)
      // So it's at position: packet.length - 10
      if (packet.length >= dataStart + 33) {
        mileage = packet.readUInt32BE(packet.length - 10);
      }

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
        0x0A: "Static Update",
        0x0D: "Static Location",
        0x0E: "GPS Dup Upload"
      };

      const locationData = {
        imei: socket.deviceImei || "unknown",
        timestamp: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
        latitude: finalLatitude.toFixed(6),
        longitude: finalLongitude.toFixed(6),
        speed: speed,
        course: course,
        satellites: satellites,
        positioned: gpsPositioned,
      };

      // Add optional fields if available
      if (mileage !== null) {
        locationData.mileage_meters = mileage;
        locationData.mileage_km = (mileage / 1000).toFixed(2);
        locationData.mileage_miles = (mileage / 1609.34).toFixed(2);
      }
      
      if (acc !== null) {
        locationData.acc = acc === 0x01 ? "High (On)" : "Low (Off)";
      }
      
      if (dataUploadMode !== null) {
        locationData.uploadMode = uploadModes[dataUploadMode] || `Unknown (0x${dataUploadMode.toString(16)})`;
      }
      
      if (gpsReupload !== null) {
        locationData.gpsReupload = gpsReupload === 0x00 ? "Real-time" : "Re-upload";
      }
      
      // Add GPS real-time status from course/status byte
      locationData.gpsRealTime = gpsRealTimeStatus ? "Real-time GPS" : "Differential GPS";

      // Add LBS info
      locationData.lbs = {
        mcc: mcc,
        mnc: mnc,
        lac: lac,
        cellId: cellId
      };

      log(`📍 GPS Location`, locationData);

      // GPS location packets typically don't require acknowledgment (Manual page 11)
      // But we can send one if needed
    } catch (error) {
      log(`❌ Error parsing GPS location: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
        stack: error.stack,
        packetLength: packet.length,
        packetHex: packet.toString("hex").toUpperCase()
      });
    }
  }

  handleAlarm(socket, packet, clientInfo) {
    // Alarm packet structure (Manual page 16-18)
    const isLongPacket = packet[0] === 0x79 && packet[1] === 0x79;
    const headerSize = isLongPacket ? 4 : 3;
    const dataStart = headerSize + 1;

    try {
      // Similar structure to GPS location but with alarm info
      const datetime = {
        year: 2000 + packet[dataStart],
        month: packet[dataStart + 1],
        day: packet[dataStart + 2],
        hour: packet[dataStart + 3],
        minute: packet[dataStart + 4],
        second: packet[dataStart + 5],
      };

      // Alarm type is near the end of the packet
      const alarmByte1 = packet[packet.length - 8];
      const alarmByte2 = packet[packet.length - 7];

      const alarmTypes = {
        0x00: "Normal",
        0x01: "SOS",
        0x02: "Power Cut Alarm",
        0x03: "Vibration Alarm",
        0x04: "Enter Fence Alarm",
        0x05: "Exit Fence Alarm",
        0x06: "Over Speed Alarm",
        0x09: "Moving Alarm",
        0x0A: "Enter GPS Dead Zone",
        0x0B: "Exit GPS Dead Zone",
        0x0C: "Power On Alarm",
        0x0D: "GPS First Fix",
        0x0E: "External Low Battery",
        0x0F: "External Low Battery Protection",
        0x10: "SIM Change Notice",
        0x11: "Power Off Alarm",
        0x13: "Disassemble Alarm",
        0x14: "Door Alarm",
        0x19: "Internal Low Battery Alarm",
        0x20: "Sleep Mode Alarm",
        0x23: "Fall Alarm",
        0xFE: "ACC On Alarm",
        0xFF: "ACC Off Alarm",
      };

      const alarmType = alarmTypes[alarmByte1] || `Unknown (0x${alarmByte1.toString(16)})`;

      log(`🚨 Alarm`, {
        imei: socket.deviceImei || "unknown",
        alarmType: alarmType,
        timestamp: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
      });

      // Send alarm acknowledgment (Manual page 20)
      const serialNumber = packet.readUInt16BE(packet.length - 6);
      const ack = this.createAlarmAck(serialNumber);
      socket.write(ack);
    } catch (error) {
      log(`❌ Error parsing alarm: ${error.message}`, {
        imei: socket.deviceImei || "unknown",
      });
    }
  }

  handleLBSAlarm(socket, packet, clientInfo) {
    log(`📡 LBS Alarm`, {
      imei: socket.deviceImei || "unknown",
      packetHex: packet.toString("hex").toUpperCase(),
    });
  }

  handleLBSExtension(socket, packet, clientInfo) {
    log(`📡 LBS Extension`, {
      imei: socket.deviceImei || "unknown",
      packetHex: packet.toString("hex").toUpperCase(),
    });
    // LBS packets don't require acknowledgment (Manual page 13)
  }

  handleWiFi(socket, packet, clientInfo) {
    log(`📶 WiFi Packet`, {
      imei: socket.deviceImei || "unknown",
      packetHex: packet.toString("hex").toUpperCase(),
    });
    // WiFi packets don't require acknowledgment (Manual page 15)
  }

  handleInformationTransmission(socket, packet, clientInfo) {
    // Information Transmission packet (Manual page 27-30)
    // Contains detailed device status including fuel/electricity cutoff
    const isLongPacket = packet[0] === 0x79 && packet[1] === 0x79;
    const headerSize = isLongPacket ? 4 : 3;
    const protocolNumberPos = headerSize;
    const subProtocolNumber = packet[protocolNumberPos + 1]; // Information Type
    
    log(`📊 Information Transmission`, {
      imei: socket.deviceImei || "unknown",
      subProtocol: `0x${subProtocolNumber.toString(16).padStart(2, "0")}`,
      packetHex: packet.toString("hex").toUpperCase(),
    });

    try {
      switch (subProtocolNumber) {
        case 0x00:
          // External power voltage
          const voltage = packet.readUInt16BE(protocolNumberPos + 2) / 100;
          log(`🔋 External Voltage: ${voltage}V`);
          break;
          
        case 0x04:
          // Terminal status synchronization - CONTAINS FUEL/ELECTRICITY STATUS
          const statusData = packet.slice(protocolNumberPos + 2, packet.length - 6).toString('ascii');
          log(`📋 Device Status Data`, { statusData });
          
          // Parse status string (format: ALM1=xx;ALM2=xx;DYD=xx;...)
          const statusParts = statusData.split(';');
          const status = {};
          
          statusParts.forEach(part => {
            const [key, value] = part.split('=');
            if (key && value) {
              status[key.trim()] = value.trim();
            }
          });
          
          // Parse DYD (fuel/electricity status)
          if (status.DYD) {
            const dydValue = parseInt(status.DYD, 16);
            const fuelStatus = {
              oilElectricityCutoff: (dydValue & 0x02) !== 0,
              oilElectricityConnected: (dydValue & 0x01) !== 0,
              gpsUnlocatedDefer: (dydValue & 0x04) !== 0,
              overspeedDefer: (dydValue & 0x08) !== 0
            };
            
            log(`⛽ Fuel/Electricity Status`, {
              status: fuelStatus.oilElectricityCutoff ? "IMMOBILIZED (Cut Off)" : "MOBILIZED (Connected)",
              rawValue: `0x${status.DYD}`,
              details: fuelStatus
            });
          }
          
          log(`📊 Full Device Status`, status);
          break;
          
        case 0x05:
          // Door status
          const doorStatus = packet[protocolNumberPos + 2];
          log(`🚪 Door Status`, {
            doorOpen: (doorStatus & 0x01) !== 0,
            triggering: (doorStatus & 0x02) !== 0 ? "High" : "Low",
            ioStatus: (doorStatus & 0x04) !== 0 ? "High" : "Low"
          });
          break;
          
        case 0x06:
          // Voltage and mileage
          log(`📊 Voltage and Mileage packet received`);
          break;
          
        case 0x0A:
          // ICCID
          const iccid = packet.slice(protocolNumberPos + 2, protocolNumberPos + 12).toString('hex');
          log(`📱 ICCID: ${iccid}`);
          break;
          
        case 0x0D:
          // Fuel sensor data
          log(`⛽ Fuel Sensor Data received`);
          break;
      }
    } catch (error) {
      log(`❌ Error parsing information transmission: ${error.message}`);
    }
    
    // Information transmission packets don't require acknowledgment (Manual page 31)
  }

  // Method to send mobilize/immobilize commands
  sendCommand(imei, command) {
    const clientData = this.clients.get(imei);
    if (!clientData) {
      log(`❌ Device ${imei} not connected`);
      return false;
    }

    const socket = clientData.socket;
    
    // Command packet structure (Manual page 24)
    // Start(2) + Length(1-2) + Protocol(1) + CommandLength(1) + ServerFlag(4) + Command(N) + Language(2) + Serial(2) + CRC(2) + Stop(2)
    
    const commandBytes = Buffer.from(command, 'ascii');
    const serverFlag = Buffer.from([0x00, 0x00, 0x00, 0x00]); // Server identification
    const language = Buffer.from([0x00, 0x02]); // English
    const serialNumber = Math.floor(Math.random() * 65535);
    
    const commandLength = 4 + commandBytes.length + 2; // ServerFlag(4) + Command + Language(2)
    
    let packet;
    if (commandLength < 256) {
      // Short packet (0x7878)
      const buffer = Buffer.from([
        0x78, 0x78,
        commandLength + 5, // Length includes: Protocol(1) + CommandLength(1) + Content + Serial(2) + CRC(2)
        0x80, // Protocol: Online Command
        commandLength
      ]);
      
      packet = Buffer.concat([
        buffer,
        serverFlag,
        commandBytes,
        language,
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff])
      ]);
      
      const crc = this.calculateCRCITU(packet, 2, packet.length);
      packet = Buffer.concat([
        packet,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a])
      ]);
    } else {
      // Long packet (0x7979) - for commands longer than ~240 chars
      const totalLength = commandLength + 5;
      const buffer = Buffer.from([
        0x79, 0x79,
        (totalLength >> 8) & 0xff,
        totalLength & 0xff,
        0x80, // Protocol: Online Command
        commandLength
      ]);
      
      packet = Buffer.concat([
        buffer,
        serverFlag,
        commandBytes,
        language,
        Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff])
      ]);
      
      const crc = this.calculateCRCITU(packet, 2, packet.length);
      packet = Buffer.concat([
        packet,
        Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
        Buffer.from([0x0d, 0x0a])
      ]);
    }
    
    socket.write(packet);
    log(`📤 Sent command to ${imei}`, {
      command: command,
      hex: packet.toString('hex').toUpperCase()
    });
    
    return true;
  }

  // Helper methods for common commands
  mobilizeVehicle(imei) {
    // Command format: RELAY,1# (turn on relay = restore fuel/electricity)
    return this.sendCommand(imei, 'RELAY,1#');
  }

  immobilizeVehicle(imei) {
    // Command format: RELAY,0# (turn off relay = cut fuel/electricity)
    return this.sendCommand(imei, 'RELAY,0#');
  }

  requestDeviceStatus(imei) {
    // Request full device status
    return this.sendCommand(imei, 'STATUS#');
  }

  handleTimeCalibration(socket, packet, clientInfo) {
    const serialNumber = packet.readUInt16BE(packet.length - 6);
    
    log(`🕐 Time Calibration Request`, {
      imei: socket.deviceImei || "unknown",
    });

    // Send time response (Manual page 26)
    const now = new Date();
    const ack = this.createTimeCalibrationResponse(serialNumber, now);
    socket.write(ack);

    log(`✅ Time response sent`, {
      imei: socket.deviceImei || "unknown",
      time: now.toISOString(),
    });
  }

  extractIMEI(imeiBytes) {
    // IMEI is 8 bytes in format: each byte represents 2 digits
    // Example: IMEI 123456789123456 = 0x01 0x23 0x45 0x67 0x89 0x12 0x34 0x56
    let imei = "";
    for (let i = 0; i < 8; i++) {
      imei += imeiBytes[i].toString(16).padStart(2, "0");
    }

    // Remove leading zeros and ensure 15 digits
    imei = imei.replace(/^0+/, "");
    if (imei.length > 15) {
      imei = imei.substring(0, 15);
    }

    return imei;
  }

  createLoginAck(serialNumber) {
    // Format from manual page 6:
    // Start(2) + Length(1) + Protocol(1) + Serial(2) + CRC(2) + Stop(2)
    const buffer = Buffer.from([
      0x78,
      0x78, // Start
      0x05, // Length = Protocol(1) + Serial(2) + CRC(2)
      0x01, // Protocol Number
      (serialNumber >> 8) & 0xff, // Serial high byte
      serialNumber & 0xff, // Serial low byte
    ]);

    // Calculate CRC-ITU on bytes from Length to Serial Number (indices 2-5)
    const crc = this.calculateCRCITU(buffer, 2, 6);

    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]), // CRC
      Buffer.from([0x0d, 0x0a]), // Stop
    ]);
  }

  createHeartbeatAck(serialNumber) {
    // Format from manual page 8:
    // Start(2) + Length(1) + Protocol(1) + Serial(2) + CRC(2) + Stop(2)
    const buffer = Buffer.from([
      0x78,
      0x78, // Start
      0x05, // Length
      0x13, // Protocol Number (Heartbeat)
      (serialNumber >> 8) & 0xff,
      serialNumber & 0xff,
    ]);

    const crc = this.calculateCRCITU(buffer, 2, 6);

    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
      Buffer.from([0x0d, 0x0a]),
    ]);
  }

  createAlarmAck(serialNumber) {
    // Format from manual page 20:
    // Start(2) + Length(1) + Protocol(1) + Serial(2) + CRC(2) + Stop(2)
    const buffer = Buffer.from([
      0x78,
      0x78, // Start
      0x05, // Length
      0x26, // Protocol Number (Alarm)
      (serialNumber >> 8) & 0xff,
      serialNumber & 0xff,
    ]);

    const crc = this.calculateCRCITU(buffer, 2, 6);

    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
      Buffer.from([0x0d, 0x0a]),
    ]);
  }

  createTimeCalibrationResponse(serialNumber, date) {
    // Format from manual page 26:
    // Start(2) + Length(1) + Protocol(1) + DateTime(6) + Serial(2) + CRC(2) + Stop(2)
    const buffer = Buffer.from([
      0x78,
      0x78, // Start
      0x0b, // Length = Protocol(1) + DateTime(6) + Serial(2) + CRC(2)
      0x8a, // Protocol Number
      date.getFullYear() - 2000, // Year
      date.getMonth() + 1, // Month
      date.getDate(), // Day
      date.getHours(), // Hour
      date.getMinutes(), // Minute
      date.getSeconds(), // Second
      (serialNumber >> 8) & 0xff,
      serialNumber & 0xff,
    ]);

    const crc = this.calculateCRCITU(buffer, 2, 12);

    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
      Buffer.from([0x0d, 0x0a]),
    ]);
  }

  calculateCRCITU(data, startIndex = 0, endIndex = null) {
    // CRC-ITU implementation from manual (Appendix, page 41)
    const crctab16 = [
      0x0000, 0x1189, 0x2312, 0x329b, 0x4624, 0x57ad, 0x6536, 0x74bf, 0x8c48,
      0x9dc1, 0xaf5a, 0xbed3, 0xca6c, 0xdbe5, 0xe97e, 0xf8f7, 0x1081, 0x0108,
      0x3393, 0x221a, 0x56a5, 0x472c, 0x75b7, 0x643e, 0x9cc9, 0x8d40, 0xbfdb,
      0xae52, 0xdaed, 0xcb64, 0xf9ff, 0xe876, 0x2102, 0x308b, 0x0210, 0x1399,
      0x6726, 0x76af, 0x4434, 0x55bd, 0xad4a, 0xbcc3, 0x8e58, 0x9fd1, 0xeb6e,
      0xfae7, 0xc87c, 0xd9f5, 0x3183, 0x200a, 0x1291, 0x0318, 0x77a7, 0x662e,
      0x54b5, 0x453c, 0xbdcb, 0xac42, 0x9ed9, 0x8f50, 0xfbef, 0xea66, 0xd8fd,
      0xc974, 0x4204, 0x538d, 0x6116, 0x709f, 0x0420, 0x15a9, 0x2732, 0x36bb,
      0xce4c, 0xdfc5, 0xed5e, 0xfcd7, 0x8868, 0x99e1, 0xab7a, 0xbaf3, 0x5285,
      0x430c, 0x7197, 0x601e, 0x14a1, 0x0528, 0x37b3, 0x263a, 0xdecd, 0xcf44,
      0xfddf, 0xec56, 0x98e9, 0x8960, 0xbbfb, 0xaa72, 0x6306, 0x728f, 0x4014,
      0x519d, 0x2522, 0x34ab, 0x0630, 0x17b9, 0xef4e, 0xfec7, 0xcc5c, 0xddd5,
      0xa96a, 0xb8e3, 0x8a78, 0x9bf1, 0x7387, 0x620e, 0x5095, 0x411c, 0x35a3,
      0x242a, 0x16b1, 0x0738, 0xffcf, 0xee46, 0xdcdd, 0xcd54, 0xb9eb, 0xa862,
      0x9af9, 0x8b70, 0x8408, 0x9581, 0xa71a, 0xb693, 0xc22c, 0xd3a5, 0xe13e,
      0xf0b7, 0x0840, 0x19c9, 0x2b52, 0x3adb, 0x4e64, 0x5fed, 0x6d76, 0x7cff,
      0x9489, 0x8500, 0xb79b, 0xa612, 0xd2ad, 0xc324, 0xf1bf, 0xe036, 0x18c1,
      0x0948, 0x3bd3, 0x2a5a, 0x5ee5, 0x4f6c, 0x7df7, 0x6c7e, 0xa50a, 0xb483,
      0x8618, 0x9791, 0xe32e, 0xf2a7, 0xc03c, 0xd1b5, 0x2942, 0x38cb, 0x0a50,
      0x1bd9, 0x6f66, 0x7eef, 0x4c74, 0x5dfd, 0xb58b, 0xa402, 0x9699, 0x8710,
      0xf3af, 0xe226, 0xd0bd, 0xc134, 0x39c3, 0x284a, 0x1ad1, 0x0b58, 0x7fe7,
      0x6e6e, 0x5cf5, 0x4d7c, 0xc60c, 0xd785, 0xe51e, 0xf497, 0x8028, 0x91a1,
      0xa33a, 0xb2b3, 0x4a44, 0x5bcd, 0x6956, 0x78df, 0x0c60, 0x1de9, 0x2f72,
      0x3efb, 0xd68d, 0xc704, 0xf59f, 0xe416, 0x90a9, 0x8120, 0xb3bb, 0xa232,
      0x5ac5, 0x4b4c, 0x79d7, 0x685e, 0x1ce1, 0x0d68, 0x3ff3, 0x2e7a, 0xe70e,
      0xf687, 0xc41c, 0xd595, 0xa12a, 0xb0a3, 0x8238, 0x93b1, 0x6b46, 0x7acf,
      0x4854, 0x59dd, 0x2d62, 0x3ceb, 0x0e70, 0x1ff9, 0xf78f, 0xe606, 0xd49d,
      0xc514, 0xb1ab, 0xa022, 0x92b9, 0x8330, 0x7bc7, 0x6a4e, 0x58d5, 0x495c,
      0x3de3, 0x2c6a, 0x1ef1, 0x0f78,
    ];

    const end = endIndex !== null ? endIndex : data.length;
    let fcs = 0xffff; // Initial value from manual

    for (let i = startIndex; i < end; i++) {
      fcs = (fcs >> 8) ^ crctab16[(fcs ^ data[i]) & 0xff];
    }

    return ~fcs & 0xffff; // Negated, as per manual
  }

  getProtocolName(protocolNumber) {
    const protocols = {
      0x01: "Login Information",
      0x13: "Heartbeat Packet",
      0x22: "Positioning Data (UTC)",
      0x26: "Alarm Data (UTC)",
      0x19: "LBS Alarm",
      0x27: "Alarm Data HVT001 (UTC)",
      0x28: "LBS Multiple Bases Extension",
      0x2c: "WIFI Communication Protocol",
      0x80: "Online Command",
      0x21: "Online Command Response",
      0x15: "Online Command Response JM01",
      0x8a: "Time Check Packet",
      0x94: "Information Transmission Packet",
      0x9b: "External Device Transfer (X3)",
      0x9c: "External Module Transmission (U20)",
      0x8d: "Large File Transfer (HVT001)",
    };
    return protocols[protocolNumber] || "Unknown";
  }

  stop() {
    if (this.server) {
      this.server.close();
      log("🛑 Concox V5 Server stopped");
    }
  }
}

// Start the server
const server = new ConcoxV5Server();

server.start().catch((error) => {
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

// ===== USAGE EXAMPLES =====
// Uncomment and modify as needed

// Example 1: Send command to immobilize vehicle after 10 seconds
// setTimeout(() => {
//   const imei = "355172107461053";
//   log(`🚫 Attempting to immobilize vehicle ${imei}`);
//   server.immobilizeVehicle(imei);
// }, 10000);

// Example 2: Send command to mobilize vehicle
// setTimeout(() => {
//   const imei = "355172107461053";
//   log(`✅ Attempting to mobilize vehicle ${imei}`);
//   server.mobilizeVehicle(imei);
// }, 20000);

// Example 3: Request device status
// setTimeout(() => {
//   const imei = "355172107461053";
//   log(`📊 Requesting device status for ${imei}`);
//   server.requestDeviceStatus(imei);
// }, 5000);

// Example 4: Send custom command
// setTimeout(() => {
//   const imei = "355172107461053";
//   // Check manual for available SMS commands
//   server.sendCommand(imei, 'APN,internet.example.com#'); // Set APN
//   // server.sendCommand(imei, 'RESET#'); // Reset device
//   // server.sendCommand(imei, 'PARAM#'); // Get all parameters
// }, 15000);

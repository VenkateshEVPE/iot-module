/**
 * Alarm Data HVT001 Protocol Handler (0x27)
 * Based on Concox V5 Protocol Manual
 * Special alarm format for HVT001 devices
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';

/**
 * Parse Alarm Data HVT001 packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed HVT001 alarm data
 */
export function parseAlarmHVT001(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // HVT001 Alarm structure (similar to 0x26 but may have additional fields):
  // Start(2) + Length(1-2) + Protocol(1) + DateTime(6) + GPSData + AlarmType(1) + Serial(2) + CRC(2) + Stop(2)
  
  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  // Parse GPS data if available
  let gpsData = null;
  let alarmByte = null;
  
  // Check if packet has GPS data (similar to 0x22 structure)
  if (packet.length > dataStart + 20) {
    const gpsInfo = packet[dataStart + 6];
    const satellites = gpsInfo & 0x0F;
    
    if (satellites > 0) {
      const latitude = packet.readUInt32BE(dataStart + 7) / 1800000.0;
      const longitude = packet.readUInt32BE(dataStart + 11) / 1800000.0;
      const speed = packet[dataStart + 15];
      const courseStatus = packet.readUInt16BE(dataStart + 16);
      
      const byte1 = (courseStatus >> 8) & 0xFF;
      const byte2 = courseStatus & 0xFF;
      const course = ((byte1 & 0x03) << 8) | byte2;
      const gpsPositioned = (byte1 & 0x10) !== 0;
      const latitudeNS = (byte1 & 0x04) !== 0 ? "S" : "N";
      const longitudeEW = (byte1 & 0x08) !== 0 ? "W" : "E";
      
      gpsData = {
        latitude: (latitudeNS === "S" ? -latitude : latitude).toFixed(6),
        longitude: (longitudeEW === "W" ? -longitude : longitude).toFixed(6),
        speed,
        course,
        satellites,
        positioned: gpsPositioned,
      };
    }
  }

  // Alarm type is typically near the end
  alarmByte = packet[packet.length - 8] || packet[dataStart + 6];

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

  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    gpsData,
    alarmType: alarmTypes[alarmByte] || `Unknown (0x${alarmByte.toString(16)})`,
    alarmByte,
    serialNumber,
  };
}

/**
 * Create Alarm HVT001 acknowledgment
 * @param {number} serialNumber - Serial number from device
 * @returns {Buffer} Acknowledgment packet
 */
export function createAlarmHVT001Ack(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x27, // Protocol: Alarm HVT001
    (serialNumber >> 8) & 0xff,
    serialNumber & 0xff,
  ]);

  const crc = calculateCRCITU(buffer, 2, 6);

  return Buffer.concat([
    buffer,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
    Buffer.from([0x0d, 0x0a]),
  ]);
}


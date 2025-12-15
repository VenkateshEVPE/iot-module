/**
 * WiFi Information Protocol Handler (0x2C)
 * Based on Concox V5 Protocol Manual - Section 5
 */

import { getHeaderSize } from '@concox/shared/parser.js';
import { calculateCRCITU } from '@concox/shared/crc.js';

/**
 * Parse WiFi packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed WiFi data
 */
export function parseWiFi(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // WiFi packet structure (Manual page 13-14):
  // Start(2) + Length(1-2) + Protocol(1) + DateTime(6) + WiFiCount(1) + WiFiAPs(N*7) + Serial(2) + CRC(2) + Stop(2)
  // Each WiFi AP: MAC(6) + Signal(1)
  
  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  const wifiCount = packet[dataStart + 6];
  const accessPoints = [];
  
  let offset = dataStart + 7;
  for (let i = 0; i < wifiCount && offset + 7 <= packet.length - 6; i++) {
    const macBytes = packet.slice(offset, offset + 6);
    const mac = Array.from(macBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(':')
      .toUpperCase();
    const signal = packet[offset + 6];
    
    accessPoints.push({
      index: i + 1,
      mac,
      signal: signal > 128 ? signal - 256 : signal, // Signed value
      signalStrength: Math.abs(signal > 128 ? signal - 256 : signal),
    });
    
    offset += 7;
  }

  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    wifiCount,
    accessPoints,
    serialNumber,
  };
}

/**
 * Create WiFi packet response
 * @param {number} serialNumber - Serial number from device
 * @returns {Buffer} Response packet
 */
export function createWiFiResponse(serialNumber) {
  // According to manual page 15, server should respond with same protocol
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x2c, // Protocol: WiFi
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


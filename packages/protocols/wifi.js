/**
 * WiFi Information Protocol Handler (0x2C)
 * Based on Concox V5 Protocol Manual - Section 5 (pages 13-14)
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';

/**
 * Parse WiFi packet
 * Per PDF: Date(6) + LBS block (main base 9 + 6 neighbors 36) + Time leads(1) + WiFi quantity(1) + per AP: MAC(6)+strength(1)+SSID length(1)+SSID(0-32).
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed WiFi data
 */
export function parseWiFi(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  const serialStart = packet.length - 6;

  // WiFi packet structure (PDF pages 13-14):
  // Start(2) + Length(1-2) + Protocol(1) + Date(6) + MCC(2)+MNC(1)+LAC(2)+CI(3)+RSSI(1) + 6×(NLAC(2)+NCI(3)+NRSSI(1)) + TimeLeads(1) + WiFiQty(1) + [MAC(6)+Strength(1)+SSIDLen(1)+SSID(N)]* + Serial(2) + CRC(2) + Stop(2)
  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  // LBS block: main base 9 bytes, 6 neighbors 6 bytes each
  const mainBase = {
    mcc: packet.readUInt16BE(dataStart + 6),
    mnc: packet[dataStart + 8],
    lac: packet.readUInt16BE(dataStart + 9),
    cellId: packet.readUIntBE(dataStart + 11, 3).toString(16).toUpperCase().padStart(6, "0"),
    rssi: packet[dataStart + 14],
  };
  const neighbors = [];
  for (let i = 0; i < 6; i++) {
    const offset = dataStart + 15 + i * 6;
    if (offset + 6 > serialStart) break;
    neighbors.push({
      index: i + 1,
      lac: packet.readUInt16BE(offset),
      cellId: packet.readUIntBE(offset + 2, 3).toString(16).toUpperCase().padStart(6, "0"),
      rssi: packet[offset + 5],
    });
  }

  const timeLeads = packet[dataStart + 51];
  const wifiCount = packet[dataStart + 52];

  // Per AP: MAC(6) + strength(1) + SSID length(1) + SSID(0-32 bytes)
  const accessPoints = [];
  let offset = dataStart + 53;
  for (let i = 0; i < wifiCount && offset + 8 <= serialStart; i++) {
    const macBytes = packet.slice(offset, offset + 6);
    const mac = Array.from(macBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(":")
      .toUpperCase();
    const strength = packet[offset + 6];
    const ssidLength = Math.min(packet[offset + 7], 32);
    offset += 8;
    const ssid = ssidLength > 0 && offset + ssidLength <= serialStart
      ? packet.slice(offset, offset + ssidLength).toString("utf8")
      : "";
    offset += ssidLength;

    accessPoints.push({
      index: i + 1,
      mac,
      signal: strength > 128 ? strength - 256 : strength,
      signalStrength: Math.abs(strength > 128 ? strength - 256 : strength),
      ssidLength,
      ssid,
    });
  }

  const serialNumber = packet.readUInt16BE(serialStart);

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    datetimeRaw: datetime,
    lbs: { mainBase, neighbors },
    timeLeads,
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


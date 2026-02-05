/**
 * LBS Multiple Bases Extension Protocol Handler (0x28)
 * Based on Concox V5 Protocol Manual - Section 4.1 (page 12)
 */

import { getHeaderSize } from '../shared/parser.js';

/**
 * Parse LBS Multiple Bases Extension packet
 * Per PDF: DATE(UTC) 6, main base (MCC+MNC+LAC+CI+RSSI) 9 bytes, 6 neighbors each (LAC+CI+RSSI) 6 bytes, Timing Advance 1, LANGUAGE 2.
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed LBS extension data
 */
export function parseLBSExtension(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;

  // LBS Extension structure (PDF page 12):
  // Start(2) + Length(1-2) + Protocol(1) + DATE(UTC)(6) + MCC(2)+MNC(1)+LAC(2)+CI(3)+RSSI(1) + 6×(NLAC(2)+NCI(3)+NRSSI(1)) + TimingAdvance(1) + LANGUAGE(2) + Serial(2) + CRC(2) + Stop(2)
  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  // Main base: 9 bytes at dataStart+6
  const mainBase = {
    mcc: packet.readUInt16BE(dataStart + 6),
    mnc: packet[dataStart + 8],
    lac: packet.readUInt16BE(dataStart + 9),
    cellId: packet.readUIntBE(dataStart + 11, 3).toString(16).toUpperCase().padStart(6, "0"),
    rssi: packet[dataStart + 14],
  };

  // 6 neighbors: each 6 bytes (LAC 2 + CI 3 + RSSI 1)
  const neighbors = [];
  for (let i = 0; i < 6; i++) {
    const offset = dataStart + 15 + i * 6;
    if (offset + 6 > packet.length - 6) break;
    neighbors.push({
      index: i + 1,
      lac: packet.readUInt16BE(offset),
      cellId: packet.readUIntBE(offset + 2, 3).toString(16).toUpperCase().padStart(6, "0"),
      rssi: packet[offset + 5],
    });
  }

  const timingAdvance = packet[dataStart + 51];
  const language = packet.readUInt16BE(dataStart + 52);
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    datetimeRaw: datetime,
    mainBase,
    neighbors,
    timingAdvance,
    language,
    serialNumber,
  };
}


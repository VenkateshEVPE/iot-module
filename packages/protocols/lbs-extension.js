/**
 * LBS Multiple Bases Extension Protocol Handler (0x28)
 * Based on Concox V5 Protocol Manual
 */

import { getHeaderSize } from '@concox/shared/parser.js';

/**
 * Parse LBS Multiple Bases Extension packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed LBS extension data
 */
export function parseLBSExtension(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // LBS Extension structure:
  // Start(2) + Length(1-2) + Protocol(1) + BaseStationCount(1) + BaseStations(N*7) + Serial(2) + CRC(2) + Stop(2)
  // Each base station: MCC(2) + MNC(1) + LAC(2) + CellID(3) + Signal(1)
  
  const baseStationCount = packet[dataStart];
  const baseStations = [];
  
  let offset = dataStart + 1;
  for (let i = 0; i < baseStationCount && offset + 7 <= packet.length - 6; i++) {
    const mcc = packet.readUInt16BE(offset);
    const mnc = packet[offset + 2];
    const lac = packet.readUInt16BE(offset + 3);
    const cellId = packet.readUIntBE(offset + 5, 3);
    const signal = packet[offset + 8] || 0; // Signal strength (if available)
    
    baseStations.push({
      index: i + 1,
      mcc,
      mnc,
      lac,
      cellId: cellId.toString(16).toUpperCase().padStart(6, '0'),
      signal,
    });
    
    offset += 7;
  }

  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    baseStationCount,
    baseStations,
    serialNumber,
  };
}


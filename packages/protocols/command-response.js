/**
 * Online Command Response Protocol Handler (0x21)
 * Based on Concox V5 Protocol Manual - Section 8
 */

import { getHeaderSize } from '@concox/shared/parser.js';

/**
 * Parse Online Command Response packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed command response data
 */
export function parseCommandResponse(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // Command Response structure (Manual page 24):
  // Start(2) + Length(1-2) + Protocol(1) + ServerFlag(4) + ResponseLength(1) + Response(N) + Serial(2) + CRC(2) + Stop(2)
  
  const serverFlag = packet.slice(dataStart, dataStart + 4);
  const responseLength = packet[dataStart + 4];
  const response = packet.slice(dataStart + 5, dataStart + 5 + responseLength).toString('ascii');
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    serverFlag: serverFlag.toString('hex').toUpperCase(),
    responseLength,
    response,
    serialNumber,
  };
}


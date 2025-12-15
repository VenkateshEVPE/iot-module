/**
 * Online Command Response JM01 Protocol Handler (0x15)
 * Based on Concox V5 Protocol Manual - Section 8
 * Alternative response format for JM01 devices
 */

import { getHeaderSize } from '@concox/shared/parser.js';

/**
 * Parse Online Command Response JM01 packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed command response data
 */
export function parseCommandResponseJM01(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // JM01 Command Response structure:
  // Start(2) + Length(1) + Protocol(1) + ResponseLength(1) + Response(N) + Serial(2) + CRC(2) + Stop(2)
  // Note: JM01 format doesn't include ServerFlag
  
  const responseLength = packet[dataStart];
  const response = packet.slice(dataStart + 1, dataStart + 1 + responseLength).toString('ascii');
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    responseLength,
    response,
    serialNumber,
  };
}


/**
 * Online Command Response JM01 Protocol Handler (0x15)
 * Based on Concox V5 Protocol Manual - Section 8
 * Alternative response format for JM01 devices
 */

import { getHeaderSize, isLongPacket } from '../shared/parser.js';

/**
 * Parse Online Command Response JM01 packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed command response data
 */
export function parseCommandResponseJM01(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // JM01 Command Response structure:
  // Start(2) + Length(1-2) + Protocol(1) + ResponseLength(1-2) + Response(N) + Serial(2) + CRC(2) + Stop(2)
  // Note: JM01 format doesn't include ServerFlag
  // ResponseLength is 1 byte for short packets (78 78) and 2 bytes for long packets (79 79)
  
  let responseLength;
  let responseStart;
  
  if (isLongPacket(packet)) {
    // Long packet (79 79): ResponseLength is 2 bytes
    responseLength = packet.readUInt16BE(dataStart);
    responseStart = dataStart + 2;
  } else {
    // Short packet (78 78): ResponseLength is 1 byte
    responseLength = packet[dataStart];
    responseStart = dataStart + 1;
  }
  
  const response = packet.slice(responseStart, responseStart + responseLength).toString('ascii');
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    responseLength,
    response,
    serialNumber,
  };
}


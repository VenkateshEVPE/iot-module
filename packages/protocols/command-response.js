/**
 * Online Command Response Protocol Handler (0x21)
 * Based on Concox V5 Protocol Manual - Section 8
 */

import { getHeaderSize, isLongPacket } from "@concox/shared/parser.js";

/**
 * Parse Online Command Response packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed command response data
 */
export function parseCommandResponse(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;

  // Command Response structure (Manual page 24):
  // Start(2) + Length(1-2) + Protocol(1) + ServerFlag(4) + ResponseLength(1-2) + Response(N) + Serial(2) + CRC(2) + Stop(2)
  // Note: ResponseLength is 1 byte for short packets (78 78) and 2 bytes for long packets (79 79)

  const serverFlag = packet.slice(dataStart, dataStart + 4);

  // Determine response length field size based on packet type
  let responseLength;
  let responseStart;

  if (isLongPacket(packet)) {
    // Long packet (79 79): ResponseLength is 2 bytes
    responseLength = packet.readUInt16BE(dataStart + 4);
    responseStart = dataStart + 6;
  } else {
    // Short packet (78 78): ResponseLength is 1 byte
    responseLength = packet[dataStart + 4];
    responseStart = dataStart + 5;
  }

  const response = packet
    .slice(responseStart, responseStart + responseLength)
    .toString("ascii");

  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    serverFlag: serverFlag.toString("hex").toUpperCase(),
    responseLength,
    response,
    serialNumber,
  };
}

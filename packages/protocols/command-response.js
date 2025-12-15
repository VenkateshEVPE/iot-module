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
  let responseLengthField;
  let responseStart;

  if (isLongPacket(packet)) {
    // Long packet (79 79): ResponseLength is 2 bytes
    // Based on actual packet analysis, the response starts at dataStart + 5
    // (one byte earlier than expected, to include the first character 'B')
    responseLengthField = packet.readUInt16BE(dataStart + 4);
    responseStart = dataStart + 5; // Response starts here to capture full text
  } else {
    // Short packet (78 78): ResponseLength is 1 byte
    responseLengthField = packet[dataStart + 4];
    responseStart = dataStart + 5;
  }

  // Calculate actual available response length
  // Packet structure: ... + Response(N) + Serial(2) + CRC(2) + Stop(2)
  // So response ends at: packet.length - 6 (Serial + CRC + Stop)
  const responseEnd = packet.length - 6;
  const actualResponseLength = responseEnd - responseStart;

  // Use the smaller of declared length or actual available length
  // This handles cases where response length field is incorrect or response is truncated
  const responseLength = Math.min(responseLengthField, actualResponseLength);

  const response = packet
    .slice(responseStart, responseStart + responseLength)
    .toString("ascii")
    .replace(/\0/g, "") // Remove null bytes
    .trim(); // Remove trailing whitespace

  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    serverFlag: serverFlag.toString("hex").toUpperCase(),
    responseLength: responseLengthField, // Declared length from packet
    actualResponseLength, // Actual available length
    response,
    serialNumber,
  };
}

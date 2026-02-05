/**
 * External Module Transmission Protocol Handler (0x9C)
 * Based on Concox V5 Protocol Manual - Section 13
 * For U20 devices with external modules
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';

/**
 * Parse External Module Transmission packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed external module data
 */
export function parseExternalModuleTransmission(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // External Module Transmission structure (Manual page 33):
  // Start(2) + Length(1-2) + Protocol(1) + ModuleID(1) + DataLength(1) + TransparentData(N) + Serial(2) + CRC(2) + Stop(2)
  
  const moduleId = packet[dataStart];
  const dataLength = packet[dataStart + 1];
  const transparentData = packet.slice(dataStart + 2, dataStart + 2 + dataLength);
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    moduleId,
    dataLength,
    transparentData: transparentData.toString('hex').toUpperCase(),
    transparentDataRaw: transparentData,
    serialNumber,
  };
}

/**
 * Create External Module Transmission response
 * @param {number} serialNumber - Serial number from device
 * @param {number} moduleId - Module ID
 * @param {Buffer} responseData - Optional response data to send to module
 * @returns {Buffer} Response packet
 */
export function createExternalModuleResponse(serialNumber, moduleId, responseData = null) {
  if (responseData) {
    // Send data back to external module
    const dataLength = responseData.length;
    const totalLength = 1 + 1 + dataLength + 2; // Protocol(1) + ModuleID(1) + DataLength(1) + Data + Serial(2) + CRC(2)
    
    let buffer;
    if (totalLength < 256) {
      buffer = Buffer.from([
        0x78, 0x78,
        totalLength + 2, // +2 for CRC
        0x9c, // Protocol
        moduleId,
        dataLength,
      ]);
    } else {
      buffer = Buffer.from([
        0x79, 0x79,
        (totalLength + 2) >> 8,
        (totalLength + 2) & 0xff,
        0x9c, // Protocol
        moduleId,
        dataLength,
      ]);
    }
    
    buffer = Buffer.concat([
      buffer,
      responseData,
      Buffer.from([(serialNumber >> 8) & 0xff, serialNumber & 0xff]),
    ]);
    
    const crc = calculateCRCITU(buffer, buffer[0] === 0x79 ? 4 : 2, buffer.length);
    
    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
      Buffer.from([0x0d, 0x0a]),
    ]);
  } else {
    // Simple acknowledgment
    const buffer = Buffer.from([
      0x78, 0x78,
      0x06, // Length includes ModuleID
      0x9c, // Protocol
      moduleId,
      (serialNumber >> 8) & 0xff,
      serialNumber & 0xff,
    ]);

    const crc = calculateCRCITU(buffer, 2, 7);

    return Buffer.concat([
      buffer,
      Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
      Buffer.from([0x0d, 0x0a]),
    ]);
  }
}


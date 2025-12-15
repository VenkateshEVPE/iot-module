/**
 * External Device Transfer Protocol Handler (0x9B)
 * Based on Concox V5 Protocol Manual - Section 11
 * For X3 devices with external sensors/modules
 */

import { getHeaderSize } from '@concox/shared/parser.js';
import { calculateCRCITU } from '@concox/shared/crc.js';

/**
 * Parse External Device Transfer packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed external device data
 */
export function parseExternalDeviceTransfer(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // External Device Transfer structure (Manual page 31):
  // Start(2) + Length(1-2) + Protocol(1) + DataLength(1) + TransparentData(N) + Serial(2) + CRC(2) + Stop(2)
  
  const dataLength = packet[dataStart];
  const transparentData = packet.slice(dataStart + 1, dataStart + 1 + dataLength);
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    dataLength,
    transparentData: transparentData.toString('hex').toUpperCase(),
    transparentDataRaw: transparentData,
    serialNumber,
  };
}

/**
 * Create External Device Transfer response
 * @param {number} serialNumber - Serial number from device
 * @param {Buffer} responseData - Optional response data to send to device
 * @returns {Buffer} Response packet
 */
export function createExternalDeviceResponse(serialNumber, responseData = null) {
  if (responseData) {
    // Send data back to external device
    const dataLength = responseData.length;
    const totalLength = 1 + dataLength + 2; // Protocol(1) + DataLength(1) + Data + Serial(2) + CRC(2)
    
    let buffer;
    if (totalLength < 256) {
      buffer = Buffer.from([
        0x78, 0x78,
        totalLength + 2, // +2 for CRC
        0x9b, // Protocol
        dataLength,
      ]);
    } else {
      buffer = Buffer.from([
        0x79, 0x79,
        (totalLength + 2) >> 8,
        (totalLength + 2) & 0xff,
        0x9b, // Protocol
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
      0x05,
      0x9b, // Protocol
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
}


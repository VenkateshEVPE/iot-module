/**
 * Large File Transfer Protocol Handler (0x8D)
 * Based on Concox V5 Protocol Manual - Section 14
 * For HVT001 devices - voice file transfers
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';
import crypto from 'crypto';

/**
 * Parse Large File Transfer packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed file transfer data
 */
export function parseFileTransfer(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // File Transfer structure (Manual page 39):
  // Start(2) + Length(2) + Protocol(1) + FileType(1) + FileLength(4) + ErrorCheckType(1) + ErrorCheck(N) + StartPosition(4) + CurrentLength(2) + Content(M) + FlagBit(N) + Serial(2) + CRC(2) + Stop(2)
  // Note: This is always a long packet (0x79 0x79)
  
  const fileType = packet[dataStart];
  const fileLength = packet.readUInt32BE(dataStart + 1);
  const errorCheckType = packet[dataStart + 5];
  
  let errorCheckOffset = dataStart + 6;
  let errorCheck = null;
  
  if (errorCheckType === 0x00) {
    // CRC check (2 bytes)
    errorCheck = packet.readUInt16BE(errorCheckOffset);
    errorCheckOffset += 2;
  } else if (errorCheckType === 0x01) {
    // MD5 check (16 bytes)
    errorCheck = packet.slice(errorCheckOffset, errorCheckOffset + 16).toString('hex').toUpperCase();
    errorCheckOffset += 16;
  }
  
  const startPosition = packet.readUInt32BE(errorCheckOffset);
  const currentContentLength = packet.readUInt16BE(errorCheckOffset + 4);
  const content = packet.slice(errorCheckOffset + 6, errorCheckOffset + 6 + currentContentLength);
  
  // Flag bit position depends on file type
  let flagBitOffset = errorCheckOffset + 6 + currentContentLength;
  let flagBit = null;
  
  const fileTypes = {
    0x00: "Voice file (monitoring)",
    0x01: "Voice file (SOS)",
    0x02: "Intercom voice file",
  };
  
  if (fileType === 0x00 || fileType === 0x02) {
    // 6 bytes: DateTime for monitoring/intercom
    if (flagBitOffset + 6 <= packet.length - 6) {
      const datetime = {
        year: 2000 + packet[flagBitOffset],
        month: packet[flagBitOffset + 1],
        day: packet[flagBitOffset + 2],
        hour: packet[flagBitOffset + 3],
        minute: packet[flagBitOffset + 4],
        second: packet[flagBitOffset + 5],
      };
      flagBit = {
        type: 'datetime',
        value: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
        raw: datetime,
      };
    }
  } else if (fileType === 0x01) {
    // 2 bytes: SOS alarm packet serial number
    if (flagBitOffset + 2 <= packet.length - 6) {
      flagBit = {
        type: 'serial',
        value: packet.readUInt16BE(flagBitOffset),
      };
    }
  }
  
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  return {
    fileType: fileTypes[fileType] || `Unknown (0x${fileType.toString(16)})`,
    fileTypeRaw: fileType,
    fileLength,
    errorCheckType: errorCheckType === 0x00 ? 'CRC' : 'MD5',
    errorCheck,
    startPosition,
    currentContentLength,
    contentLength: content.length,
    content, // Raw content buffer
    flagBit,
    serialNumber,
    isComplete: (startPosition + currentContentLength) >= fileLength,
    progress: ((startPosition + currentContentLength) / fileLength * 100).toFixed(2) + '%',
  };
}

/**
 * Verify file content checksum
 * @param {Buffer} content - File content
 * @param {string|number} errorCheck - Error check value (CRC or MD5)
 * @param {number} errorCheckType - 0x00 for CRC, 0x01 for MD5
 * @returns {boolean} True if checksum matches
 */
export function verifyFileChecksum(content, errorCheck, errorCheckType) {
  if (errorCheckType === 0x00) {
    // CRC check
    const calculatedCRC = calculateCRCITU(content);
    return calculatedCRC === errorCheck;
  } else if (errorCheckType === 0x01) {
    // MD5 check
    const calculatedMD5 = crypto.createHash('md5').update(content).digest('hex').toUpperCase();
    return calculatedMD5 === errorCheck.toUpperCase();
  }
  return false;
}

/**
 * Create File Transfer acknowledgment
 * @param {number} serialNumber - Serial number from device
 * @param {boolean} success - Whether file chunk was received successfully
 * @returns {Buffer} Acknowledgment packet
 */
export function createFileTransferAck(serialNumber, success = true) {
  // According to manual, server should acknowledge file transfer
  const buffer = Buffer.from([
    0x79, 0x79, // Always long packet
    0x00, 0x06, // Length
    0x8d, // Protocol: File Transfer
    success ? 0x01 : 0x00, // Success flag
    (serialNumber >> 8) & 0xff,
    serialNumber & 0xff,
  ]);

  const crc = calculateCRCITU(buffer, 4, 8);

  return Buffer.concat([
    buffer,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
    Buffer.from([0x0d, 0x0a]),
  ]);
}


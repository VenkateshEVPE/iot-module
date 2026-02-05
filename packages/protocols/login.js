/**
 * Login Protocol Handler (0x01)
 */

import { getHeaderSize } from '../shared/parser.js';
import { extractIMEI } from '../shared/imei.js';
import { calculateCRCITU } from '../shared/crc.js';

export function parseLogin(packet) {
  const headerSize = getHeaderSize(packet);
  const imeiBytes = packet.slice(headerSize + 1, headerSize + 9);
  const imei = extractIMEI(imeiBytes);
  const serialNumber = packet.readUInt16BE(packet.length - 6);
  
  return { imei, serialNumber, imeiBytes };
}

export function createLoginAck(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x01,
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


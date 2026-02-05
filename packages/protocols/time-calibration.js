/**
 * Time Calibration Protocol Handler (0x8A)
 */

import { calculateCRCITU } from '../shared/crc.js';

export function parseTimeCalibration(packet) {
  const serialNumber = packet.readUInt16BE(packet.length - 6);
  return { serialNumber };
}

export function createTimeCalibrationResponse(serialNumber, date) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x0b,
    0x8a,
    date.getFullYear() - 2000,
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    (serialNumber >> 8) & 0xff,
    serialNumber & 0xff,
  ]);
  const crc = calculateCRCITU(buffer, 2, 12);
  return Buffer.concat([
    buffer,
    Buffer.from([(crc >> 8) & 0xff, crc & 0xff]),
    Buffer.from([0x0d, 0x0a]),
  ]);
}


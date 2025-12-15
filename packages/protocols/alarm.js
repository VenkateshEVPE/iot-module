/**
 * Alarm Protocol Handler (0x26)
 */

import { getHeaderSize } from '@concox/shared/parser.js';
import { calculateCRCITU } from '@concox/shared/crc.js';

export function parseAlarm(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;

  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  const alarmByte = packet[packet.length - 8];
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  const alarmTypes = {
    0x00: "Normal", 0x01: "SOS", 0x02: "Power Cut Alarm", 0x03: "Vibration Alarm",
    0x04: "Enter Fence Alarm", 0x05: "Exit Fence Alarm", 0x06: "Over Speed Alarm",
    0x09: "Moving Alarm", 0x0A: "Enter GPS Dead Zone", 0x0B: "Exit GPS Dead Zone",
    0x0C: "Power On Alarm", 0x0D: "GPS First Fix", 0x0E: "External Low Battery",
    0x0F: "External Low Battery Protection", 0x10: "SIM Change Notice",
    0x11: "Power Off Alarm", 0x13: "Disassemble Alarm", 0x14: "Door Alarm",
    0x19: "Internal Low Battery Alarm", 0x20: "Sleep Mode Alarm", 0x23: "Fall Alarm",
    0xFE: "ACC On Alarm", 0xFF: "ACC Off Alarm",
  };

  return {
    datetime,
    alarmType: alarmTypes[alarmByte] || `Unknown (0x${alarmByte.toString(16)})`,
    alarmByte,
    serialNumber,
  };
}

export function createAlarmAck(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x26,
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


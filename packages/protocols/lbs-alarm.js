/**
 * LBS Alarm Protocol Handler (0x19)
 * Based on Concox V5 Protocol Manual
 */

import { isLongPacket, getHeaderSize } from '@concox/shared/parser.js';
import { calculateCRCITU } from '@concox/shared/crc.js';

/**
 * Parse LBS Alarm packet
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed LBS alarm data
 */
export function parseLBSAlarm(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;
  
  // LBS Alarm structure (similar to GPS alarm but with LBS location)
  // Start(2) + Length(1) + Protocol(1) + DateTime(6) + LBSData + AlarmType(1) + Serial(2) + CRC(2) + Stop(2)
  
  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  // LBS data (MCC, MNC, LAC, Cell ID)
  const mcc = packet.readUInt16BE(dataStart + 6);
  const mnc = packet[dataStart + 8];
  const lac = packet.readUInt16BE(dataStart + 9);
  const cellId = packet.readUIntBE(dataStart + 11, 3);

  // Alarm type (before serial number)
  const alarmByte = packet[packet.length - 8];
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  const alarmTypes = {
    0x00: "Normal",
    0x01: "SOS",
    0x02: "Power Cut Alarm",
    0x03: "Vibration Alarm",
    0x04: "Enter Fence Alarm",
    0x05: "Exit Fence Alarm",
    0x06: "Over Speed Alarm",
    0x09: "Moving Alarm",
    0x0A: "Enter GPS Dead Zone",
    0x0B: "Exit GPS Dead Zone",
    0x0C: "Power On Alarm",
    0x0D: "GPS First Fix",
    0x0E: "External Low Battery",
    0x0F: "External Low Battery Protection",
    0x10: "SIM Change Notice",
    0x11: "Power Off Alarm",
    0x13: "Disassemble Alarm",
    0x14: "Door Alarm",
    0x19: "Internal Low Battery Alarm",
    0x20: "Sleep Mode Alarm",
    0x23: "Fall Alarm",
    0xFE: "ACC On Alarm",
    0xFF: "ACC Off Alarm",
  };

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    lbs: {
      mcc,
      mnc,
      lac,
      cellId: cellId.toString(16).toUpperCase().padStart(6, '0'),
    },
    alarmType: alarmTypes[alarmByte] || `Unknown (0x${alarmByte.toString(16)})`,
    alarmByte,
    serialNumber,
  };
}

/**
 * Create LBS Alarm acknowledgment
 * @param {number} serialNumber - Serial number from device
 * @returns {Buffer} Acknowledgment packet
 */
export function createLBSAlarmAck(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x19, // Protocol: LBS Alarm
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


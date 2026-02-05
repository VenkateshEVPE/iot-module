/**
 * LBS Alarm Protocol Handler (0x19)
 * Based on Concox V5 Protocol Manual
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';


/**
 * Parse LBS Alarm packet
 * Per V5 Protocol PDF section 7.1 (page 21): No Date/Time. Content = MCC, MNC, LAC, Cell ID, Terminal Info, Voltage, GSM, Alarm/Language.
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed LBS alarm data
 */
export function parseLBSAlarm(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1;

  // LBS Alarm structure (PDF page 21):
  // Start(2) + Length(1) + Protocol(1) + MCC(2) + MNC(1) + LAC(2) + CellID(3) + TerminalInfo(1) + Voltage(1) + GSM(1) + Alarm/Language(2) + Serial(2) + CRC(2) + Stop(2)
  const mcc = packet.readUInt16BE(dataStart);
  const mnc = packet[dataStart + 2];
  const lac = packet.readUInt16BE(dataStart + 3);
  const cellId = packet.readUIntBE(dataStart + 5, 3);
  const terminalInfo = packet[dataStart + 8];
  const voltageLevel = packet[dataStart + 9];
  const gsmSignal = packet[dataStart + 10];
  const alarmByte = packet[dataStart + 11];
  const languageByte = packet[dataStart + 12];
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  const alarmTypes = {
    0x00: "Normal",
    0x01: "SOS",
    0x02: "Power Cut Alarm",
    0x03: "Vibration Alarm",
    0x04: "Enter Fence Alarm",
    0x05: "Exit Fence Alarm",
    0x06: "Over Speed Alarm",
    0x09: "Vibration alarm",
    0x0A: "Enter GPS dead zone alarm",
    0x0B: "Exit GPS dead zone alarm",
    0x0C: "Power on alarm",
    0x0D: "GPS First fix notice",
    0x0E: "External Low battery alarm",
    0x0F: "Low battery protection alarm",
    0x10: "SIM change notice",
    0x11: "Power off alarm",
    0x12: "Airplane mode alarm",
    0x13: "Disassemble alarm",
    0x14: "Door alarm",
    0x19: "Internal low Battery Alarm",
    0x20: "Sleep mode alarm",
    0x23: "Fall alarm",
    0xFE: "ACC On alarm",
    0xFF: "ACC Off alarm",
  };

  const languageMap = { 0x00: "no_reply", 0x01: "Chinese", 0x02: "English" };

  return {
    lbs: {
      mcc,
      mnc,
      lac,
      cellId: cellId.toString(16).toUpperCase().padStart(6, "0"),
    },
    terminalInfo,
    voltageLevel,
    gsmSignal,
    alarmType: alarmTypes[alarmByte] || `Unknown (0x${alarmByte.toString(16)})`,
    alarmByte,
    language: languageMap[languageByte] ?? `Unknown (0x${languageByte.toString(16)})`,
    languageByte,
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


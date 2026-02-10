/**
 * Alarm Data HVT001 Protocol Handler (0x27 / 0x26 variations)
 * Based on Concox V5 Protocol Manual
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';

/**
 * Parse Alarm Data packet (handles 0x26 and HVT001 0x27 formats)
 * @param {Buffer} packet - Packet buffer
 * @returns {Object} Parsed alarm data
 */
export function parseAlarmHVT001(packet) {
  const headerSize = getHeaderSize(packet);
  const dataStart = headerSize + 1; // protocol byte is at headerSize

  const datetime = {
    year: 2000 + packet[dataStart],
    month: packet[dataStart + 1],
    day: packet[dataStart + 2],
    hour: packet[dataStart + 3],
    minute: packet[dataStart + 4],
    second: packet[dataStart + 5],
  };

  // Initialize result fields
  let gpsData = null;
  let lbs = null;

  // GPS info: one byte where high nibble = GPS info length, low nibble = satellite count
  const gpsInfoIndex = dataStart + 6;
  if (packet.length > gpsInfoIndex) {
    const gpsInfo = packet[gpsInfoIndex];
    const gpsInfoLen = gpsInfo >> 4;
    const satellites = gpsInfo & 0x0f;

    // Only parse latitude/longitude if gpsInfoLen indicates GPS data present
    if (gpsInfoLen > 0 && satellites > 0 && packet.length >= gpsInfoIndex + 1 + 4 + 4 + 1 + 2) {
      const latIndex = gpsInfoIndex + 1;
      const lonIndex = latIndex + 4;
      const speedIndex = lonIndex + 4;
      const courseIndex = speedIndex + 1;

      const rawLat = packet.readUInt32BE(latIndex);
      const rawLon = packet.readUInt32BE(lonIndex);
      const speed = packet[speedIndex];
      const courseStatus = packet.readUInt16BE(courseIndex);

      const byte1 = (courseStatus >> 8) & 0xff;
      const byte2 = courseStatus & 0xff;

      // Course is 10 bits: low 2 bits of byte1 and full byte2
      const course = ((byte1 & 0x03) << 8) | byte2;

      // Status bits (refer to protocol doc):
      const gpsPositioned = (byte1 & 0x10) !== 0; // bit4: GPS positioned
      // According to docs/example: bit3==0 => East, bit3==1 => West
      const longitudePositive = (byte1 & 0x08) === 0;
      // According to docs/example: bit2==1 => North, bit2==0 => South
      const latitudePositive = (byte1 & 0x04) !== 0;

      const latitude = (rawLat / 1800000.0) * (latitudePositive ? 1 : -1);
      const longitude = (rawLon / 1800000.0) * (longitudePositive ? 1 : -1);

      gpsData = {
        rawLat,
        rawLon,
        latitude: Number(latitude.toFixed(6)),
        longitude: Number(longitude.toFixed(6)),
        speed,
        course,
        satellites,
        positioned: gpsPositioned,
        statusByte: byte1,
      };

      // Parse LBS block (follows course/status)
      const lbsStart = courseIndex + 2;
      if (packet.length > lbsStart) {
        const lbsLen = packet[lbsStart];
        // Commonly MCC(2)+MNC(1)+LAC(2)+CI(3) = 8 bytes, but use lbsLen to bound reads
        const expected = lbsStart + 1 + lbsLen;
        if (packet.length >= expected) {
          const mcc = packet.readUInt16BE(lbsStart + 1);
          const mnc = packet[lbsStart + 3];
          const lac = packet.readUInt16BE(lbsStart + 4);
          const ci = ((packet[lbsStart + 6] << 16) | (packet[lbsStart + 7] << 8) | packet[lbsStart + 8]) >>> 0;
          lbs = { length: lbsLen, mcc, mnc, lac, ci };
        }
      }
    }
  }

  // Alarm byte is located before serial number: packet.length - 8
  const alarmByte = packet.length >= 8 ? packet[packet.length - 8] : undefined;

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
    0x12: "Airplane Mode Alarm",
    0x13: "Disassemble Alarm",
    0x14: "Door Alarm",
    0x15: "Shutdown Alarm (Low Power)",
    0x16: "Sound Alarm",
    0x19: "Internal Low Battery Alarm",
    0x20: "Sleep Mode Alarm",
    0x23: "Fall Alarm",
    0x29: "Harsh Acceleration Alarm",
    0x30: "Harsh Braking Alarm",
    0x2A: "Sharp Left Turn Alarm",
    0x2B: "Sharp Right Turn Alarm",
    0x2C: "Sharp Crash Alarm",
    0x32: "Pull Alarm", // documented in v5 protocol
    0x3E: "Press Button Upload",
    0xFE: "ACC On Alarm",
    0xFF: "ACC Off Alarm",
  };

  const serialNumber = packet.length >= 6 ? packet.readUInt16BE(packet.length - 6) : undefined;

  // Terminal info fields (try to read relative to end when GPS/LBS absent/present)
  // We'll attempt to read common fields if the packet is long enough.
  let terminalInfo = {};
  try {
    // terminal info byte commonly located just before battery/gsm/alarm bytes.
    // Using known offsets from sample: index = packet.length - 11 (approx), but parse from earlier LBS end if available.
    let termIndexGuess = packet.length - 11;
    if (lbs && gpsData) {
      // compute exact index: header + 1(protocol) + 6(datetime) + 1(gpsInfo) + gps block + 1(lbsLen) + lbsLen + remaining fields...
      // Simpler: find alarmByte index and step back to terminal info: alarmByteIndex = packet.length - 8
      const alarmIndex = packet.length - 8;
      // In protocol, terminal info is 3 bytes before alarm/language pair in many packets (terminalInfo, battery, gsm)
      const termInfoIndex = alarmIndex - 4;
      if (termInfoIndex > 0 && termInfoIndex < packet.length) {
        const terminalByte = packet[termInfoIndex];
        const battery = packet[termInfoIndex + 1];
        const gsm = packet[termInfoIndex + 2];
        terminalInfo = { terminalByte, battery, gsm };
      }
    }
  } catch (e) {
    // ignore and continue with what we have
  }

  return {
    datetime: `${datetime.year}-${String(datetime.month).padStart(2, "0")}-${String(datetime.day).padStart(2, "0")} ${String(datetime.hour).padStart(2, "0")}:${String(datetime.minute).padStart(2, "0")}:${String(datetime.second).padStart(2, "0")}`,
    gpsData,
    lbs,
    alarmType: alarmByte !== undefined ? (alarmTypes[alarmByte] || `Unknown (0x${alarmByte.toString(16)})`) : undefined,
    alarmByte,
    serialNumber,
    terminalInfo,
  };
}

/**
 * Create Alarm HVT001 acknowledgment
 * @param {number} serialNumber - Serial number from device
 * @returns {Buffer} Acknowledgment packet
 */
export function createAlarmHVT001Ack(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x27, // Protocol: Alarm HVT001
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

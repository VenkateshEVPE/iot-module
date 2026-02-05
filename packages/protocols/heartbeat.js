/**
 * Heartbeat Protocol Handler (0x13)
 */

import { getHeaderSize } from '../shared/parser.js';
import { calculateCRCITU } from '../shared/crc.js';

export function parseHeartbeat(packet) {
  const headerSize = getHeaderSize(packet);
  const terminalInfo = packet[headerSize + 1];
  const batteryLevel = packet[headerSize + 2];
  const gsmSignal = packet[headerSize + 3];
  const serialNumber = packet.readUInt16BE(packet.length - 6);

  const info = {
    oilElectricityDisconnected: (terminalInfo & 0x80) !== 0,
    gpsTracking: (terminalInfo & 0x40) !== 0,
    charging: (terminalInfo & 0x04) !== 0,
    accHigh: (terminalInfo & 0x02) !== 0,
    defenseActivated: (terminalInfo & 0x01) !== 0,
  };

  return {
    terminalInfo,
    batteryLevel,
    gsmSignal,
    info,
    serialNumber,
  };
}

export function createHeartbeatAck(serialNumber) {
  const buffer = Buffer.from([
    0x78, 0x78,
    0x05,
    0x13,
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


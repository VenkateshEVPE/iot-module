/**
 * Information Transmission Protocol Handler (0x94)
 */

import { getHeaderSize } from '@concox/shared/parser.js';

export function parseInformationTransmission(packet) {
  const headerSize = getHeaderSize(packet);
  const protocolNumberPos = headerSize;
  const subProtocolNumber = packet[protocolNumberPos + 1];
  
  const result = {
    subProtocol: subProtocolNumber,
    data: null,
  };

  switch (subProtocolNumber) {
    case 0x00:
      // External power voltage
      result.data = {
        type: 'voltage',
        voltage: packet.readUInt16BE(protocolNumberPos + 2) / 100,
      };
      break;
      
    case 0x04:
      // Terminal status synchronization
      const statusData = packet.slice(protocolNumberPos + 2, packet.length - 6).toString('ascii');
      const statusParts = statusData.split(';');
      const status = {};
      statusParts.forEach(part => {
        const [key, value] = part.split('=');
        if (key && value) status[key.trim()] = value.trim();
      });
      result.data = { type: 'status', status };
      break;
      
    case 0x05:
      // Door status
      const doorStatus = packet[protocolNumberPos + 2];
      result.data = {
        type: 'door',
        doorOpen: (doorStatus & 0x01) !== 0,
        triggering: (doorStatus & 0x02) !== 0 ? "High" : "Low",
        ioStatus: (doorStatus & 0x04) !== 0 ? "High" : "Low",
      };
      break;
      
    case 0x06:
      result.data = { type: 'voltage_mileage' };
      break;
      
    case 0x0A:
      // ICCID
      const iccid = packet.slice(protocolNumberPos + 2, protocolNumberPos + 12).toString('hex');
      result.data = { type: 'iccid', iccid };
      break;
      
    case 0x0D:
      result.data = { type: 'fuel_sensor' };
      break;
      
    default:
      result.data = { type: 'unknown', raw: packet.slice(protocolNumberPos + 2, packet.length - 6) };
  }

  return result;
}


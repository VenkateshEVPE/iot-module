/**
 * GPS Location Protocol Handler (0x22)
 */

import { getHeaderSize } from '../shared/parser.js';

export function parseGPSLocation(packet) {
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

  const gpsInfo = packet[dataStart + 6];
  const satellites = gpsInfo & 0x0F;
  const latitude = packet.readUInt32BE(dataStart + 7) / 1800000.0;
  const longitude = packet.readUInt32BE(dataStart + 11) / 1800000.0;
  const speed = packet[dataStart + 15];
  const courseStatus = packet.readUInt16BE(dataStart + 16);
  
  const byte1 = (courseStatus >> 8) & 0xFF;
  const byte2 = courseStatus & 0xFF;
  const course = ((byte1 & 0x03) << 8) | byte2;
  const gpsPositioned = (byte1 & 0x10) !== 0;
  const latitudeNS = (byte1 & 0x04) !== 0 ? "S" : "N";
  const longitudeEW = (byte1 & 0x08) !== 0 ? "W" : "E";

  const finalLatitude = latitudeNS === "S" ? -latitude : latitude;
  const finalLongitude = longitudeEW === "W" ? -longitude : longitude;

  const mcc = packet.readUInt16BE(dataStart + 18);
  const mnc = packet[dataStart + 20];
  const lac = packet.readUInt16BE(dataStart + 21);
  const cellId = packet.readUIntBE(dataStart + 23, 3);
  
  let acc = null;
  let dataUploadMode = null;
  let mileage = null;
  
  if (packet.length >= dataStart + 30) {
    acc = packet[dataStart + 26];
    dataUploadMode = packet[dataStart + 27];
  }
  
  if (packet.length >= dataStart + 33) {
    mileage = packet.readUInt32BE(packet.length - 10);
  }

  return {
    datetime,
    satellites,
    latitude: finalLatitude,
    longitude: finalLongitude,
    speed,
    course,
    gpsPositioned,
    lbs: { mcc, mnc, lac, cellId },
    acc,
    dataUploadMode,
    mileage,
  };
}


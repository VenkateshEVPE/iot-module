/**
 * Protocol number definitions and utilities
 */

export const PROTOCOL_NUMBERS = {
  LOGIN: 0x01,
  HEARTBEAT: 0x13,
  GPS_LOCATION: 0x22,
  ALARM: 0x26,
  LBS_ALARM: 0x19,
  ALARM_HVT001: 0x27,
  LBS_EXTENSION: 0x28,
  WIFI: 0x2c,
  ONLINE_COMMAND: 0x80,
  COMMAND_RESPONSE: 0x21,
  COMMAND_RESPONSE_JM01: 0x15,
  TIME_CALIBRATION: 0x8a,
  INFORMATION_TRANSMISSION: 0x94,
  EXTERNAL_DEVICE_TRANSFER: 0x9b,
  EXTERNAL_MODULE_TRANSMISSION: 0x9c,
  LARGE_FILE_TRANSFER: 0x8d,
};

export const PROTOCOL_NAMES = {
  0x01: "Login Information",
  0x13: "Heartbeat Packet",
  0x22: "Positioning Data (UTC)",
  0x26: "Alarm Data (UTC)",
  0x19: "LBS Alarm",
  0x27: "Alarm Data HVT001 (UTC)",
  0x28: "LBS Multiple Bases Extension",
  0x2c: "WIFI Communication Protocol",
  0x80: "Online Command",
  0x21: "Online Command Response",
  0x15: "Online Command Response JM01",
  0x8a: "Time Check Packet",
  0x94: "Information Transmission Packet",
  0x9b: "External Device Transfer (X3)",
  0x9c: "External Module Transmission (U20)",
  0x8d: "Large File Transfer (HVT001)",
};

/**
 * Get protocol name by number
 * @param {number} protocolNumber - Protocol number
 * @returns {string} Protocol name
 */
export function getProtocolName(protocolNumber) {
  return PROTOCOL_NAMES[protocolNumber] || "Unknown";
}

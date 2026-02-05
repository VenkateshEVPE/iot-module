/**
 * Generate Parsed_Packet_Structures.xlsx — Packet Type as section heading, columns: Field | Data Type.
 * Run: node scripts/generate-parsed-structures-excel.js
 */

import XLSX from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const outPath = join(rootDir, "Parsed_Packet_Structures.xlsx");

// Alarm type example values — Manual page 19 only
const ALARM_TYPE_EXAMPLES =
  "string (e.g. SOS, Power Cut, Vibration, Enter Fence, Exit Fence, Over Speed, Disassemble, Low Battery, ACC On, ACC Off)";
const ALARM_BYTE_EXAMPLES =
  "number (hex). 0x01=SOS (panic), 0x02=Power Cut, 0x03=Vibration, 0x04=Enter Fence, 0x05=Exit Fence, 0x06=Over Speed, 0x13=Disassemble (tamper), 0x19=Low Battery, 0xFE=ACC On, 0xFF=ACC Off";

// Each item: [ packetTypeHeading, [ [field, dataType], ... ] ]
// Heartbeat: no terminalInfo (device sends the byte but we expose only decoded info in logs)
const sections = [
  [
    "Login (0x01) — parseLogin(packet)",
    [
      ["imei", "string"],
      ["serialNumber", "number"],
      ["imeiBytes", "Buffer"],
    ],
  ],
  [
    "Heartbeat (0x13) — parseHeartbeat(packet)",
    [
      ["imei", "string (from device login, added by server in log)"],
      ["batteryLevel", "number (0–6)"],
      ["gsmSignal", "number (0–4)"],
      ["info.oilElectricityDisconnected", "boolean"],
      ["info.gpsTracking", "boolean"],
      ["info.charging", "boolean"],
      ["info.accHigh", "boolean"],
      ["info.defenseActivated", "boolean"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "GPS Location (0x22) — parseGPSLocation(packet)",
    [
      ["imei", "string (from device login, added by server in log)"],
      ["datetime.year", "number"],
      ["datetime.month", "number"],
      ["datetime.day", "number"],
      ["datetime.hour", "number"],
      ["datetime.minute", "number"],
      ["datetime.second", "number"],
      ["satellites", "number"],
      ["latitude", "number"],
      ["longitude", "number"],
      ["speed", "number"],
      ["course", "number"],
      ["gpsPositioned", "boolean"],
      ["lbs.mcc", "number"],
      ["lbs.mnc", "number"],
      ["lbs.lac", "number"],
      ["lbs.cellId", "number"],
      ["acc", "number | null"],
      ["dataUploadMode", "number | null"],
      ["mileage", "number | null"],
    ],
  ],
  [
    "Alarm (0x26) — parseAlarm(packet)",
    [
      ["datetime", "object { year, month, day, hour, minute, second }"],
      ["alarmType", ALARM_TYPE_EXAMPLES],
      ["alarmByte", ALARM_BYTE_EXAMPLES],
      ["serialNumber", "number"],
    ],
  ],
  [
    "Alarm HVT001 (0x27) — parseAlarmHVT001(packet)",
    [
      ["datetime", "string"],
      ["gpsData", "object | null"],
      ["alarmType", ALARM_TYPE_EXAMPLES],
      ["alarmByte", ALARM_BYTE_EXAMPLES],
      ["serialNumber", "number"],
    ],
  ],
  [
    "LBS Extension (0x28) — parseLBSExtension(packet)",
    [
      ["baseStationCount", "number"],
      ["baseStations", "Array<{ index, mcc, mnc, lac, cellId, signal }>"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "LBS Alarm (0x19) — parseLBSAlarm(packet)",
    [
      ["datetime", "string"],
      ["lbs.mcc", "number"],
      ["lbs.mnc", "number"],
      ["lbs.lac", "number"],
      ["lbs.cellId", "string"],
      ["alarmType", ALARM_TYPE_EXAMPLES],
      ["alarmByte", ALARM_BYTE_EXAMPLES],
      ["serialNumber", "number"],
    ],
  ],
  [
    "Command Response (0x21) — parseCommandResponse(packet)",
    [
      ["serverFlag", "string"],
      ["responseLength", "number"],
      ["actualResponseLength", "number"],
      ["response", "string"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "Command Response JM01 (0x15) — parseCommandResponseJM01(packet)",
    [
      ["responseLength", "number"],
      ["response", "string"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "WiFi (0x2C) — parseWiFi(packet)",
    [
      ["datetime", "string"],
      ["wifiCount", "number"],
      ["accessPoints", "Array<{ index, mac, signal, signalStrength }>"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "Time Calibration (0x8A) — parseTimeCalibration(packet)",
    [["serialNumber", "number"]],
  ],
  [
    "Information Transmission (0x94) — parseInformationTransmission(packet)",
    [
      ["subProtocol", "number"],
      ["data.type", "string"],
      ["data.voltage", "number (when type=voltage)"],
      ["data.status", "object (when type=status)"],
      ["data.doorOpen", "boolean (when type=door)"],
      ["data.iccid", "string (when type=iccid)"],
      ["data", "object | null"],
    ],
  ],
  [
    "File Transfer (0x8D) — parseFileTransfer(packet)",
    [
      ["fileType", "string"],
      ["fileTypeRaw", "number"],
      ["fileLength", "number"],
      ["errorCheckType", "'CRC' | 'MD5'"],
      ["errorCheck", "number | string"],
      ["startPosition", "number"],
      ["currentContentLength", "number"],
      ["contentLength", "number"],
      ["content", "Buffer"],
      ["flagBit", "object | null"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "External Device (0x9B) — parseExternalDeviceTransfer(packet)",
    [
      ["dataLength", "number"],
      ["transparentData", "string"],
      ["transparentDataRaw", "Buffer"],
      ["serialNumber", "number"],
    ],
  ],
  [
    "External Module (0x9C) — parseExternalModuleTransmission(packet)",
    [
      ["moduleId", "number"],
      ["dataLength", "number"],
      ["transparentData", "string"],
      ["transparentDataRaw", "Buffer"],
      ["serialNumber", "number"],
    ],
  ],
];

// Build sheet: separate table per packet type; packet type = heading row; columns = "Field" | "Data Type"; one empty row between tables
const data = [];
const merges = []; // merge packet-type heading across A:B
let row = 0;

for (let i = 0; i < sections.length; i++) {
  const [packetType, fields] = sections[i];
  data.push([packetType, ""]); // table heading (packet type) — merged across A:B
  merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 1 } });
  row += 1;

  data.push(["Field", "Data Type"]); // column headers (only these two columns)
  row += 1;

  for (const [field, dataType] of fields) {
    data.push([field, dataType]);
    row += 1;
  }

  if (i < sections.length - 1) {
    data.push(["", ""]); // one empty row between tables
    row += 1;
  }
}

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(data);
ws["!merges"] = merges;

ws["!cols"] = [
  { wch: 52 },
  { wch: 100 },
];

XLSX.utils.book_append_sheet(wb, ws, "Parsed Packet Structures");
XLSX.writeFile(wb, outPath);
console.log("Written:", outPath);

# Parsed Packet Structures — Device-Sent Packets (Concox V5)

This document describes the **parsed object structure** returned by each protocol parser for every packet type the **device sends** to the server.

---

## 1. Login (0x01) — `parseLogin(packet)`

```ts
{
  imei: string,           // Device IMEI (from 8 bytes)
  serialNumber: number,   // 16-bit serial
  imeiBytes: Buffer       // Raw 8-byte IMEI
}
```

---

## 2. Heartbeat (0x13) — `parseHeartbeat(packet)`

```ts
{
  terminalInfo: number,    // Raw terminal info byte
  batteryLevel: number,   // 0–6 (No Power … Full)
  gsmSignal: number,      // 0–4 (no signal … strong)
  info: {
    oilElectricityDisconnected: boolean,
    gpsTracking: boolean,
    charging: boolean,
    accHigh: boolean,
    defenseActivated: boolean
  },
  serialNumber: number
}
```

---

## 3. GPS Location (0x22) — `parseGPSLocation(packet)`

```ts
{
  datetime: {
    year: number,   // 2000 + byte
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  },
  satellites: number,
  latitude: number,        // Signed decimal degrees
  longitude: number,
  speed: number,
  course: number,
  gpsPositioned: boolean,
  lbs: { mcc: number, mnc: number, lac: number, cellId: number },
  acc: number | null,
  dataUploadMode: number | null,
  mileage: number | null   // Odometer (meters), if present
}
```

---

## 4. Alarm (0x26) — `parseAlarm(packet)`

```ts
{
  datetime: {
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  },
  alarmType: string,   // e.g. "SOS", "Power Cut Alarm", "Vibration Alarm"
  alarmByte: number,   // Raw alarm code
  serialNumber: number
}
```

---

## 5. LBS Alarm (0x19) — `parseLBSAlarm(packet)`

No Date/Time in packet; content starts with LBS.

```ts
{
  lbs: {
    mcc: number,
    mnc: number,
    lac: number,
    cellId: string   // Hex string, 6 chars
  },
  terminalInfo: number,
  voltageLevel: number,
  gsmSignal: number,
  alarmType: string,
  alarmByte: number,
  language: string,       // "no_reply" | "Chinese" | "English"
  languageByte: number,
  serialNumber: number
}
```

---

## 6. Alarm HVT001 (0x27) — `parseAlarmHVT001(packet)`

```ts
{
  datetime: string,       // "YYYY-MM-DD HH:mm:ss"
  gpsData: object | null, // { latitude, longitude, speed, course, satellites, positioned }
  alarmType: string,
  alarmByte: number,
  serialNumber: number
}
```

---

## 7. LBS Multiple Bases Extension (0x28) — `parseLBSExtension(packet)`

Fixed layout: Date(6) + main base(9) + 6 neighbors(6 each) + Timing Advance(1) + LANGUAGE(2).

```ts
{
  datetime: string,       // "YYYY-MM-DD HH:mm:ss"
  datetimeRaw: {
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number
  },
  mainBase: {
    mcc: number,
    mnc: number,
    lac: number,
    cellId: string,   // Hex
    rssi: number
  },
  neighbors: Array<{
    index: number,
    lac: number,
    cellId: string,
    rssi: number
  }>,   // Length 6
  timingAdvance: number,
  language: number,
  serialNumber: number
}
```

---

## 8. WiFi (0x2C) — `parseWiFi(packet)`

```ts
{
  datetime: string,
  datetimeRaw: { year, month, day, hour, minute, second },
  lbs: {
    mainBase: { mcc, mnc, lac, cellId, rssi },
    neighbors: Array<{ index, lac, cellId, rssi }>   // 6 entries
  },
  timeLeads: number,
  wifiCount: number,
  accessPoints: Array<{
    index: number,
    mac: string,           // "XX:XX:XX:XX:XX:XX"
    signal: number,        // Signed
    signalStrength: number,
    ssidLength: number,
    ssid: string
  }>,
  serialNumber: number
}
```

---

## 9. Online Command Response (0x21) — `parseCommandResponse(packet)`

```ts
{
  serverFlag: string,           // 4-byte hex
  responseLength: number,      // Declared length
  actualResponseLength: number,
  response: string,            // Response text (ASCII)
  serialNumber: number
}
```

---

## 10. Online Command Response JM01 (0x15) — `parseCommandResponseJM01(packet)`

```ts
{
  responseLength: number,
  response: string,
  serialNumber: number
}
```

---

## 11. Time Calibration Request (0x8A) — `parseTimeCalibration(packet)`

```ts
{
  serialNumber: number
}
```

---

## 12. Information Transmission (0x94) — `parseInformationTransmission(packet)`

```ts
{
  subProtocol: number,
  data: {
    type: 'voltage' | 'status' | 'door' | 'voltage_mileage' | 'iccid' | 'fuel_sensor' | 'unknown',
    // type === 'voltage':  { type, voltage: number }
    // type === 'status':  { type, status: { [key: string]: string } }
    // type === 'door':    { type, doorOpen: boolean, triggering: string, ioStatus: string }
    // type === 'iccid':   { type, iccid: string }
    // type === 'unknown': { type, raw: Buffer }
    ...rest
  } | null
}
```

---

## 13. Large File Transfer (0x8D) — `parseFileTransfer(packet)`

```ts
{
  fileType: string,           // "Voice file (monitoring)" etc.
  fileTypeRaw: number,
  fileLength: number,
  errorCheckType: 'CRC' | 'MD5',
  errorCheck: number | string,
  startPosition: number,
  currentContentLength: number,
  contentLength: number,
  content: Buffer,
  flagBit: {
    type: 'datetime' | 'serial',
    value: string | number,
    raw?: { year, month, day, hour, minute, second }
  } | null,
  serialNumber: number,
  isComplete: boolean,
  progress: string   // e.g. "42.50%"
}
```

---

## 14. External Device Transfer (0x9B) — `parseExternalDeviceTransfer(packet)`

```ts
{
  dataLength: number,
  transparentData: string,    // Hex
  transparentDataRaw: Buffer,
  serialNumber: number
}
```

---

## 15. External Module Transmission (0x9C) — `parseExternalModuleTransmission(packet)`

```ts
{
  moduleId: number,
  dataLength: number,
  transparentData: string,
  transparentDataRaw: Buffer,
  serialNumber: number
}
```

---

## Protocol number quick reference

| Protocol | Number | Parser |
|----------|--------|--------|
| Login | 0x01 | `parseLogin` |
| Heartbeat | 0x13 | `parseHeartbeat` |
| Command Response JM01 | 0x15 | `parseCommandResponseJM01` |
| LBS Alarm | 0x19 | `parseLBSAlarm` |
| GPS Location | 0x22 | `parseGPSLocation` |
| Alarm | 0x26 | `parseAlarm` |
| Alarm HVT001 | 0x27 | `parseAlarmHVT001` |
| LBS Extension | 0x28 | `parseLBSExtension` |
| Command Response | 0x21 | `parseCommandResponse` |
| WiFi | 0x2C | `parseWiFi` |
| Time Calibration | 0x8A | `parseTimeCalibration` |
| Information Transmission | 0x94 | `parseInformationTransmission` |
| Large File Transfer | 0x8D | `parseFileTransfer` |
| External Device | 0x9B | `parseExternalDeviceTransfer` |
| External Module | 0x9C | `parseExternalModuleTransmission` |

---

*Generated from the Concox V5 protocol implementation in this repository.*

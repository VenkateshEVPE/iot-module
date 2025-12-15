# Using as Package in Another Application

Complete guide on how to use Concox V5 Logger packages in your own application.

## 🚀 Quick Start (Local Path - Recommended for Development)

### Step 1: Install in Your App

In your other application's `package.json`:

```json
{
  "name": "my-iot-app",
  "type": "module",
  "dependencies": {
    "@concox/server": "file:../concox-logger/packages/server",
    "@concox/protocols": "file:../concox-logger/packages/protocols",
    "@concox/shared": "file:../concox-logger/packages/shared"
  }
}
```

### Step 2: Install

```bash
cd my-app
npm install
```

### Step 3: Use It

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();
await server.start();
```

## 📦 Installation Options

### Option 1: Local Path (Development)

```json
{
  "dependencies": {
    "@concox/server": "file:../concox-logger/packages/server"
  }
}
```

**Pros:** Fast iteration, no publishing needed  
**Cons:** Requires local path

### Option 2: Publish to npm (Production)

See [PUBLISH_TO_NPM.md](./PUBLISH_TO_NPM.md) for complete publishing guide.

After publishing:

```bash
npm install @yourusername/concox-server
```

### Option 3: Git Repository

```json
{
  "dependencies": {
    "@concox/server": "git+https://github.com/yourusername/concox-logger.git#main:packages/server"
  }
}
```

## 💻 Usage Examples

### Example 1: Basic Server Usage

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();
await server.start();

// Send commands
server.immobilizeVehicle("123456789012345");
server.mobilizeVehicle("123456789012345");
```

### Example 2: Express App Integration

```javascript
import express from "express";
import ConcoxV5Server from "@concox/server";

const app = express();
app.use(express.json());

const concoxServer = new ConcoxV5Server();
await concoxServer.start();

// Your Express routes
app.get("/api/devices", (req, res) => {
  const devices = Array.from(concoxServer.clients.keys()).map((imei) => {
    const client = concoxServer.clients.get(imei);
    return {
      imei,
      connectedAt: client.connectedAt,
      address: client.clientInfo.address,
    };
  });
  res.json(devices);
});

app.post("/api/devices/:imei/immobilize", (req, res) => {
  const { imei } = req.params;
  const success = concoxServer.immobilizeVehicle(imei);
  res.json({ success });
});

app.listen(3000);
```

### Example 3: Use Protocol Handlers Only

If you only need protocol parsing (not the full server):

```javascript
import { parsePacket } from "@concox/shared";
import { parseLogin } from "@concox/protocols/login.js";
import { parseGPSLocation } from "@concox/protocols/gps.js";
import { parseAlarm } from "@concox/protocols/alarm.js";

// Your custom packet processing
function processPacket(buffer) {
  const result = parsePacket(buffer);

  if (!result) {
    return null; // Incomplete packet
  }

  const { packet, protocolNumber } = result;

  switch (protocolNumber) {
    case 0x01:
      return parseLogin(packet);
    case 0x22:
      return parseGPSLocation(packet);
    case 0x26:
      return parseAlarm(packet);
    default:
      return { protocolNumber, raw: packet };
  }
}

// Use it
const data = processPacket(myBuffer);
console.log(data);
```

### Example 4: Custom Server with Extended Logic

```javascript
import ConcoxV5Server from "@concox/server";
import { parseGPSLocation } from "@concox/protocols/gps.js";

class MyCustomServer extends ConcoxV5Server {
  handleGPSLocation(socket, packet, clientInfo) {
    // Call parent handler for standard logging
    super.handleGPSLocation(socket, packet, clientInfo);

    // Add your custom logic
    const location = parseGPSLocation(packet);

    // Save to your database
    this.saveToDatabase({
      imei: socket.deviceImei,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date(),
    });

    // Send to MQTT
    this.publishToMQTT("gps/location", location);

    // Trigger webhook
    this.sendWebhook(location);
  }

  async saveToDatabase(data) {
    // Your database logic
  }

  async publishToMQTT(topic, data) {
    // Your MQTT logic
  }

  async sendWebhook(data) {
    // Your webhook logic
  }
}

const server = new MyCustomServer();
await server.start();
```

### Example 5: Use Shared Utilities

```javascript
import {
  parsePacket,
  extractIMEI,
  calculateCRCITU,
  getProtocolName,
  PROTOCOL_NUMBERS,
} from "@concox/shared";

// Parse any packet
const result = parsePacket(buffer);
console.log("Protocol:", getProtocolName(result.protocolNumber));

// Extract IMEI from bytes
const imei = extractIMEI(imeiBytes);

// Calculate CRC
const crc = calculateCRCITU(data, startIndex, endIndex);

// Use protocol constants
if (result.protocolNumber === PROTOCOL_NUMBERS.GPS_LOCATION) {
  // Handle GPS
}
```

## 📋 Package API Reference

### @concox/shared

**Functions:**
- `parsePacket(buffer)` - Parse Concox packets
- `extractIMEI(bytes)` - Extract IMEI from bytes
- `calculateCRCITU(data, startIndex?, endIndex?)` - Calculate CRC
- `getProtocolName(number)` - Get protocol name

**Constants:**
- `PROTOCOL_NUMBERS` - Protocol number constants
- `PROTOCOL_NAMES` - Protocol name mapping

### @concox/protocols

Each protocol handler exports:

**Parse Functions:**
- `parseLogin(packet)` - Parse login packet
- `parseHeartbeat(packet)` - Parse heartbeat
- `parseGPSLocation(packet)` - Parse GPS location
- `parseAlarm(packet)` - Parse alarm
- And more...

**Create Functions:**
- `createLoginAck(serialNumber)` - Create login ACK
- `createHeartbeatAck(serialNumber)` - Create heartbeat ACK
- `createAlarmAck(serialNumber)` - Create alarm ACK
- And more...

**Available Protocols:**
- `login.js` - Login (0x01)
- `heartbeat.js` - Heartbeat (0x13)
- `gps.js` - GPS Location (0x22)
- `alarm.js` - Alarm (0x26)
- `lbs-alarm.js` - LBS Alarm (0x19)
- `lbs-extension.js` - LBS Extension (0x28)
- `wifi.js` - WiFi (0x2C)
- `command-response.js` - Command Response (0x21)
- `command-response-jm01.js` - JM01 Response (0x15)
- `alarm-hvt001.js` - HVT001 Alarm (0x27)
- `external-device.js` - External Device (0x9B)
- `external-module.js` - External Module (0x9C)
- `file-transfer.js` - File Transfer (0x8D)
- `time-calibration.js` - Time Calibration (0x8A)
- `information-transmission.js` - Info Transmission (0x94)

### @concox/server

**Class: ConcoxV5Server**

**Methods:**
- `start()` - Start TCP server and HTTP API
- `stop()` - Stop server
- `sendCommand(imei, command)` - Send custom command
- `immobilizeVehicle(imei)` - Immobilize vehicle
- `mobilizeVehicle(imei)` - Mobilize vehicle
- `requestDeviceStatus(imei)` - Request device status

**Properties:**
- `clients` - Map of connected devices (IMEI → client info)

## 🏗️ Directory Structure

```
my-project/
├── package.json          ← Add dependencies here
└── src/
    └── index.js          ← Use packages here

concox-logger/            ← This repo (sibling directory)
└── packages/
    ├── server/
    ├── protocols/
    └── shared/
```

## 🔧 Setup for Package Usage

The packages are already configured for use. No additional setup needed.

### Package Exports

All packages have proper `exports` in their `package.json`:

- `@concox/shared` - Exports all utilities
- `@concox/protocols` - Exports all protocol handlers
- `@concox/server` - Exports server class

## 💡 Tips

1. **Use local path for development** - Faster iteration
2. **Publish to npm for production** - Better versioning
3. **Use Git for private repos** - Keep code private
4. **Extend the server class** - Add your custom logic
5. **Use individual protocol handlers** - If you don't need full server
6. **HTTP API is built-in** - No need to create your own API

## 📝 Complete Example Project

```javascript
// package.json
{
  "name": "my-iot-app",
  "type": "module",
  "dependencies": {
    "@concox/server": "file:../concox-logger/packages/server",
    "express": "^4.18.0"
  }
}

// index.js
import express from "express";
import ConcoxV5Server from "@concox/server";

const app = express();
const concoxServer = new ConcoxV5Server();

// Start Concox server (includes HTTP API)
await concoxServer.start();

// Your Express API (or use built-in API at port 3000)
app.get("/my-devices", (req, res) => {
  res.json(Array.from(concoxServer.clients.keys()));
});

app.listen(4000);
```

---

For more usage examples, see [USAGE_GUIDE.md](./USAGE_GUIDE.md).
For publishing to npm, see [PUBLISH_TO_NPM.md](./PUBLISH_TO_NPM.md).

# Concox V5 GPS Tracker Server

Complete implementation of Concox V5 GPS tracking protocol with all 16 protocols supported. Includes TCP server for device connections and HTTP REST API for device control.

## ✨ Features

- 📡 **Complete Protocol Support** - All 16 Concox V5 protocols implemented (100%)
- 🏗️ **Monorepo Architecture** - Modular, maintainable code structure
- 🌐 **HTTP REST API** - Control devices via HTTP endpoints
- 📝 **Comprehensive Logging** - Logs all events to console and files
- 🔍 **Packet Analysis** - Shows raw packet data and parsed information
- 🎮 **Device Control** - Immobilize, mobilize, send commands via API or code
- 📦 **Reusable Packages** - Use protocol handlers independently
- 📅 **Daily Log Files** - Creates separate log files per day

## 🚀 Quick Start

### Installation

```bash
git clone <repository-url>
cd concox-logger
npm install
```

### Configuration

Create a `.env` file:

```env
CONCOX_PORT=5027      # TCP port for GPS devices
API_PORT=3000         # HTTP API port
LOG_DIR=./logs        # Log files directory
```

### Start Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

The server will start:

- **TCP Server** on port 5027 (for GPS devices)
- **HTTP API** on port 3000 (for REST API)

## 📡 What Happens After Starting

Once the server starts:

1. **TCP Server** listens for GPS device connections
2. **HTTP API** provides REST endpoints for device control
3. **Automatic Protocol Handling** - All 16 protocols are handled automatically
4. **Real-time Logging** - All events logged to console and files

### Example Log Output

```
[2024-12-15T10:30:45.123Z] 📡 Concox V5 Server started on port 5027
[2024-12-15T10:30:45.124Z] 🌐 HTTP API server started on port 3000
[2024-12-15T10:31:20.456Z] 🔌 New connection from 192.168.1.100:54321
[2024-12-15T10:31:20.500Z] 🔐 Login packet
{
  "imei": "123456789012345",
  "client": "192.168.1.100:54321"
}
[2024-12-15T10:31:20.501Z] ✅ Login acknowledged
[2024-12-15T10:31:25.789Z] 📍 GPS Location
{
  "imei": "123456789012345",
  "timestamp": "2024-12-15 10:31:25",
  "latitude": "37.774900",
  "longitude": "-122.419400",
  "speed": 45,
  "course": 332
}
```

## 🌐 HTTP REST API

The server includes a REST API for device control. All endpoints return JSON.

### Base URL

```
http://localhost:3000/api
```

### API Endpoints

#### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2024-12-15T10:30:45.123Z",
  "tcpPort": 5027,
  "connectedDevices": 2
}
```

#### Get All Connected Devices

```http
GET /api/devices
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "devices": [
    {
      "imei": "123456789012345",
      "connectedAt": "2024-12-15T10:31:20.500Z",
      "address": "192.168.1.100",
      "port": 54321,
      "connectionId": "192.168.1.100:54321"
    }
  ]
}
```

#### Get Specific Device

```http
GET /api/devices/:imei
```

**Example:**

```bash
curl http://localhost:3000/api/devices/123456789012345
```

#### Immobilize Vehicle (Cut Fuel/Electricity)

```http
POST /api/devices/:imei/immobilize
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/immobilize
```

**Response:**

```json
{
  "success": true,
  "message": "Vehicle immobilized (fuel/electricity cut)",
  "imei": "123456789012345"
}
```

#### Mobilize Vehicle (Restore Fuel/Electricity)

```http
POST /api/devices/:imei/mobilize
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/mobilize
```

**Response:**

```json
{
  "success": true,
  "message": "Vehicle mobilized (fuel/electricity restored)",
  "imei": "123456789012345"
}
```

#### Request Device Status

```http
POST /api/devices/:imei/status
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/status
```

**Response:**

```json
{
  "success": true,
  "message": "Status request sent to device",
  "imei": "123456789012345",
  "note": "Check logs for device response"
}
```

#### Request Location

```http
POST /api/devices/:imei/location
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/location
```

#### Send Custom Command

```http
POST /api/devices/:imei/command
Content-Type: application/json

{
  "command": "STATUS#"
}
```

**Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/command \
  -H "Content-Type: application/json" \
  -d '{"command": "APN,internet.example.com#"}'
```

#### Get Server Statistics

```http
GET /api/stats
```

**Response:**

```json
{
  "success": true,
  "stats": {
    "connectedDevices": 2,
    "tcpPort": 5027,
    "apiPort": 3000,
    "uptime": 3600.5,
    "timestamp": "2024-12-15T11:30:45.123Z"
  }
}
```

### API Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Device not connected",
  "imei": "123456789012345"
}
```

## 💻 Using in Code

### Import and Use Server

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();
await server.start();

// Send commands
server.immobilizeVehicle("123456789012345");
server.mobilizeVehicle("123456789012345");
server.requestDeviceStatus("123456789012345");
server.sendCommand("123456789012345", "CUSTOM_COMMAND#");
```

### Use Protocol Handlers

```javascript
import { parseLogin } from "@concox/protocols/login.js";
import { parseGPSLocation } from "@concox/protocols/gps.js";
import { parseAlarm } from "@concox/protocols/alarm.js";

// Parse packets
const loginData = parseLogin(packetBuffer);
const location = parseGPSLocation(packetBuffer);
const alarm = parseAlarm(packetBuffer);
```

### Use Shared Utilities

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
```

## 📋 Implemented Protocols

All 16 Concox V5 protocols are fully implemented:

| Protocol | Name                               | Status      |
| -------- | ---------------------------------- | ----------- |
| 0x01     | Login Information                  | ✅ Complete |
| 0x13     | Heartbeat Packet                   | ✅ Complete |
| 0x22     | Positioning Data (UTC)             | ✅ Complete |
| 0x26     | Alarm Data (UTC)                   | ✅ Complete |
| 0x19     | LBS Alarm                          | ✅ Complete |
| 0x27     | Alarm Data HVT001 (UTC)            | ✅ Complete |
| 0x28     | LBS Multiple Bases Extension       | ✅ Complete |
| 0x2C     | WIFI Communication Protocol        | ✅ Complete |
| 0x80     | Online Command                     | ✅ Complete |
| 0x21     | Online Command Response            | ✅ Complete |
| 0x15     | Online Command Response JM01       | ✅ Complete |
| 0x8A     | Time Check Packet                  | ✅ Complete |
| 0x94     | Information Transmission Packet    | ✅ Complete |
| 0x9B     | External Device Transfer (X3)      | ✅ Complete |
| 0x9C     | External Module Transmission (U20) | ✅ Complete |
| 0x8D     | Large File Transfer (HVT001)       | ✅ Complete |

## 🏗️ Monorepo Structure

```
concox-logger/
├── packages/
│   ├── shared/          # Shared utilities (CRC, parser, IMEI, protocols)
│   ├── protocols/       # Protocol handlers (all 16 protocols)
│   └── server/           # Main TCP server + HTTP API
├── package.json         # Root workspace configuration
└── README.md            # This file
```

### Packages

- **`@concox/shared`** - Utilities: CRC calculation, packet parsing, IMEI extraction
- **`@concox/protocols`** - 16 protocol handlers with parse/create functions
- **`@concox/server`** - TCP server + HTTP API for device management

## 🔧 Configuration

### Environment Variables

| Variable      | Default  | Description                         |
| ------------- | -------- | ----------------------------------- |
| `CONCOX_PORT` | `5027`   | TCP port for GPS device connections |
| `API_PORT`    | `3000`   | HTTP API server port                |
| `LOG_DIR`     | `./logs` | Directory for log files             |

### Device Configuration

Configure your Concox V5 device to connect to your server:

**Via SMS:**

```
SERVER,YOUR_PUBLIC_IP,5027#
```

**Common SMS Commands:**

```
STATUS#              # Get device status
WHERE#               # Request location
APN,internet#        # Set APN
RELAY,0#             # Mobilize (restore fuel/electricity)
RELAY,1#             # Immobilize (cut fuel/electricity)
```

For complete SMS command reference:
https://tegnotech.com/gps-settings-commands/gps-tracker-commands/

## 📊 Monitoring

### View Logs

```bash
# Watch logs in real-time
tail -f logs/concox-$(date +%Y-%m-%d).log

# Search for specific IMEI
grep "123456789012345" logs/*.log

# Search for GPS locations
grep "📍 GPS Location" logs/*.log
```

### Check Connected Devices

```bash
# Via API
curl http://localhost:3000/api/devices

# Or check logs for login events
grep "🔐 Login packet" logs/*.log
```

## 🔌 Using as Package in Another App

### Install from Local Path

In your app's `package.json`:

```json
{
  "dependencies": {
    "@concox/server": "file:../concox-logger/packages/server",
    "@concox/protocols": "file:../concox-logger/packages/protocols",
    "@concox/shared": "file:../concox-logger/packages/shared"
  }
}
```

Then:

```bash
npm install
```

### Use in Your App

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();
await server.start();

// Your custom logic here
```

## 📝 Example: Express App with Concox Server

```javascript
import express from "express";
import ConcoxV5Server from "@concox/server";

const app = express();
app.use(express.json());

const concoxServer = new ConcoxV5Server();
await concoxServer.start();

// Your Express routes
app.get("/my-devices", (req, res) => {
  const devices = Array.from(concoxServer.clients.keys());
  res.json(devices);
});

app.listen(4000);
```

## 🛠️ Development

### Adding New Protocol

1. Create handler in `packages/protocols/`
2. Export from `packages/protocols/index.js`
3. Add handler in `packages/server/index.js`
4. Update `packages/shared/protocols.js`

### Testing

```bash
# Development mode with auto-reload
npm run dev
```

## 📚 Common Commands Reference

### Vehicle Control

- `RELAY,0#` - Mobilize (restore fuel/electricity)
- `RELAY,1#` - Immobilize (cut fuel/electricity)

### Status & Information

- `STATUS#` - Get device status
- `WHERE#` - Request current location
- `PARAM#` - Get all parameters

### Configuration

- `APN,internet.example.com#` - Set APN
- `SERVER,ip,port#` - Set server IP and port
- `TIMEZONE,+05:30#` - Set timezone

### Device Control

- `RESET#` - Reset device
- `FACTORY#` - Factory reset

## 📊 Understanding Packet Data

### Heartbeat Packet (0x13)

- **Battery**: GPS tracker's internal battery (0-6, 0=No Power, 6=Full)
  - ⚠️ This is the **IoT device battery**, NOT the vehicle/bike battery
  - When `charging: true`, device is powered by external source (vehicle battery)
- **Signal**: 0-4 (0=No Signal, 4=Strong)
- **Status Flags**:
  - `oilElectricityDisconnected`: `false` = MOBILIZED, `true` = IMMOBILIZED
  - `gpsTracking`: GPS tracking active
  - `charging`: External power charging
  - `accHigh`: Ignition status
  - `defenseActivated`: Alarm system armed

### GPS Location Packet (0x22)

- **Location**: Latitude/Longitude in decimal degrees
- **Movement**: Speed (km/h), Course (degrees), Satellites (count)
- **LBS**: Cellular tower info (MCC, MNC, LAC, Cell ID)
- **Status**: ACC (ignition), Upload mode, Mileage

**See [USAGE_GUIDE.md](./USAGE_GUIDE.md) for detailed parameter explanations.**

## 🔍 Troubleshooting

### Server Won't Start

```bash
# Check if port is in use
lsof -i :5027
lsof -i :3000

# Kill process if needed
kill -9 <PID>
```

### Device Not Connecting

1. ✅ Check device is configured with correct server IP and port
2. ✅ Verify firewall allows connections: `sudo ufw allow 5027/tcp`
3. ✅ Check server logs for connection attempts
4. ✅ Ensure device has cellular signal
5. ✅ Verify port forwarding (if behind router)

### API Not Responding

1. ✅ Check API server started: Look for "HTTP API server started" in logs
2. ✅ Verify API port: Default is 3000, check `.env` file
3. ✅ Test health endpoint: `curl http://localhost:3000/health`

## 📄 License

MIT

## 📖 API Quick Reference

### Most Used Endpoints

```bash
# Get all devices
GET /api/devices

# Immobilize vehicle
POST /api/devices/:imei/immobilize

# Mobilize vehicle
POST /api/devices/:imei/mobilize

# Request location
POST /api/devices/:imei/location

# Send custom command
POST /api/devices/:imei/command
Body: {"command": "STATUS#"}
```

**Full API Documentation:** See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md)

## 📚 Documentation

- **[USAGE_GUIDE.md](./USAGE_GUIDE.md)** - Complete usage guide (how to use server, API, code examples)
- **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** - Complete HTTP REST API reference
- **[USING_AS_PACKAGE.md](./USING_AS_PACKAGE.md)** - How to use packages in other applications
- **[PUBLISH_TO_NPM.md](./PUBLISH_TO_NPM.md)** - Guide for publishing to npm
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Device configuration guide
- **[QUICK_SETUP.md](./QUICK_SETUP.md)** - Quick setup instructions
- **[Concox V5 Protocol Manual](./v5%20Protocol.pdf)** - Protocol specification

---

**Need help?** Check the logs in `logs/` directory or review the documentation files above.

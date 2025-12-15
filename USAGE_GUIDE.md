# Complete Usage Guide

Complete guide on how to use the Concox V5 Logger server and packages.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd concox-logger
npm install
```

### 2. Configure Environment

Create a `.env` file:

```env
CONCOX_PORT=5027      # TCP port for GPS devices
API_PORT=3000         # HTTP API port
LOG_DIR=./logs        # Log files directory
```

### 3. Start the Server

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

### Automatic Operations

Once started, the server automatically:

- ✅ Listens for device connections on TCP port 5027
- ✅ Provides HTTP API on port 3000
- ✅ Handles all 16 Concox V5 protocols automatically
- ✅ Logs all events to console and log files
- ✅ Tracks connected devices by IMEI

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

## 🌐 Using HTTP REST API

The server includes a REST API for device control. See [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) for complete API reference.

### Quick API Examples

```bash
# Get all connected devices
curl http://localhost:3000/api/devices

# Immobilize vehicle
curl -X POST http://localhost:3000/api/devices/123456789012345/immobilize

# Mobilize vehicle
curl -X POST http://localhost:3000/api/devices/123456789012345/mobilize

# Request location
curl -X POST http://localhost:3000/api/devices/123456789012345/location

# Send custom command
curl -X POST http://localhost:3000/api/devices/123456789012345/command \
  -H "Content-Type: application/json" \
  -d '{"command": "STATUS#"}'
```

## 💻 Using in Code

### Method 1: Use the Full Server

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();

// Start server
await server.start();

// Send commands
server.immobilizeVehicle("123456789012345");
server.mobilizeVehicle("123456789012345");
server.requestDeviceStatus("123456789012345");
server.sendCommand("123456789012345", "CUSTOM_COMMAND#");
```

### Method 2: Use Individual Protocol Handlers

```javascript
import { parseLogin, createLoginAck } from "@concox/protocols/login.js";
import { parseGPSLocation } from "@concox/protocols/gps.js";
import { parseAlarm } from "@concox/protocols/alarm.js";

// Parse packets
const loginData = parseLogin(packetBuffer);
const location = parseGPSLocation(packetBuffer);
const alarm = parseAlarm(packetBuffer);

// Create acknowledgments
const ack = createLoginAck(loginData.serialNumber);
```

### Method 3: Use Shared Utilities

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

// Extract IMEI
const imei = extractIMEI(imeiBytes);

// Calculate CRC
const crc = calculateCRCITU(data, startIndex, endIndex);
```

### Method 4: Create Custom Script

Create `send-command.js`:

```javascript
import ConcoxV5Server from "@concox/server";

const server = new ConcoxV5Server();

server.start().then(() => {
  console.log("Server started, waiting for device...");

  setTimeout(() => {
    const imei = "123456789012345"; // Replace with your device IMEI

    console.log(`\n=== Sending Commands to ${imei} ===\n`);

    // Immobilize vehicle
    console.log("1. Immobilizing vehicle...");
    server.immobilizeVehicle(imei);

    setTimeout(() => {
      // Mobilize vehicle
      console.log("2. Mobilizing vehicle...");
      server.mobilizeVehicle(imei);
    }, 2000);

    setTimeout(() => {
      // Request status
      console.log("3. Requesting device status...");
      server.requestDeviceStatus(imei);
    }, 4000);
  }, 5000); // Wait 5 seconds for device to connect
});
```

Run it:

```bash
node send-command.js
```

## 📊 Monitoring and Logs

### View Logs in Real-Time

```bash
# Watch today's log file
tail -f logs/concox-$(date +%Y-%m-%d).log

# Or watch all logs
tail -f logs/*.log
```

### Search Logs

```bash
# Search for specific IMEI
grep "123456789012345" logs/*.log

# Search for GPS locations
grep "📍 GPS Location" logs/*.log

# Search for alarms
grep "🚨 Alarm" logs/*.log
```

### Check Connected Devices

```bash
# Via API
curl http://localhost:3000/api/devices

# Or check logs
grep "🔐 Login packet" logs/*.log
```

## 🔧 Common Commands

### Vehicle Control

```javascript
// Immobilize (cut fuel/electricity)
server.sendCommand(imei, "RELAY,1#");
// Or use helper:
server.immobilizeVehicle(imei);

// Mobilize (restore fuel/electricity)
server.sendCommand(imei, "RELAY,0#");
// Or use helper:
server.mobilizeVehicle(imei);
```

### Status & Information

```javascript
// Get device status
server.sendCommand(imei, "STATUS#");
// Or use helper:
server.requestDeviceStatus(imei);

// Request current location
server.sendCommand(imei, "WHERE#");

// Get all parameters
server.sendCommand(imei, "PARAM#");
```

### Configuration

```javascript
// Set APN
server.sendCommand(imei, "APN,internet.example.com#");

// Set server IP and port
server.sendCommand(imei, "SERVER,192.168.1.100,5027#");

// Set timezone
server.sendCommand(imei, "TIMEZONE,+05:30#");
```

### Device Control

```javascript
// Reset device
server.sendCommand(imei, "RESET#");

// Factory reset
server.sendCommand(imei, "FACTORY#");
```

## 📦 Using as Package in Another App

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

// Your custom logic
```

### Publish to npm

See [PUBLISH_TO_NPM.md](./PUBLISH_TO_NPM.md) for publishing instructions.

## 🎯 Example: Express App Integration

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

app.post("/my-devices/:imei/immobilize", (req, res) => {
  const { imei } = req.params;
  const success = concoxServer.immobilizeVehicle(imei);
  res.json({ success });
});

app.listen(4000);
```

## 🎯 Example: Custom Server with Extended Logic

```javascript
import ConcoxV5Server from "@concox/server";
import { parseGPSLocation } from "@concox/protocols/gps.js";

class MyCustomServer extends ConcoxV5Server {
  handleGPSLocation(socket, packet, clientInfo) {
    // Call parent handler for standard logging
    super.handleGPSLocation(socket, packet, clientInfo);

    // Add your custom logic
    const location = parseGPSLocation(packet);

    // Save to database
    this.saveToDatabase({
      imei: socket.deviceImei,
      latitude: location.latitude,
      longitude: location.longitude,
      timestamp: new Date(),
    });

    // Send to MQTT
    this.publishToMQTT("gps/location", location);
  }

  async saveToDatabase(data) {
    // Your database logic
  }

  async publishToMQTT(topic, data) {
    // Your MQTT logic
  }
}

const server = new MyCustomServer();
await server.start();
```

## 📋 Package Reference

### @concox/shared

- `parsePacket(buffer)` - Parse Concox packets
- `extractIMEI(bytes)` - Extract IMEI from bytes
- `calculateCRCITU(data)` - Calculate CRC
- `getProtocolName(number)` - Get protocol name
- `PROTOCOL_NUMBERS` - Protocol constants

### @concox/protocols

Each protocol has:

- `parse[Protocol](packet)` - Parse packet
- `create[Protocol]Ack(...)` - Create acknowledgment

Available: `login.js`, `heartbeat.js`, `gps.js`, `alarm.js`, `lbs-alarm.js`, `wifi.js`, `command-response.js`, and more...

### @concox/server

- `ConcoxV5Server` - Main server class
- `start()` - Start server
- `stop()` - Stop server
- `sendCommand(imei, command)` - Send command
- `immobilizeVehicle(imei)` - Immobilize
- `mobilizeVehicle(imei)` - Mobilize
- `requestDeviceStatus(imei)` - Get status

## 🔍 Troubleshooting

### Server Won't Start

```bash
# Check if ports are in use
lsof -i :5027
lsof -i :3000

# Check permissions
sudo ufw allow 5027/tcp
sudo ufw allow 3000/tcp
```

### Device Not Connecting

1. Check device is configured with correct server IP and port
2. Verify firewall allows connections
3. Check server logs for connection attempts
4. Ensure device has cellular signal
5. Verify port forwarding (if behind router)

### API Not Responding

1. Check API server started: Look for "HTTP API server started" in logs
2. Verify API port: Default is 3000, check `.env` file
3. Test health endpoint: `curl http://localhost:3000/health`

### Packages Not Found

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## ⚠️ Important Notes

1. **Device must be connected first** - Commands only work if device is currently connected
2. **IMEI is required** - You need device IMEI to send commands
3. **Commands are sent via TCP** - Not SMS (device must be online)
4. **Check logs for responses** - Device responses appear in logs as protocol 0x21 or 0x15
5. **HTTP API is available** - Use REST API for easier integration

## 💡 Tips

1. **Keep server running** - Don't stop it if you want continuous monitoring
2. **Use HTTP API** - Easier than writing custom scripts
3. **Check logs regularly** - Important events are logged
4. **Use helper methods** - `immobilizeVehicle()`, `mobilizeVehicle()` are easier
5. **Monitor connections** - Watch for disconnections in logs
6. **Save IMEIs** - Keep a list of your device IMEIs for easy reference

## 📊 Understanding Packet Parameters

### Heartbeat Packet Parameters (Protocol 0x13)

#### Basic Information

- **`imei`**: Device identifier (15-digit unique ID)
- **`battery`**: GPS tracker's internal battery level (0-6)
  - ⚠️ **Important**: This is the **IoT device's (GPS tracker) battery**, NOT the vehicle/bike battery
  - `0` = No Power
  - `1` = Extremely Low
  - `2` = Very Low
  - `3` = Low
  - `4` = Medium
  - `5` = High
  - `6` = Full
  - **Note**: When `charging: true`, the device is powered by external source (vehicle battery). The internal battery level shows the backup battery status.
- **`signal`**: GSM signal strength (0-4)
  - `0` = No Signal
  - `1` = Extremely Weak
  - `2` = Weak
  - `3` = Good
  - `4` = Strong

#### Status Flags

- **`oilElectricityDisconnected`**: Fuel/electricity relay status
  - `false` = Connected (MOBILIZED - vehicle can run)
  - `true` = Cut (IMMOBILIZED - vehicle cannot run)
- **`gpsTracking`**: GPS tracking active (`true`/`false`)
- **`charging`**: External power charging (`true`/`false`)
  - `true` = Device is connected to external power source (vehicle/bike battery)
  - `false` = Device is running on its internal battery
- **`accHigh`**: Ignition status
  - `false` = Ignition OFF
  - `true` = Ignition ON
- **`defenseActivated`**: Anti-theft alarm armed (`true`/`false`)
- **`oilElectricityStatus`**: Human-readable status
  - `"MOBILIZED (Connected)"` = Vehicle can run
  - `"IMMOBILIZED (Cut Off)"` = Vehicle cannot run

### GPS Location Packet Parameters (Protocol 0x22)

#### Location Data

- **`timestamp`**: Date and time in UTC format (`YYYY-MM-DD HH:MM:SS`)
- **`latitude`**: GPS latitude in decimal degrees
  - Negative = South of equator
  - Positive = North of equator
- **`longitude`**: GPS longitude in decimal degrees
  - Negative = West of Prime Meridian
  - Positive = East of Prime Meridian

#### Movement Data

- **`speed`**: Vehicle speed in km/h
- **`course`**: Direction of travel in degrees (0-359°)
  - 0° = North, 90° = East, 180° = South, 270° = West
- **`satellites`**: Number of GPS satellites in view (0-15)
  - 4+ satellites needed for accurate positioning
- **`positioned`**: GPS fix status
  - `true` = Valid GPS fix (accurate position)
  - `false` = No GPS fix (may use LBS location)

#### Cellular Tower Information (LBS)

- **`lbs.mcc`**: Mobile Country Code (identifies country)
  - Example: 404 = India
- **`lbs.mnc`**: Mobile Network Code (identifies carrier)
- **`lbs.lac`**: Location Area Code (tower area identifier)
- **`lbs.cellId`**: Cell tower identifier (specific tower)

#### Additional Information

- **`mileage_meters`**: Total distance traveled in meters
- **`mileage_km`**: Total distance in kilometers
- **`acc`**: Ignition status
  - `"High (On)"` = Ignition ON (vehicle running)
  - `"Low (Off)"` = Ignition OFF (vehicle not running)
- **`uploadMode`**: Reason for GPS data upload
  - `"Time Interval"` - Scheduled upload
  - `"Distance Interval"` - Moved certain distance
  - `"Inflection Point"` - Changed direction
  - `"ACC Status"` - Ignition status changed
  - `"Re-upload Last GPS"` - Retransmitting data
  - `"Network Recovery"` - Network reconnected
  - `"GPS Dup Upload"` - Duplicate GPS data
  - And more...

#### Vehicle Battery Monitoring

To monitor vehicle/bike battery status, check alarm packets (Protocol 0x26 or 0x27):

- **`0x0E`** = "External Low Battery" - Vehicle battery is low
- **`0x0F`** = "External Low Battery Protection" - Vehicle battery protection activated
- **`0x19`** = "Internal Low Battery Alarm" - GPS tracker's internal battery is low

The heartbeat packet's `battery` field only shows the GPS tracker's internal battery, not the vehicle battery.

### Example: Understanding Your Data

**Heartbeat Example:**

```json
{
  "battery": "Full", // GPS tracker's internal battery (level 6)
  "signal": "Strong", // Excellent cellular signal (level 4)
  "oilElectricityStatus": "MOBILIZED (Connected)", // Vehicle can run
  "gpsTracking": true, // GPS tracking is active
  "charging": true, // Device is powered by external source (vehicle battery)
  "accHigh": false, // Ignition is OFF
  "defenseActivated": true // Alarm system is ARMED
}
```

**Battery Clarification:**

- **`battery`**: GPS tracker's internal battery (backup power)
- **`charging: true`**: Device is powered by vehicle/bike battery
- **Vehicle battery status**: Check alarm codes `0x0E` (External Low Battery) or `0x19` (Internal Low Battery Alarm) for vehicle battery warnings

**GPS Location Example:**

```json
{
  "timestamp": "2025-12-15 09:38:12", // UTC time
  "latitude": "-17.450585", // 17.45° South
  "longitude": "78.382619", // 78.38° East
  "speed": 0, // Stationary (0 km/h)
  "course": 41, // Facing Northeast (41°)
  "satellites": 8, // Good GPS signal (8 satellites)
  "positioned": true, // Valid GPS fix
  "lbs": {
    "mcc": 404, // India
    "mnc": 234, // Specific carrier
    "lac": 20270, // Tower area
    "cellId": 23962 // Specific tower
  },
  "mileage_km": "0.33", // 330 meters traveled
  "acc": "Low (Off)", // Ignition OFF
  "uploadMode": "GPS Dup Upload" // Duplicate data upload
}
```

---

For complete API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).
For device configuration, see [CONFIGURATION.md](./CONFIGURATION.md).

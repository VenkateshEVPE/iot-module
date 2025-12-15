# HTTP REST API Documentation

Complete API reference for Concox V5 Server HTTP endpoints.

## Base URL

```
http://localhost:3000/api
```

Default port: `3000` (configurable via `API_PORT` environment variable)

## Authentication

Currently, the API has no authentication. For production use, add authentication middleware.

## Endpoints

### Health Check

Check if the server is running.

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

---

### Get All Connected Devices

Get a list of all currently connected GPS devices.

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
    },
    {
      "imei": "987654321098765",
      "connectedAt": "2024-12-15T10:32:10.200Z",
      "address": "192.168.1.101",
      "port": 54322,
      "connectionId": "192.168.1.101:54322"
    }
  ]
}
```

**cURL Example:**

```bash
curl http://localhost:3000/api/devices
```

---

### Get Specific Device

Get information about a specific device by IMEI.

```http
GET /api/devices/:imei
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)

**Response (Success):**

```json
{
  "success": true,
  "device": {
    "imei": "123456789012345",
    "connectedAt": "2024-12-15T10:31:20.500Z",
    "address": "192.168.1.100",
    "port": 54321,
    "connectionId": "192.168.1.100:54321"
  }
}
```

**Response (Not Found):**

```json
{
  "success": false,
  "error": "Device not connected",
  "imei": "123456789012345"
}
```

**cURL Example:**

```bash
curl http://localhost:3000/api/devices/123456789012345
```

---

### Immobilize Vehicle

Cut fuel/electricity to immobilize the vehicle.

```http
POST /api/devices/:imei/immobilize
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)

**Response (Success):**

```json
{
  "success": true,
  "message": "Vehicle immobilized (fuel/electricity cut)",
  "imei": "123456789012345"
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Device not connected",
  "imei": "123456789012345"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/immobilize
```

**JavaScript Example:**

```javascript
fetch("http://localhost:3000/api/devices/123456789012345/immobilize", {
  method: "POST",
})
  .then((res) => res.json())
  .then((data) => console.log(data));
```

---

### Mobilize Vehicle

Restore fuel/electricity to mobilize the vehicle.

```http
POST /api/devices/:imei/mobilize
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)

**Response (Success):**

```json
{
  "success": true,
  "message": "Vehicle mobilized (fuel/electricity restored)",
  "imei": "123456789012345"
}
```

**Response (Error):**

```json
{
  "success": false,
  "error": "Device not connected",
  "imei": "123456789012345"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/mobilize
```

---

### Request Device Status

Request status information from the device.

```http
POST /api/devices/:imei/status
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)

**Response (Success):**

```json
{
  "success": true,
  "message": "Status request sent to device",
  "imei": "123456789012345",
  "note": "Check logs for device response"
}
```

**Note:** Device response will appear in server logs as protocol 0x21 or 0x15.

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/status
```

---

### Request Location

Request current GPS location from the device.

```http
POST /api/devices/:imei/location
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)

**Response (Success):**

```json
{
  "success": true,
  "message": "Location request sent to device",
  "imei": "123456789012345",
  "note": "Check logs for GPS location response"
}
```

**Note:** GPS location will appear in server logs as protocol 0x22.

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/location
```

---

### Send Custom Command

Send a custom command to the device.

```http
POST /api/devices/:imei/command
Content-Type: application/json

{
  "command": "STATUS#"
}
```

**Parameters:**

- `imei` (path) - Device IMEI (15 digits)
- `command` (body) - Command string (must end with `#`)

**Request Body:**

```json
{
  "command": "STATUS#"
}
```

**Response (Success):**

```json
{
  "success": true,
  "message": "Command sent to device",
  "imei": "123456789012345",
  "command": "STATUS#",
  "note": "Check logs for device response"
}
```

**Response (Error - Missing Command):**

```json
{
  "success": false,
  "error": "Command is required"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:3000/api/devices/123456789012345/command \
  -H "Content-Type: application/json" \
  -d '{"command": "STATUS#"}'
```

**Common Commands:**

- `STATUS#` - Get device status
- `WHERE#` - Request location
- `APN,internet.example.com#` - Set APN
- `RELAY,0#` - Mobilize (restore fuel/electricity)
- `RELAY,1#` - Immobilize (cut fuel/electricity)
- `RESET#` - Reset device
- `PARAM#` - Get all parameters

---

### Get Server Statistics

Get server statistics and status.

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

**cURL Example:**

```bash
curl http://localhost:3000/api/stats
```

---

## Error Responses

All endpoints return errors in a consistent format:

```json
{
  "success": false,
  "error": "Error message here",
  "imei": "123456789012345" // If applicable
}
```

**HTTP Status Codes:**

- `200` - Success
- `400` - Bad Request (missing parameters)
- `404` - Not Found (device not connected)
- `500` - Internal Server Error

## CORS

The API has CORS enabled for all origins. For production, restrict this to specific domains.

## Rate Limiting

Currently, there is no rate limiting. For production use, add rate limiting middleware.

## Example: Complete Workflow

```bash
# 1. Check server health
curl http://localhost:3000/health

# 2. Get all connected devices
curl http://localhost:3000/api/devices

# 3. Immobilize a vehicle
curl -X POST http://localhost:3000/api/devices/123456789012345/immobilize

# 4. Wait a few seconds, then mobilize
curl -X POST http://localhost:3000/api/devices/123456789012345/mobilize

# 5. Request location
curl -X POST http://localhost:3000/api/devices/123456789012345/location

# 6. Send custom command
curl -X POST http://localhost:3000/api/devices/123456789012345/command \
  -H "Content-Type: application/json" \
  -d '{"command": "STATUS#"}'

# 7. Check server stats
curl http://localhost:3000/api/stats
```

## JavaScript/TypeScript Examples

### Using Fetch API

```javascript
// Immobilize vehicle
async function immobilizeVehicle(imei) {
  const response = await fetch(
    `http://localhost:3000/api/devices/${imei}/immobilize`,
    {
      method: "POST",
    }
  );
  const data = await response.json();
  console.log(data);
}

// Get all devices
async function getDevices() {
  const response = await fetch("http://localhost:3000/api/devices");
  const data = await response.json();
  return data.devices;
}

// Send custom command
async function sendCommand(imei, command) {
  const response = await fetch(
    `http://localhost:3000/api/devices/${imei}/command`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command }),
    }
  );
  const data = await response.json();
  return data;
}
```

### Using Axios

```javascript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:3000/api",
});

// Immobilize
await api.post("/devices/123456789012345/immobilize");

// Mobilize
await api.post("/devices/123456789012345/mobilize");

// Get devices
const { data } = await api.get("/devices");
console.log(data.devices);

// Send command
await api.post("/devices/123456789012345/command", {
  command: "STATUS#",
});
```

---

For more information, see the main [README.md](./README.md).

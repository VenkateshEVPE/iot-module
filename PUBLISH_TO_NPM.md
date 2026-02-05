# Publishing to npm

This guide shows how to publish the Concox V5 Logger packages to npm.

## 📋 Prerequisites

1. **npm account** - Sign up at https://www.npmjs.com/signup
2. **Login to npm**:
   ```bash
   npm login
   ```
3. **Check you're logged in**:
   ```bash
   npm whoami
   ```

## 🔧 Step 1: Prepare Packages for Publishing

### Update Root package.json

The root package should stay `private: true` (it's just a workspace). We'll publish individual packages.

### Update Package Names (Optional)

If you want to use a scoped package name, update each package.json:

**packages/shared/package.json:**

```json
{
  "name": "@yourusername/concox-shared",
  "version": "1.0.0",
  "description": "Shared utilities for Concox V5 protocol",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./crc.js": "./crc.js",
    "./parser.js": "./parser.js",
    "./imei.js": "./imei.js",
    "./protocols.js": "./protocols.js"
  },
  "keywords": ["concox", "gps", "tracker", "protocol"],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/concox-logger.git",
    "directory": "packages/shared"
  }
}
```

**packages/protocols/package.json:**

```json
{
  "name": "@yourusername/concox-protocols",
  "version": "1.0.0",
  "description": "Concox V5 protocol handlers",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./login.js": "./login.js",
    "./heartbeat.js": "./heartbeat.js",
    "./gps.js": "./gps.js",
    "./alarm.js": "./alarm.js",
    "./lbs-alarm.js": "./lbs-alarm.js",
    "./lbs-extension.js": "./lbs-extension.js",
    "./wifi.js": "./wifi.js",
    "./command-response.js": "./command-response.js",
    "./command-response-jm01.js": "./command-response-jm01.js",
    "./alarm-hvt001.js": "./alarm-hvt001.js",
    "./external-device.js": "./external-device.js",
    "./external-module.js": "./external-module.js",
    "./file-transfer.js": "./file-transfer.js",
    "./time-calibration.js": "./time-calibration.js",
    "./information-transmission.js": "./information-transmission.js"
  },
  "keywords": ["concox", "gps", "tracker", "protocol"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@yourusername/concox-shared": "^1.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/concox-logger.git",
    "directory": "packages/protocols"
  }
}
```

**packages/server/package.json:**

```json
{
  "name": "@yourusername/concox-server",
  "version": "1.0.0",
  "description": "Concox V5 TCP Server - Complete implementation with all 16 protocols",
  "type": "module",
  "main": "index.js",
  "exports": {
    ".": "./index.js",
    "./logger": "./logger.js"
  },
  "bin": {
    "concox-server": "./start.js"
  },
  "keywords": ["concox", "gps", "tracker", "server", "tcp"],
  "author": "Your Name",
  "license": "MIT",
  "dependencies": {
    "@yourusername/concox-shared": "^1.0.0",
    "@yourusername/concox-protocols": "^1.0.0",
    "dotenv": "^16.3.1"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/concox-logger.git",
    "directory": "packages/server"
  }
}
```

## 📦 Step 2: Publish Packages (In Order)

Packages must be published in dependency order:

### 1. Publish Shared Package (No Dependencies)

```bash
cd packages/shared
npm publish --access public
# Or for scoped packages:
npm publish --access public
```

### 2. Publish Protocols Package

```bash
cd ../protocols
npm publish --access public
```

### 3. Publish Server Package

```bash
cd ../server
npm publish --access public
```

## 🔄 Step 3: Update Versions

For future updates, bump version before publishing:

```bash
# In each package directory
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Then publish
npm publish --access public
```

## 📝 Step 4: Create README for Each Package

Create `packages/shared/README.md`:

```markdown
# @yourusername/concox-shared

Shared utilities for Concox V5 protocol.

## Installation

\`\`\`bash
npm install @yourusername/concox-shared
\`\`\`

## Usage

\`\`\`javascript
import { parsePacket, extractIMEI, calculateCRCITU } from '@yourusername/concox-shared';
\`\`\`
```

Do the same for `packages/protocols/README.md` and `packages/server/README.md`.

## ✅ Step 5: Verify Publication

Check your packages on npm:

- https://www.npmjs.com/package/@yourusername/concox-shared
- https://www.npmjs.com/package/@yourusername/concox-protocols
- https://www.npmjs.com/package/@yourusername/concox-server

## 🚀 Step 6: Install in Other Apps

After publishing, others can install:

```bash
npm install @yourusername/concox-server
```

Or install all:

```bash
npm install @yourusername/concox-server @yourusername/concox-protocols @yourusername/concox-shared
```

## 🔐 Publishing Scoped Packages

If using scoped packages (`@yourusername/package-name`):

1. **First time**: Publish with `--access public`

   ```bash
   npm publish --access public
   ```

2. **After that**: Can publish without `--access` flag
   ```bash
   npm publish
   ```

## 📋 Publishing Checklist

- [ ] npm account created and logged in
- [ ] Package names updated (if using scoped names)
- [ ] Version numbers set correctly
- [ ] Dependencies updated to use published package names
- [ ] README files created for each package
- [ ] License specified (MIT recommended)
- [ ] Repository URL added (if public)
- [ ] Tested packages locally
- [ ] Published shared package first
- [ ] Published protocols package second
- [ ] Published server package last
- [ ] Verified packages on npm website

## 🎯 Quick Publish Script

Create `publish.sh`:

```bash
#!/bin/bash

echo "Publishing @concox packages to npm..."

echo "1. Publishing shared..."
cd packages/shared
npm publish --access public
cd ../..

echo "2. Publishing protocols..."
cd packages/protocols
npm publish --access public
cd ../..

echo "3. Publishing server..."
cd packages/server
npm publish --access public
cd ../..

echo "✅ All packages published!"
```

Make it executable:

```bash
chmod +x publish.sh
./publish.sh
```

## ⚠️ Important Notes

1. **Version numbers** - Start with `1.0.0` for first release
2. **Dependencies** - Make sure dependency versions match published versions
3. **Access** - Scoped packages need `--access public` the first time
4. **Order matters** - Publish shared → protocols → server
5. **Test first** - Test packages locally before publishing

## 🔄 Updating Published Packages

1. Make your changes
2. Bump version:
   ```bash
   npm version patch  # or minor, major
   ```
3. Publish:
   ```bash
   npm publish --access public
   ```

## 📚 Example: Complete Publishing Workflow

```bash
# 1. Login to npm
npm login

# 2. Go to shared package
cd packages/shared

# 3. Check package.json is correct
cat package.json

# 4. Publish
npm publish --access public

# 5. Repeat for protocols
cd ../protocols
npm publish --access public

# 6. Repeat for server
cd ../server
npm publish --access public

# 7. Verify on npm
# Visit: https://www.npmjs.com/~yourusername
```

## 🎉 After Publishing

Your packages are now available for anyone to use:

```bash
npm install @yourusername/concox-server
```

```javascript
import ConcoxV5Server from "@yourusername/concox-server";

const server = new ConcoxV5Server();
await server.start();
```

---

**Note**: Replace `@yourusername` with your actual npm username or organization name.

/**
 * Packet parsing utilities for Concox V5 protocol
 */

/**
 * Parse a Concox V5 packet from buffer
 * @param {Buffer} buffer - Input buffer
 * @returns {Object|null} Parsed packet info or null if incomplete
 */
export function parsePacket(buffer) {
  if (buffer.length < 5) return null;

  const startByte1 = buffer[0];
  const startByte2 = buffer[1];

  let lengthBytes, lengthValue, headerSize;

  // Check packet type by start bytes (Manual page 4)
  if (startByte1 === 0x78 && startByte2 === 0x78) {
    // Single byte length
    lengthBytes = 1;
    lengthValue = buffer[2];
    headerSize = 3; // Start(2) + Length(1)
  } else if (startByte1 === 0x79 && startByte2 === 0x79) {
    // Two byte length
    if (buffer.length < 6) return null;
    lengthBytes = 2;
    lengthValue = buffer.readUInt16BE(2);
    headerSize = 4; // Start(2) + Length(2)
  } else {
    // Invalid start bytes, try to find next valid packet
    const next78 = buffer.indexOf(0x78, 1);
    const next79 = buffer.indexOf(0x79, 1);

    let nextStart = -1;
    if (next78 !== -1 && next79 !== -1) {
      nextStart = Math.min(next78, next79);
    } else if (next78 !== -1) {
      nextStart = next78;
    } else if (next79 !== -1) {
      nextStart = next79;
    }

    if (nextStart === -1) {
      return { packet: null, protocolNumber: null, remaining: Buffer.alloc(0) };
    }

    return {
      packet: null,
      protocolNumber: null,
      remaining: buffer.slice(nextStart),
    };
  }

  // Total packet size = Header + Length Value + Stop(2)
  const totalSize = headerSize + lengthValue + 2;

  if (buffer.length < totalSize) {
    return null; // Incomplete packet
  }

  const packet = buffer.slice(0, totalSize);
  const protocolNumber = packet[headerSize];
  const stopByte1 = packet[totalSize - 2];
  const stopByte2 = packet[totalSize - 1];

  // Verify stop bytes
  if (stopByte1 !== 0x0d || stopByte2 !== 0x0a) {
    // Invalid stop bytes, but continue processing
  }

  return {
    packet,
    protocolNumber,
    remaining: buffer.slice(totalSize),
  };
}

/**
 * Check if packet is long format (0x79 0x79)
 * @param {Buffer} packet - Packet buffer
 * @returns {boolean} True if long packet format
 */
export function isLongPacket(packet) {
  return packet[0] === 0x79 && packet[1] === 0x79;
}

/**
 * Get header size based on packet format
 * @param {Buffer} packet - Packet buffer
 * @returns {number} Header size (3 for short, 4 for long)
 */
export function getHeaderSize(packet) {
  return isLongPacket(packet) ? 4 : 3;
}

/**
 * IMEI extraction utilities
 */

/**
 * Extract IMEI from 8-byte BCD format
 * @param {Buffer} imeiBytes - 8 bytes representing IMEI in BCD format
 * @returns {string} IMEI string (15 digits)
 */
export function extractIMEI(imeiBytes) {
  // IMEI is 8 bytes in format: each byte represents 2 digits
  // Example: IMEI 123456789123456 = 0x01 0x23 0x45 0x67 0x89 0x12 0x34 0x56
  let imei = "";
  for (let i = 0; i < 8; i++) {
    imei += imeiBytes[i].toString(16).padStart(2, "0");
  }

  // Remove leading zeros and ensure 15 digits
  imei = imei.replace(/^0+/, "");
  if (imei.length > 15) {
    imei = imei.substring(0, 15);
  }

  return imei;
}

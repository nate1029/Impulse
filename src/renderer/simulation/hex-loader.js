// Intel HEX format parser → Uint8Array program memory (32KB for ATmega328P)

export function parseHex(hexString) {
  const progMem = new Uint8Array(32 * 1024); // 32KB flash
  const lines = hexString.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith(':')) continue;

    const byteCount = parseInt(trimmed.substring(1, 3), 16);
    const address = parseInt(trimmed.substring(3, 7), 16);
    const recordType = parseInt(trimmed.substring(7, 9), 16);

    if (recordType === 0x00) {
      // Data record
      for (let i = 0; i < byteCount; i++) {
        const byte = parseInt(trimmed.substring(9 + i * 2, 11 + i * 2), 16);
        if (address + i < progMem.length) {
          progMem[address + i] = byte;
        }
      }
    } else if (recordType === 0x01) {
      // End of file
      break;
    }
  }

  // Return as Uint16Array (CPU expects 16-bit words)
  return new Uint16Array(progMem.buffer);
}

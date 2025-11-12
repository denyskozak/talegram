const BASE64_CHUNK_SIZE = 0x8000;

export async function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  let binary = '';
  const bytes = new Uint8Array(buffer);

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    const slice = bytes.subarray(offset, offset + BASE64_CHUNK_SIZE);
    binary += String.fromCharCode(...slice);
  }

  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = window.atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}

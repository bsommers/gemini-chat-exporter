/**
 * jsdom's `Blob` implementation (used as the global `Blob` under vitest's
 * jsdom environment) doesn't implement `.arrayBuffer()`/`.text()` - only a
 * real browser or Node's native Blob does. jsdom's `FileReader` is more
 * complete, so we go through it to get real bytes out of a Blob in tests.
 */
export function blobToBuffer(blob: Blob): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

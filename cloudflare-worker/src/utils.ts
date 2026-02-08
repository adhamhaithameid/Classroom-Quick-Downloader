export async function safeCompare(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);

  if (aBuf.byteLength !== bBuf.byteLength) {
    return false;
  }

  const aHash = await crypto.subtle.digest("SHA-256", aBuf);
  const bHash = await crypto.subtle.digest("SHA-256", bBuf);

  const aView = new DataView(aHash);
  const bView = new DataView(bHash);

  let result = 0;
  for (let i = 0; i < aHash.byteLength; i++) {
    result |= aView.getUint8(i) ^ bView.getUint8(i);
  }

  return result === 0;
}

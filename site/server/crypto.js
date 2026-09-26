const enc = new TextEncoder();
function decode(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function encode(a) {
  return btoa(String.fromCharCode(...new Uint8Array(a)));
}
async function key(secret) {
  const bytes = decode(secret || "");
  if (bytes.length !== 32) throw new Error("Invalid encryption configuration");
  return crypto.subtle.importKey("raw", bytes, "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptIntake(data, secret, childId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: enc.encode(childId) },
    await key(secret),
    enc.encode(JSON.stringify(data)),
  );
  return JSON.stringify({ v: 1, iv: encode(iv), data: encode(ciphertext) });
}
export async function decryptIntake(value, secret, childId) {
  const data = JSON.parse(value);
  if (data.v !== 1) throw new Error("Unsupported intake version");
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: decode(data.iv),
          additionalData: enc.encode(childId),
        },
        await key(secret),
        decode(data.data),
      ),
    ),
  );
}
export async function verifySignature(raw, signature, secret) {
  if (!secret || !signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC",
    k,
    Uint8Array.from(signature.match(/../g), (x) => parseInt(x, 16)),
    enc.encode(raw),
  );
}

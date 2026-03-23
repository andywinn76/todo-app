const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function generateSalt() {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function generateIv() {
  return crypto.getRandomValues(new Uint8Array(12));
}

export async function deriveKey(masterPassword, salt) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterPassword),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 250000,
      hash: "SHA-256",
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptText(plaintext, masterPassword) {
  const salt = generateSalt();
  const iv = generateIv();
  const key = await deriveKey(masterPassword, salt);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encoder.encode(plaintext)
  );

  return {
    content_encrypted: bytesToBase64(new Uint8Array(ciphertextBuffer)),
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    crypto_version: 1,
  };
}

export async function decryptText({
  content_encrypted,
  salt,
  iv,
  masterPassword,
}) {
  const saltBytes = base64ToBytes(salt);
  const ivBytes = base64ToBytes(iv);
  const ciphertextBytes = base64ToBytes(content_encrypted);

  const key = await deriveKey(masterPassword, saltBytes);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: ivBytes,
    },
    key,
    ciphertextBytes
  );

  return decoder.decode(plaintextBuffer);
}
/import LZString from 'lz-string';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// --- Pomocné funkcie pre Base64 URL-safe ---
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (base64url: string): Uint8Array => {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// --- Derivácia kľúča z hesla pomocou PBKDF2 ---
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 250000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Zašifruje report objekt do stringu vhodného do URL hash (#report=...)
 */
export async function encryptReportToUrlPayload(report: unknown, password: string): Promise<string> {
  if (!password || password.trim().length < 4) {
    throw new Error('Heslo musí mať aspoň 4 znaky.');
  }

  const json = JSON.stringify(report);
  
  // VYLEPŠENIE: Silná kompresia pred šifrovaním (zmenší odkaz na zlomok veľkosti)
  const compressedBytes = LZString.compressToUint8Array(json);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  // Šifrujeme skomprimované bajty namiesto celého textu
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    compressedBytes
  );

  const cipherBytes = new Uint8Array(encrypted);

  // Formát v2 pre komprimované dáta
  return [
    'v2',
    toBase64Url(salt),
    toBase64Url(iv),
    toBase64Url(cipherBytes),
  ].join('.');
}

/**
 * Dešifruje payload zo URL hash pomocou hesla.
 */
export async function decryptReportFromUrlPayload(payload: string, password: string): Promise<any> {
  if (!payload) throw new Error('Chýba šifrovaný payload.');
  if (!password) throw new Error('Chýba heslo.');

  console.log("Dĺžka prijatého šifrovaného odkazu:", payload.length);

  const parts = payload.split('.');
  if (parts.length !== 4 || (parts[0] !== 'v1' && parts[0] !== 'v2')) {
    throw new Error('Neplatný formát odkazu.');
  }

  const version = parts[0];
  const [, saltB64, ivB64, cipherB64] = parts;

  const salt = fromBase64Url(saltB64);
  const iv = fromBase64Url(ivB64);
  const cipherBytes = fromBase64Url(cipherB64);

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    // Ak ide o nový odkaz, najprv ho po dešifrovaní dekomprimujeme
    if (version === 'v2') {
      const decompressedJson = LZString.decompressFromUint8Array(new Uint8Array(decrypted));
      return JSON.parse(decompressedJson);
    } 
    // Spätná kompatibilita pre staré nekomprimované (v1) odkazy
    else {
      const json = decoder.decode(decrypted);
      return JSON.parse(json);
    }

  } catch (error) {
    // VYLEPŠENIE: Reálna chyba sa vypíše do konzoly prehliadača (F12)
    console.error("Presná chyba pri dešifrovaní (skontrolujte, či odkaz nie je orezaný):", error);
    throw new Error('Nesprávne heslo alebo poškodený (nekompletný) odkaz.');
  }
}

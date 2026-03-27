import LZString from 'lz-string';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const hasCompressionStream =
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// --- Pomocné funkcie pre Base64 URL-safe ---
const toBase64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const sanitizeBase64UrlChunk = (value: string) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^A-Za-z0-9\-_=%]/g, '');

const fromBase64Url = (base64url: string): Uint8Array => {
  let normalized = sanitizeBase64UrlChunk(base64url);
  if (normalized.includes('%')) {
    try {
      normalized = decodeURIComponent(normalized);
    } catch {
      // Ak decodeURIComponent zlyhá, pokračujeme so surovou hodnotou.
    }
  }

  const base64 = normalized.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const gzipCompress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (!hasCompressionStream) {
    throw new Error('CompressionStream nie je k dispozícii.');
  }

  const compressedStream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const compressedBuffer = await new Response(compressedStream).arrayBuffer();
  return new Uint8Array(compressedBuffer);
};

const gzipDecompress = async (bytes: Uint8Array): Promise<Uint8Array> => {
  if (!hasCompressionStream) {
    throw new Error('DecompressionStream nie je k dispozícii.');
  }

  const decompressedStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const decompressedBuffer = await new Response(decompressedStream).arrayBuffer();
  return new Uint8Array(decompressedBuffer);
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

  // Generujeme v2 (LZString) pre maximálnu kompatibilitu medzi prehliadačmi.
  const compressedBytes = LZString.compressToUint8Array(json);
  const version = 'v2';

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
    version,
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

  const normalizedPayload = String(payload || '').trim().replace(/^["']|["']$/g, '');
  const parts = normalizedPayload.split('.');
  if (parts.length !== 4 || !['v1', 'v2', 'v3'].includes(parts[0])) {
    throw new Error('Neplatný formát odkazu.');
  }

  const version = parts[0];
  const [, saltB64, ivB64, cipherB64] = parts;

  let salt: Uint8Array;
  let iv: Uint8Array;
  let cipherBytes: Uint8Array;

  try {
    salt = fromBase64Url(saltB64);
    iv = fromBase64Url(ivB64);
    cipherBytes = fromBase64Url(cipherB64);
  } catch (decodeError) {
    console.error('Chyba dekódovania payloadu (pravdepodobne skrátený/poškodený odkaz):', decodeError);
    throw new Error('Poškodený alebo nekompletný odkaz. Vygenerujte prosím nový link reportu.');
  }

  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBytes
    );

    // Ak ide o nový odkaz, najprv ho po dešifrovaní dekomprimujeme
    if (version === 'v3') {
      if (!hasCompressionStream) {
        throw new Error('Tento report bol vygenerovaný v novšom formáte. Vygenerujte prosím nový zdieľaný link.');
      }
      const decompressed = await gzipDecompress(new Uint8Array(decrypted));
      return JSON.parse(decoder.decode(decompressed));
    }

    if (version === 'v2') {
      const decompressedJson = LZString.decompressFromUint8Array(new Uint8Array(decrypted));
      return JSON.parse(decompressedJson);
    } 
    // Spätná kompatibilita pre staré nekomprimované (v1) odkazy
    else {
      const json = decoder.decode(decrypted);
      return JSON.parse(json);
    }

  } catch (error: any) {
    // VYLEPŠENIE: Reálna chyba sa vypíše do konzoly prehliadača (F12)
    console.error("Presná chyba pri dešifrovaní (skontrolujte, či odkaz nie je orezaný):", error);
    if (error?.message && String(error.message).includes('novšom formáte')) {
      throw error;
    }
    throw new Error('Nesprávne heslo alebo poškodený (nekompletný) odkaz.');
  }
}

// Save Card cryptography. Pure WebCrypto, no storage or network, so it runs the same in browsers and in tests.
//
// From the normalised code (e.g. "TIGER-MANGO-ROCKET-CLOUD", 40 random bits) the device derives two independent
// values with PBKDF2-HMAC-SHA256, 150,000 iterations each:
//   lookup id  = PBKDF2(code, "sq-save-id:v1", 256 bits) as hex  -> the only thing the server learns
//   AES key    = PBKDF2(code, "ShieldQuest.SaveCard.v1" || card salt (16 random bytes), AES-GCM-256)
// The snapshot is encrypted with AES-GCM (fresh 12-byte IV per upload, the id as additional data) after optional
// gzip. The id is slow to compute on purpose: with a plain SHA-256 id, a copy of the server's data would let
// someone test all 2^40 codes in minutes; with PBKDF2 each guess costs 150,000 hashes.

export const SAVE_PBKDF2_ITERATIONS = 150_000;
const ID_SALT = 'sq-save-id:v1';
const KEY_SALT = 'ShieldQuest.SaveCard.v1';
const AAD_PREFIX = 'sq-save:v1:';

/** Plaintext marker byte: how the snapshot JSON was packed before encryption. */
const RAW = 0;
const GZIP = 1;

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

async function baseKey(code: string): Promise<CryptoKey> {
  return subtle().importKey('raw', enc.encode(code), 'PBKDF2', false, ['deriveBits', 'deriveKey']);
}

/** The server lookup id for a normalised code: 64 lowercase hex characters. */
export async function saveCardId(code: string, iterations = SAVE_PBKDF2_ITERATIONS): Promise<string> {
  const bits = await subtle().deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(ID_SALT), iterations },
    await baseKey(code),
    256,
  );
  return toHex(bits);
}

/** The AES-GCM key for a code and card salt. Not extractable. */
export async function saveCardKey(
  code: string,
  salt: Uint8Array,
  iterations = SAVE_PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  const app = enc.encode(KEY_SALT);
  const full = new Uint8Array(app.length + salt.length);
  full.set(app);
  full.set(salt, app.length);
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: full, iterations },
    await baseKey(code),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function pipe(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Wire format, as sent to PUT /api/save/:id. */
export interface SealedSave {
  v: 1;
  salt: string;
  iv: string;
  data: string;
}

export interface Unlocked {
  id: string;
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
}

/** Encrypts a UTF-8 string for the card. */
export async function seal(text: string, card: Unlocked): Promise<SealedSave> {
  const json = enc.encode(text);
  let packed: Uint8Array<ArrayBuffer>;
  if (typeof CompressionStream === 'function') {
    const z = await pipe(json, new CompressionStream('gzip'));
    packed = new Uint8Array(z.length + 1);
    packed[0] = GZIP;
    packed.set(z, 1);
  } else {
    packed = new Uint8Array(json.length + 1);
    packed[0] = RAW;
    packed.set(json, 1);
  }
  const iv = randomBytes(12);
  const data = await subtle().encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(AAD_PREFIX + card.id) },
    card.key,
    packed,
  );
  return { v: 1, salt: toBase64(card.salt), iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Decrypts a sealed save. Throws 'wrong-code' if the key does not fit, 'unsupported' if this browser cannot unpack it. */
export async function open(sealed: SealedSave, card: Unlocked): Promise<string> {
  let packed: Uint8Array<ArrayBuffer>;
  try {
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromBase64(sealed.iv), additionalData: enc.encode(AAD_PREFIX + card.id) },
      card.key,
      fromBase64(sealed.data),
    );
    packed = new Uint8Array(plain);
  } catch {
    throw new Error('wrong-code');
  }
  const body = packed.subarray(1);
  if (packed[0] === RAW) return dec.decode(body);
  if (packed[0] === GZIP) {
    if (typeof DecompressionStream !== 'function') throw new Error('unsupported');
    return dec.decode(await pipe(body.slice(), new DecompressionStream('gzip')));
  }
  throw new Error('unsupported');
}

/** Derives id and key for a code. `salt` is the card's (from storage or the downloaded blob); omitted = new card. */
export async function unlock(
  code: string,
  salt?: Uint8Array<ArrayBuffer>,
  iterations = SAVE_PBKDF2_ITERATIONS,
): Promise<Unlocked> {
  const s = salt ?? randomBytes(16);
  const [id, key] = await Promise.all([saveCardId(code, iterations), saveCardKey(code, s, iterations)]);
  return { id, key, salt: s };
}

/** SHA-256 hex of a string, used to skip uploads when nothing changed. */
export async function digest(text: string): Promise<string> {
  return toHex(await subtle().digest('SHA-256', enc.encode(text)));
}

// PIN lock helpers. The PIN is stored only as a salted PBKDF2 hash. The lock
// is a privacy screen for people picking up the phone: it does not encrypt the
// data in the browser's storage.

export interface PinHash {
  salt: string
  hash: string
  iterations: number
  /** Number of digits, so the lock screen can check as soon as they are entered. */
  length: number
}

const ITERATIONS = 150_000

const toB64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)))
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256)
  return toB64(bits)
}

export const isValidPin = (pin: string) => /^\d{4,8}$/.test(pin)

export async function hashPin(pin: string): Promise<PinHash> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return { salt: toB64(salt), hash: await derive(pin, salt, ITERATIONS), iterations: ITERATIONS, length: pin.length }
}

export async function verifyPin(pin: string, stored: PinHash): Promise<boolean> {
  const candidate = await derive(pin, fromB64(stored.salt), stored.iterations)
  // Constant-time comparison.
  if (candidate.length !== stored.hash.length) return false
  let diff = 0
  for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ stored.hash.charCodeAt(i)
  return diff === 0
}

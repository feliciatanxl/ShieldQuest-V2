// Generated identities for squad sessions: room codes, host keys, seat ids and friendly pseudonyms.
// Nobody ever types a name (GDD §7.2, §11.6). Secrets are kept only as SHA-256 hashes (§11.4).

import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from '@shieldquest/shared';

/** Friendly colours and qualities. Curated: nothing that could read as a judgement of the player. */
const ADJECTIVES = [
  'Teal', 'Amber', 'Coral', 'Indigo', 'Jade', 'Saffron', 'Violet', 'Mint', 'Sky', 'Sunny',
  'Gentle', 'Bright', 'Calm', 'Swift', 'Lucky', 'Brave', 'Kind', 'Steady', 'Clever', 'Golden',
  'Silver', 'Misty', 'Starry', 'Mellow', 'Breezy', 'Cheery', 'Nimble', 'Lively', 'Rosy', 'Cosmic',
] as const;

/**
 * The city's animals (Singapore wildlife and friendly creatures). The six squad totems (Hornbill, Pangolin,
 * Kingfisher, Heron, Civet, Macaque) are left out so a pseudonym never looks like a squad name.
 */
const ANIMALS = [
  'Otter', 'Kite', 'Gecko', 'Turtle', 'Owl', 'Sunbird', 'Dragonfly', 'Mousedeer', 'Starling', 'Egret',
  'Koi', 'Butterfly', 'Seahorse', 'Dolphin', 'Squirrel', 'Bulbul', 'Myna', 'Terrapin', 'Robin', 'Crab',
  'Treeshrew', 'Tortoise', 'Parrot', 'Swiftlet', 'Ladybird', 'Pufferfish',
] as const;

/** Picks an unused "Adjective Animal" pseudonym. Falls back to a numbered one if the list is exhausted. */
export function makePseudonym(used: ReadonlySet<string>): string {
  for (let i = 0; i < 200; i++) {
    const name = `${ADJECTIVES[randomInt(ADJECTIVES.length)]} ${ANIMALS[randomInt(ANIMALS.length)]}`;
    if (!used.has(name)) return name;
  }
  for (const a of ADJECTIVES) {
    for (const b of ANIMALS) {
      const name = `${a} ${b}`;
      if (!used.has(name)) return name;
    }
  }
  return `City Guest ${used.size + 1}`;
}

/** Letter runs we never want to project on a classroom wall. */
const BLOCKED = ['FUK', 'FCK', 'SEX', 'DCK', 'CNT', 'ASS', 'KKK', 'NGR', 'SHT', 'XXX', 'WTF', 'DMN', 'PNS', 'FAG', 'GAY', 'NAZ', 'HTL'];

/** A fresh room code from a cryptographic RNG (unbiased: randomInt rejects out-of-range draws). */
export function newRoomCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)];
    if (!BLOCKED.some((w) => code.includes(w))) return code;
  }
}

/** 128-bit secret, base64url (22 characters). */
export const newSecret = (): string => randomBytes(16).toString('base64url');

/** Short random id for seats and aggregates (72 bits; not a secret). */
export const newId = (): string => randomBytes(9).toString('base64url');

export const hashSecret = (secret: string): string => createHash('sha256').update(secret).digest('hex');

/** Constant-time comparison of a presented secret with a stored hash. */
export function matchesHash(secret: string, hash: string): boolean {
  const a = Buffer.from(hashSecret(secret), 'hex');
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

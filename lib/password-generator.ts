import { randomInt } from "crypto";

// Excludes visually ambiguous characters (0/O, 1/l/I) so a temp password
// relayed verbally or by hand is easy to read back correctly.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

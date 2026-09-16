const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALL = `${LOWER}${UPPER}${DIGITS}`;

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] % max;
}

function pick(alphabet: string): string {
  return alphabet[randomIndex(alphabet.length)] ?? alphabet[0];
}

export function generatePassword(length = 12): string {
  const size = Math.max(length, 3);
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS)];
  while (chars.length < size) {
    chars.push(pick(ALL));
  }
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    const current = chars[i];
    chars[i] = chars[j] ?? current;
    chars[j] = current;
  }
  return chars.join('');
}

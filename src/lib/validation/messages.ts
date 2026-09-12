/**
 * Zod's default wording, said plainly. Pure, so it is unit-testable.
 *
 *   "String must contain at least 2 character(s)"  → "at least 2 characters"
 *   "Expected number, received nan"                 → "must be a number"
 */
export function plainMessage(message: string): string {
  const m = message
    .replace(/^String must contain at least (\d+) character\(s\)$/, (_, n) => `at least ${n} character${n === '1' ? '' : 's'}`)
    .replace(/^String must contain at most (\d+) character\(s\)$/, (_, n) => `at most ${n} character${n === '1' ? '' : 's'}`)
    .replace(/^String must contain exactly (\d+) character\(s\)$/, (_, n) => `exactly ${n} character${n === '1' ? '' : 's'}`)
    .replace(/^Number must be greater than or equal to (-?[\d.]+)$/, 'at least $1')
    .replace(/^Number must be less than or equal to (-?[\d.]+)$/, 'at most $1')
    .replace(/^Expected number, received nan$/i, 'must be a number')
    .replace(/^Expected (\w+), received (\w+)$/, 'must be a $1')
    .replace(/^Invalid url$/i, 'must be a full address starting with https://')
    .replace(/^Invalid email$/i, 'not a valid email')
    .replace(/^Invalid uuid$/i, 'not a valid id')
    .replace(/^Invalid enum value\. Expected (.+?), received .*$/, 'must be one of $1')
    .replace(/^Required$/, 'required')
    .replace(/^Invalid$/, 'not accepted')
  return m
}

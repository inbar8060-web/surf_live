import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchTerm } from '../../src/lib/util/search.ts'

test('keeps what a name, email or phone can contain', () => {
  assert.equal(searchTerm('Noa Levi'), 'Noa Levi')
  assert.equal(searchTerm('noa@surferlive.test'), 'noa@surferlive.test')
  assert.equal(searchTerm('+972 50-000-0004'), '+972 50-000-0004')
  assert.equal(searchTerm("O'Brien"), "O'Brien")
  assert.equal(searchTerm('נעה לוי'), 'נעה לוי')
})

test('strips PostgREST filter syntax so a term cannot rewrite the query (CWE-943)', () => {
  // commas and parentheses are removed; "_" goes too, being a LIKE wildcard
  assert.equal(
    searchTerm('x),id.eq.11111111-1111-1111-1111-111111111111,(full_name.ilike.'),
    'xid.eq.11111111-1111-1111-1111-111111111111fullname.ilike.',
  )
  assert.equal(searchTerm('a,b'), 'ab')
  assert.equal(searchTerm('(a)'), 'a')
})

test('strips LIKE wildcards and its escape character', () => {
  assert.equal(searchTerm('%'), '')
  assert.equal(searchTerm('a_b%c\\d'), 'abcd')
})

test('collapses whitespace and bounds the length', () => {
  assert.equal(searchTerm('  noa    levi  '), 'noa levi')
  assert.equal(searchTerm('a'.repeat(500)).length, 60)
  assert.equal(searchTerm(undefined), '')
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { plainMessage } from '../../src/lib/validation/messages.ts'

test('plainMessage turns Zod defaults into plain words', () => {
  assert.equal(plainMessage('String must contain at least 2 character(s)'), 'at least 2 characters')
  assert.equal(plainMessage('String must contain at most 1 character(s)'), 'at most 1 character')
  assert.equal(plainMessage('Expected number, received nan'), 'must be a number')
  assert.equal(plainMessage('Invalid email'), 'not a valid email')
  assert.equal(plainMessage('Required'), 'required')
  assert.equal(plainMessage('Paste a Google Maps link'), 'Paste a Google Maps link')
})

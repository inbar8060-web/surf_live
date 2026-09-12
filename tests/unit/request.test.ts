import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clientIp } from '../../src/lib/util/request.ts'

const h = (entries: Record<string, string>) => new Headers(entries)

test('takes the first forwarded address', () => {
  assert.equal(clientIp(h({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' })), '203.0.113.9')
})

test('accepts IPv6, with or without brackets', () => {
  assert.equal(clientIp(h({ 'x-forwarded-for': '2001:db8::1' })), '2001:db8::1')
  assert.equal(clientIp(h({ 'x-real-ip': '[2001:db8::2]' })), '2001:db8::2')
})

test('falls back to x-real-ip when the forwarded entry is junk', () => {
  assert.equal(clientIp(h({ 'x-forwarded-for': 'unknown', 'x-real-ip': '198.51.100.4' })), '198.51.100.4')
})

test('returns null rather than a value that would fail an inet column (CWE-20)', () => {
  assert.equal(clientIp(h({ 'x-forwarded-for': "'); drop table clients; --" })), null)
  assert.equal(clientIp(h({ 'x-forwarded-for': 'not-an-ip' })), null)
  assert.equal(clientIp(h({})), null)
})

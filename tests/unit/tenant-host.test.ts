import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseHost, slugify } from '../../src/lib/tenant-host.ts'

const D = 'surferlive.app'

test('a club subdomain names that club', () => {
  assert.deepEqual(parseHost('reef-riders.surferlive.app', D), { kind: 'club', slug: 'reef-riders' })
  assert.deepEqual(parseHost('Reef-Riders.SurferLive.app:443', D), { kind: 'club', slug: 'reef-riders' })
})

test('the operator lives on admin.<domain>, the apex on the bare domain or www', () => {
  assert.deepEqual(parseHost('admin.surferlive.app', D), { kind: 'platform' })
  assert.deepEqual(parseHost('surferlive.app', D), { kind: 'apex' })
  assert.deepEqual(parseHost('www.surferlive.app', D), { kind: 'apex' })
})

test('local development works on *.localhost with the port', () => {
  assert.deepEqual(parseHost('surfer-live.localhost:3000', 'localhost:3000'), { kind: 'club', slug: 'surfer-live' })
  assert.deepEqual(parseHost('admin.localhost:3000', 'localhost:3000'), { kind: 'platform' })
  assert.deepEqual(parseHost('172.20.10.2:3000', 'localhost:3000'), { kind: 'apex' })
})

test('nothing else names a club (CWE-20: host header is untrusted input)', () => {
  assert.deepEqual(parseHost('a.b.surferlive.app', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('api.surferlive.app', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('surferlive.app.evil.example', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('evil.example', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('-bad.surferlive.app', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('ab.surferlive.app', D), { kind: 'unknown' })
  assert.deepEqual(parseHost('', D), { kind: 'unknown' })
  assert.deepEqual(parseHost(null, D), { kind: 'unknown' })
})

test('slugify turns a club name into a usable subdomain', () => {
  assert.equal(slugify('Reef Riders Surf Club'), 'reef-riders-surf-club')
  assert.equal(slugify('  Café Été!! '), 'cafe-ete')
  assert.equal(slugify('גלים'), '')
  assert.equal(slugify('Admin'), 'admin-club')
  assert.ok(slugify('x'.repeat(80)).length <= 40)
})

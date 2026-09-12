import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractMapsLinkFacts, parseMapsUrl } from '../../src/lib/places/maps-link.ts'

test('parseMapsUrl accepts only https Google Maps hosts', () => {
  assert.ok(parseMapsUrl('https://www.google.com/maps/place/Hilton+Beach/@32.088,34.768,17z'))
  assert.ok(parseMapsUrl('https://maps.app.goo.gl/AbC123'))
  assert.ok(parseMapsUrl('https://maps.google.co.il/?cid=123'))
  assert.equal(parseMapsUrl('http://www.google.com/maps/place/x'), null)
  assert.equal(parseMapsUrl('https://evil.example/maps/place/x'), null)
  assert.equal(parseMapsUrl('https://www.google.com.evil.example/maps'), null)
  assert.equal(parseMapsUrl('not a url'), null)
  // plain google.com is only a Maps link on /maps; maps.google.com is one on any path
  assert.equal(parseMapsUrl('https://www.google.com/search?q=surf'), null)
  assert.ok(parseMapsUrl('https://maps.google.com/?cid=6160871504057887173'))
})

test('parseMapsUrl unwraps the consent page', () => {
  const wrapped = 'https://consent.google.com/m?continue=' + encodeURIComponent('https://www.google.com/maps/place/Reef/@1,2,3z')
  assert.equal(parseMapsUrl(wrapped)?.pathname, '/maps/place/Reef/@1,2,3z')
  assert.equal(parseMapsUrl('https://consent.google.com/m?continue=https://evil.example/'), null)
})

test('extractMapsLinkFacts prefers the pin over the viewport and finds the place id', () => {
  const url = parseMapsUrl(
    'https://www.google.com/maps/place/Hilton+Beach+Surf+Club/@32.0900,34.7700,17z/data=!3m1!4b1!4m6!3m5!1sChIJabcdefghijklmn!8m2!3d32.0881!4d34.7679!16s%2Fg%2F11abc',
  )!
  const facts = extractMapsLinkFacts(url)
  assert.equal(facts.name, 'Hilton Beach Surf Club')
  assert.equal(facts.latitude, 32.0881)
  assert.equal(facts.longitude, 34.7679)
  assert.equal(facts.placeId, 'ChIJabcdefghijklmn')
})

test('extractMapsLinkFacts reads the search and share forms', () => {
  const search = extractMapsLinkFacts(
    parseMapsUrl('https://www.google.com/maps/search/?api=1&query=32.1,34.8&query_place_id=ChIJ0123456789abc')!,
  )
  assert.deepEqual([search.latitude, search.longitude, search.placeId], [32.1, 34.8, 'ChIJ0123456789abc'])

  const plain = extractMapsLinkFacts(parseMapsUrl('https://www.google.com/maps?cid=42')!)
  assert.deepEqual(plain, { name: null, latitude: null, longitude: null, placeId: null })
})

test('extractMapsLinkFacts rejects impossible coordinates and hex ids', () => {
  const facts = extractMapsLinkFacts(parseMapsUrl('https://www.google.com/maps/place/X/@95,200,3z/data=!1s0x1:0x2')!)
  assert.equal(facts.latitude, null)
  assert.equal(facts.placeId, null)
})

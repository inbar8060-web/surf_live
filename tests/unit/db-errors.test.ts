import { test } from 'node:test'
import assert from 'node:assert/strict'
import { describeDbError, describeDbFailure } from '../../src/lib/db/errors.ts'

test('shows the wording our own triggers raise for people', () => {
  assert.equal(
    describeDbError({ code: '23514', message: 'Only 2 place(s) left in this session' }),
    'Only 2 place(s) left in this session',
  )
  assert.equal(
    describeDbError({ code: '42501', message: 'You cannot set a booking to approved' }),
    'You cannot set a booking to approved',
  )
})

test('a check constraint names the field, the reason and the rule', () => {
  const maps = describeDbFailure({
    code: '23514',
    message: 'new row for relation "clubs" violates check constraint "clubs_maps_url_check"',
  })
  assert.match(maps.error, /^Google Maps link: must be a Google Maps link/)
  assert.match(maps.error, /\(rule clubs_maps_url_check\)\.$/)
  assert.deepEqual(Object.keys(maps.fieldErrors ?? {}), ['mapsUrl'])

  const order = describeDbError({
    code: '23514',
    message: 'new row for relation "time_slots" violates check constraint "time_slots_time_order"',
  })
  assert.equal(order, 'End time: the session must end after it starts (rule time_slots_time_order).')

  // an unknown rule still says which column, by reading the constraint name
  const unknown = describeDbFailure({
    code: '23514',
    message: 'new row for relation "services" violates check constraint "services_duration_minutes_check"',
  })
  assert.equal(unknown.error, 'Duration: the value does not satisfy the rule (rule services_duration_minutes_check).')
  assert.deepEqual(unknown.fieldErrors, { durationMinutes: 'the value does not satisfy the rule' })
})

test('foreign keys, missing values and row-level security say what and where', () => {
  assert.equal(
    describeDbError({
      code: '23503',
      message: 'insert or update on table "reservations" violates foreign key constraint "reservations_slot_id_fkey"',
    }),
    'Slot id: refers to something that does not exist, or belongs to another club (rule reservations_slot_id_fkey).',
  )
  assert.equal(
    describeDbError({ code: '23502', message: 'null value in column "admin_email" of relation "clubs" violates not-null constraint' }),
    'Administrator email: is required (rule not null).',
  )
  assert.match(
    describeDbError({ code: '42501', message: 'new row violates row-level security policy for table "document_signatures"' }),
    /^You are not allowed to write this document signatures: .*\(rule row-level security on document_signatures\)\.$/,
  )
})

test('duplicates name the field and the rule', () => {
  assert.equal(
    describeDbError({ code: '23505', message: 'duplicate key value violates unique constraint "session_reviews_once"' }),
    'This form: you have already reviewed this session (rule session_reviews_once).',
  )
  const dup = describeDbFailure({
    code: '23505',
    message: 'duplicate key value violates unique constraint "clubs_slug_key"',
    details: 'Key (slug)=(reef) already exists.',
  })
  assert.equal(dup.error, 'Address on the platform: a club already lives at that address (rule clubs_slug_key).')
  assert.deepEqual(dup.fieldErrors, { slug: 'a club already lives at that address' })
  assert.equal(
    describeDbError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "widgets_code_key"',
      details: 'Key (code)=(x1) already exists.',
    }),
    'Code: that value is already taken (rule widgets_code_key).',
  )
})

test('type and length problems quote the offending value', () => {
  assert.equal(
    describeDbError({ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }),
    '"abc" is not a valid uuid (rule input syntax).',
  )
  assert.equal(
    describeDbError({ code: '22001', message: 'value too long for type character varying(40)' }),
    'A value is too long — at most 40 characters (rule value too long).',
  )
})

test('anything unrecognised keeps the caller\'s line and adds the database code', () => {
  assert.equal(
    describeDbError({ code: 'XX000', message: 'internal detail' }, 'Could not save.'),
    'Could not save. (database error XX000: internal detail)',
  )
  assert.equal(describeDbError(null), 'Something went wrong.')
})

import { expect, test } from '@playwright/test'
import { rotatedNetwork } from '../src/shared/networkRotation'

// The order downloads take networks in when alternating: 1, 2, 1, 2 — and wrapping/negative-safe.

test('alternating takes the networks in turn and wraps around', () => {
  const pool = ['wifi', 'usb']
  expect(rotatedNetwork(pool, 0)).toEqual({ network: 'wifi', next: 1 })
  expect(rotatedNetwork(pool, 1)).toEqual({ network: 'usb', next: 2 })
  expect(rotatedNetwork(pool, 2)).toEqual({ network: 'wifi', next: 3 })
  expect(rotatedNetwork(pool, 3)).toEqual({ network: 'usb', next: 4 })
})

test('a single network is always taken', () => {
  expect(rotatedNetwork(['only'], 0)).toEqual({ network: 'only', next: 1 })
  expect(rotatedNetwork(['only'], 7)).toEqual({ network: 'only', next: 8 })
})

test('three networks cycle in order', () => {
  const pool = ['a', 'b', 'c']
  expect([0, 1, 2, 3, 4].map((rotation) => rotatedNetwork(pool, rotation).network)).toEqual([
    'a',
    'b',
    'c',
    'a',
    'b'
  ])
})

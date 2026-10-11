import { describe, expect, it } from 'vitest'
import { hashPin, isValidPin, verifyPin } from './pin'

describe('PIN', () => {
  it('accepts 4 to 8 digits only', () => {
    expect(isValidPin('1234')).toBe(true)
    expect(isValidPin('12345678')).toBe(true)
    expect(isValidPin('123')).toBe(false)
    expect(isValidPin('12a4')).toBe(false)
  })

  it('verifies the right PIN and rejects others', async () => {
    const stored = await hashPin('2580')
    expect(stored.hash).not.toContain('2580')
    expect(await verifyPin('2580', stored)).toBe(true)
    expect(await verifyPin('2581', stored)).toBe(false)
  })

  it('salts each hash differently', async () => {
    const [a, b] = await Promise.all([hashPin('1111'), hashPin('1111')])
    expect(a.hash).not.toBe(b.hash)
  })
})

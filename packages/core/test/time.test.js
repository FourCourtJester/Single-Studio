import { describe, expect, it } from 'vitest'

import { formatDuration, parseDuration, untilClockTime } from '../src/toolkits/time'

describe('parseDuration', () => {
  it('reads bare seconds, mm:ss, and hh:mm:ss', () => {
    expect(parseDuration(90)).toBe(90_000)
    expect(parseDuration('90')).toBe(90_000)
    expect(parseDuration('1:30')).toBe(90_000)
    expect(parseDuration('1:02:03')).toBe(3_723_000)
  })

  it('returns zero for junk', () => {
    expect(parseDuration('')).toBe(0)
    expect(parseDuration(undefined)).toBe(0)
    expect(parseDuration('abc')).toBe(0)
  })
})

describe('formatDuration', () => {
  it('pads to mm:ss and grows only when needed', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(9_000)).toBe('00:09')
    expect(formatDuration(90_000)).toBe('01:30')
    expect(formatDuration(3_723_000)).toBe('1:02:03')
    expect(formatDuration(90_000_000)).toBe('1:01:00:00')
  })

  it('rounds up so a timer never shows 00:00 while still running', () => {
    expect(formatDuration(1)).toBe('00:01')
    expect(formatDuration(1_500)).toBe('00:02')
  })

  it('floors at zero for negative input', () => {
    expect(formatDuration(-5_000)).toBe('00:00')
  })
})

describe('untilClockTime', () => {
  it('measures forward to a time later the same day', () => {
    const now = new Date('2026-08-17T10:00:00')
    expect(untilClockTime('10:30', now)).toBe(30 * 60 * 1000)
  })

  it('rolls to tomorrow once the time has passed', () => {
    const now = new Date('2026-08-17T23:30:00')
    expect(untilClockTime('00:15', now)).toBe(45 * 60 * 1000)
  })
})

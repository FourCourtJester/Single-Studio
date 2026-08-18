import { describe, expect, it } from 'vitest'

import { displayedSeconds, formatDuration, parseDuration, untilClockTime } from '../src/toolkits/time'

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

  it('counts up by flooring, so a stopwatch shows 00:00 for its first second', () => {
    // Rounding up is right for a countdown -- 00:01 should stay on screen until the
    // very last instant. It is wrong counting the other way: a stopwatch that reads
    // 00:01 the moment it is pressed has skipped a second before it started.
    expect(formatDuration(1, { round: 'floor' })).toBe('00:00')
    expect(formatDuration(999, { round: 'floor' })).toBe('00:00')
    expect(formatDuration(1_000, { round: 'floor' })).toBe('00:01')
    expect(formatDuration(1_999, { round: 'floor' })).toBe('00:01')
  })
})

describe('displayedSeconds', () => {
  // What the view polls. It is the whole point of the tick that this changes at
  // most once a second, so a clock can be checked often and rendered rarely.
  it('counts a countdown down, rounding up to match the display', () => {
    const timer = { ts: 10_000 }
    expect(displayedSeconds(timer, 0)).toBe(10)
    expect(displayedSeconds(timer, 1)).toBe(10)
    expect(displayedSeconds(timer, 5_400)).toBe(5)
    expect(displayedSeconds(timer, 10_000)).toBe(0)
  })

  it('never runs a countdown past zero', () => {
    expect(displayedSeconds({ ts: 10_000 }, 30_000)).toBe(0)
  })

  it('counts a running stopwatch up, flooring to match the display', () => {
    const timer = { from: 1_000 }
    expect(displayedSeconds(timer, 1_000)).toBe(0)
    expect(displayedSeconds(timer, 1_999)).toBe(0)
    expect(displayedSeconds(timer, 2_000)).toBe(1)
    expect(displayedSeconds(timer, 6_500)).toBe(5)
  })

  it('holds still while a stopwatch is paused', () => {
    const timer = { elapsed: 4_500 }
    expect(displayedSeconds(timer, 0)).toBe(4)
    expect(displayedSeconds(timer, 99_999)).toBe(4)
  })

  it('reads nothing as zero rather than throwing', () => {
    expect(displayedSeconds(undefined, 0)).toBe(0)
    expect(displayedSeconds({}, 0)).toBe(0)
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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { sheets, SheetsHandler } from '../src/index'

const ok = (values) => ({ ok: true, status: 200, json: async () => ({ values }) })
const refused = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }) })

const build = (Handler = SheetsHandler, over = {}, owner = () => true) =>
  sheets(Handler).create({
    mutate: vi.fn(),
    owner,
    studio: 's',
    config: { id: 'sheet-1', range: 'A:Z', key: 'k', every: 30, header: true, ...over },
  })

/** Collect what a studio's handler is told. */
const watching = () => {
  const rows = vi.fn()
  const problems = vi.fn()

  class MyShow extends SheetsHandler {
    onRows(...args) {
      rows(...args)
    }

    onProblem(...args) {
      problems(...args)
    }
  }

  return { MyShow, rows, problems }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the first read', () => {
  it('delivers the rows', async () => {
    const { MyShow, rows } = watching()

    vi.stubGlobal('fetch', vi.fn(async () => ok([['Team', 'Points'], ['Broncos', '12']])))

    await build(MyShow).open()

    expect(rows).toHaveBeenCalledWith(expect.objectContaining({ count: 1, rows: [{ team: 'Broncos', points: '12' }] }))
  })

  it('fails loudly, so a wrong id is not a timer nobody is watching', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => refused(404, 'Requested entity was not found.')))

    await expect(build().open()).rejects.toThrow(/spreadsheet with that id/)
  })

  it('explains a private sheet as the sharing setting it is', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => refused(403, 'The caller does not have permission')))

    await expect(build().open()).rejects.toThrow(/anyone with the link/)
  })
})

describe('polling', () => {
  it('says nothing when the sheet has not changed', async () => {
    // The whole reason this is cheap. Every read that finds no edit costs one
    // request and nothing else -- no mutation, no replication, no re-render.
    const { MyShow, rows } = watching()
    const values = [['Team', 'Points'], ['Broncos', '12']]

    vi.stubGlobal('fetch', vi.fn(async () => ok(values)))

    const plugin = build(MyShow)

    await plugin.open()
    expect(rows).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(30_000)

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(rows).toHaveBeenCalledTimes(1)
  })

  it('speaks up as soon as somebody edits something', async () => {
    const { MyShow, rows } = watching()
    let points = '12'

    vi.stubGlobal('fetch', vi.fn(async () => ok([['Team', 'Points'], ['Broncos', points]])))

    await build(MyShow).open()

    points = '15'
    await vi.advanceTimersByTimeAsync(30_000)

    expect(rows).toHaveBeenCalledTimes(2)
    expect(rows).toHaveBeenLastCalledWith(expect.objectContaining({ rows: [{ team: 'Broncos', points: '15' }] }))
  })

  it('will not poll faster than the floor, whatever is typed', async () => {
    // Google allows sixty reads a minute. A typo of 1 would spend that in a minute
    // and get the key rate limited mid-show.
    vi.stubGlobal('fetch', vi.fn(async () => ok([['A'], ['1']])))

    const plugin = build(SheetsHandler, { every: 1 })

    await plugin.open()
    await vi.advanceTimersByTimeAsync(4_000)

    expect(fetch).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_500)
    expect(fetch).toHaveBeenCalledTimes(2)
  })
})

describe('ownership', () => {
  it('does not poll on a machine that does not own ingress', async () => {
    // Five operators each polling the same sheet is five times the quota and five
    // writers racing on the same paths, for one sheet's worth of information.
    vi.stubGlobal('fetch', vi.fn(async () => ok([['A'], ['1']])))

    const plugin = build(SheetsHandler, {}, () => false)

    await plugin.open()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('when Google refuses later', () => {
  it('stops rather than retrying something a retry cannot fix', async () => {
    // A private sheet stays private however many times it is asked. Retrying is
    // just spending quota to be refused again.
    const { MyShow, problems } = watching()
    let first = true

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (first) {
          first = false

          return ok([['A'], ['1']])
        }

        return refused(403, 'The caller does not have permission')
      }),
    )

    const plugin = build(MyShow)

    await plugin.open()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(problems).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }))
    expect(plugin.status).toBe('error')

    const spent = fetch.mock.calls.length

    await vi.advanceTimersByTimeAsync(120_000)
    expect(fetch).toHaveBeenCalledTimes(spent)
  })

  it('treats a dropped network as something to retry, not a misconfiguration', async () => {
    let first = true

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (first) {
          first = false

          return ok([['A'], ['1']])
        }

        throw new Error('network down')
      }),
    )

    const plugin = build()
    const dropped = vi.spyOn(plugin, 'dropped').mockImplementation(() => {})

    await plugin.open()
    await vi.advanceTimersByTimeAsync(30_000)

    expect(dropped).toHaveBeenCalled()
  })
})

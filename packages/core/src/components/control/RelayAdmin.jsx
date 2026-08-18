import { useCallback, useEffect, useState } from 'react'

import { useSyncStatus } from '../../hooks/useSync'
import { cx } from '../../toolkits/cx'
import { Icon } from '../common/Icon'
import { Tooltip } from '../common/Tooltip'

/**
 * Invite an operator, or remove one.
 *
 * Productions lose people. Someone finishes a contract, someone is not on this
 * show, someone's laptop goes missing an hour before doors. With one shared secret
 * the only answer is to rotate it and re-tell everyone else, which is the sort of
 * job that gets postponed until it is never done -- so removing a person has to be
 * one click, from the board, mid-show, without a redeploy.
 *
 * The admin secret is kept in localStorage on the machine that runs the show,
 * never in the build. It is a different power from an operator's token -- one lets
 * you edit a show, the other lets you decide who can -- and it should live in
 * exactly one place.
 *
 * A minted secret is shown once. It is not readable afterwards, because a relay
 * that can recite every operator's credential is a relay worth stealing; if
 * somebody loses theirs, issue another.
 */
const KEY = 'single-studio:relay-admin'

const stored = () => {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

/** ws:// is the socket; the token API is the same host over http. */
const apiFor = (url, room) => {
  const base = new URL(url)

  base.protocol = base.protocol === 'wss:' ? 'https:' : 'http:'
  base.pathname = `/${room}/tokens`

  return base.toString().replace(/\/$/, '')
}

export function RelayAdmin({ label = 'Operators', className, ...rest }) {
  const { room, configured, url } = useSyncStatus()
  const [secret, setSecret] = useState(stored)
  const [tokens, setTokens] = useState(null)
  const [minted, setMinted] = useState(null)
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const endpoint = configured && url ? apiFor(url, room) : null

  const call = useCallback(
    async (path = '', options = {}) => {
      if (!endpoint || !secret) return null

      setBusy(true)
      setError(null)

      try {
        const response = await fetch(`${endpoint}${path}`, {
          ...options,
          headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json', ...options.headers },
        })
        const body = await response.json().catch(() => ({}))

        if (!response.ok) throw new Error(body.error ?? `relay said ${response.status}`)

        return body
      } catch (failure) {
        setError(failure.message)

        return null
      } finally {
        setBusy(false)
      }
    },
    [endpoint, secret],
  )

  const refresh = useCallback(async () => {
    const body = await call()

    if (body) setTokens(body.tokens)
  }, [call])

  useEffect(() => {
    if (secret) refresh()
  }, [secret, refresh])

  if (!configured) return null

  const remember = (value) => {
    setSecret(value)

    try {
      localStorage.setItem(KEY, value)
    } catch {
      // A locked-down profile costs the convenience, not the feature.
    }
  }

  return (
    <section className={cx('ss-relay-admin flex w-full flex-col gap-2', className)} {...rest}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>

      {tokens === null ? (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-500">Paste the relay&rsquo;s admin secret to invite or remove operators.</span>
          <input
            type="password"
            defaultValue={secret}
            onBlur={(event) => remember(event.target.value.trim())}
            placeholder="admin secret"
            aria-label="Relay admin secret"
            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:border-sky-500"
          />
        </label>
      ) : (
        <>
          <div className="ss-input-group flex">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Their name"
              aria-label="New operator name"
              className="min-w-0 grow rounded-l-md border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus:relative focus:border-sky-500"
            />
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                const body = await call('', { method: 'POST', body: JSON.stringify({ name: name.trim() }) })

                if (!body) return

                setMinted(body.token)
                setName('')
                refresh()
              }}
              className="-ml-px shrink-0 rounded-r-md border border-sky-600 bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:border-sky-500 hover:bg-sky-500 disabled:opacity-40"
            >
              Invite
            </button>
          </div>

          {minted ? (
            <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
              <span className="text-xs text-amber-200">Send this to {minted.name || 'them'} now &mdash; it cannot be read again.</span>
              <code className="ss-minted select-all break-all rounded bg-slate-950 px-2 py-1 font-mono text-xs text-slate-100">{minted.secret}</code>
              <button type="button" onClick={() => setMinted(null)} className="self-start text-xs text-amber-300/80 hover:text-amber-200">
                Done
              </button>
            </div>
          ) : null}

          <ul className="flex flex-col gap-1">
            {tokens.map((token) => (
              <li key={token.id} className="ss-operator-token flex items-center gap-2 rounded-md border border-slate-800 px-2 py-1.5 text-sm">
                <span className={cx('truncate', token.revokedAt ? 'text-slate-600 line-through' : 'text-slate-200')}>{token.name || token.id}</span>
                {token.revokedAt ? (
                  <span className="ml-auto text-[0.65rem] uppercase tracking-wide text-slate-600">removed</span>
                ) : (
                  <Tooltip label="Remove them from this room now" align="end" className="ml-auto">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        if (!window.confirm(`Remove ${token.name || 'this operator'}? They are disconnected immediately.`)) return
                        await call(`/${token.id}`, { method: 'DELETE' })
                        refresh()
                      }}
                      aria-label={`Remove ${token.name || token.id}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-600 hover:text-white disabled:opacity-40"
                    >
                      <Icon name="close" />
                    </button>
                  </Tooltip>
                )}
              </li>
            ))}
            {tokens.length ? null : <li className="text-xs text-slate-500">Nobody has been invited. The room is open to anyone who can reach it.</li>}
          </ul>
        </>
      )}

      {error ? <span className="text-xs text-rose-400">{error}</span> : null}
    </section>
  )
}

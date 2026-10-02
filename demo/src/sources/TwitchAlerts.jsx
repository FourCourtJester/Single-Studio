import { useEffect, useState } from 'react'

import { Fit, Transition, useClockOffset, useVelcroList } from '@single-studio/core'
import { Scene } from '@single-studio/core/source'

import { ALERT_MS, KINDS } from '../components/twitch'

/**
 * The room's time, a few times a second.
 *
 * The room's rather than this machine's, because each alert's slot was set in the
 * room's time when it was queued -- so every screen agrees which alert is up.
 */
function useNow() {
  const offset = useClockOffset()
  const [now, setNow] = useState(() => Date.now() + offset)

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + offset), 200)

    return () => clearInterval(tick)
  }, [offset])

  return now
}

/**
 * Follows, subs, gifts, cheers and raids, one at a time. `#/source/twitch-alerts`.
 *
 * Top centre, dropping in just below where the scoreboard sits, so a show running
 * both has the alert hang off the bar rather than land on it -- and a show with no
 * scoreboard still has it where eyes go first.
 *
 * Which alert is up is worked out from the queue rather than pushed: each one was
 * given a start and an end when it arrived, and this shows whichever slot contains
 * now. A source reloaded mid-alert, or opened on a second machine, picks it up
 * partway instead of replaying it, and nothing has to tell this graphic to stop.
 */
export default function TwitchAlerts() {
  const alerts = useVelcroList('variables.twitch.alerts')
  const now = useNow()
  const [key, alert] = alerts.find(([, queued]) => queued.start <= now && now < queued.until) ?? []
  const kind = KINDS[alert?.kind] ?? KINDS.follow
  const left = alert ? Math.max(0, Math.min(1, (alert.until - now) / ALERT_MS)) : 0

  return (
    <Scene className="flex items-start justify-center pt-36">
      {/* The key is the trigger, so one alert straight after another runs out, swaps
          and in again, rather than changing its words in place. */}
      <Transition trigger={key ?? false} transition="slide-down ease-back">
        {alert ? (
          <div className="twitch-alert w-[34rem] overflow-hidden rounded-lg bg-slate-950/95 text-white shadow-2xl ring-1 ring-white/10" data-kind={alert.kind}>
            <div className={`h-1 ${kind.bar}`} />
            <div className="px-8 pb-4 pt-3 text-center">
              <div className={`text-xs font-semibold uppercase tracking-[0.3em] ${kind.text}`}>
                {kind.label}
                {alert.detail ? ` · ${alert.detail}` : ''}
              </div>
              <div className="mt-1 text-4xl font-bold">
                <Fit>{alert.name}</Fit>
              </div>
              {alert.text ? <div className="mt-2 line-clamp-2 text-base text-slate-300">{alert.text}</div> : null}
            </div>
            {/* What is left of this alert's slot, so a queue reads as a queue. */}
            <div className="h-0.5 bg-white/5">
              <div className={`h-full ${kind.bar} transition-[width] duration-200 ease-linear`} style={{ width: `${left * 100}%` }} />
            </div>
          </div>
        ) : null}
      </Transition>
    </Scene>
  )
}

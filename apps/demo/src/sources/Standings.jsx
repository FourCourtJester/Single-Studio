import { Scene, Toggle, Variable, parseBoard } from '@single-studio/core'
import { useMemo } from 'react'
import { useVelcroValue } from '@single-studio/core'

/**
 * Renders the whole board from one subscription.
 *
 * The operator's Leaderboard control writes a single delimited string, so this
 * reads one path and parses it rather than subscribing to a path per cell.
 */
function Rows() {
  const raw = useVelcroValue('variables.standings', '')
  const rows = useMemo(() => parseBoard(raw, { fields: ['name', 'score'] }), [raw])

  if (!rows.length) return null

  return (
    <ol className="flex w-80 flex-col overflow-hidden rounded-lg bg-slate-950/90 ring-1 ring-white/10">
      {rows.map((row, index) => (
        <li key={index} className="flex items-center gap-3 border-b border-white/5 px-4 py-2 text-white last:border-b-0">
          <span className="w-5 text-right text-sm tabular-nums text-slate-500">{index + 1}</span>
          <span className="grow truncate text-lg font-medium">{row.name}</span>
          <span className="text-lg font-bold tabular-nums text-sky-400">{row.score}</span>
        </li>
      ))}
    </ol>
  )
}

/** Add to OBS as a Browser source pointed at #/source/standings */
export default function Standings() {
  return (
    <Scene className="standings flex items-center justify-end p-12">
      {/* Slides in from the edge it is anchored to. */}
      <Toggle name="standings" transition="slide-left ease-out opaque" style={{ '--ss-shift': '26rem', '--ss-duration': '450ms' }}>
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-300">
            <Variable name="standings.title" fallback="Standings" />
          </h2>
          <Rows />
        </div>
      </Toggle>
    </Scene>
  )
}

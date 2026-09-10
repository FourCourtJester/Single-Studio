import { useVelcroMutate } from '@single-studio/core'
import { Panel } from '@single-studio/core/control'

/**
 * The buttons that do more than one thing.
 *
 * This is the part a form of controls cannot express. Crediting a goal also stops
 * the clock; starting a period also clears it. Written as mutations in
 * src/mutations/show.js and dispatched by name here, so each press is *one* change
 * on air -- two `mutate` calls from one click would be two, and the graphics would
 * show the gap between them.
 */
export default function Actions() {
  const mutate = useVelcroMutate()

  return (
    <Panel title="Match">
      <button
        type="button"
        onClick={() => mutate('demo:goal', { team: 'home' })}
        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
      >
        Home goal
      </button>
      <button
        type="button"
        onClick={() => mutate('demo:goal', { team: 'away' })}
        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
      >
        Away goal
      </button>
      <button
        type="button"
        onClick={() => mutate('demo:period')}
        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
      >
        Next period
      </button>
      <button
        type="button"
        onClick={() => mutate('demo:reset')}
        className="rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500"
      >
        New match
      </button>
    </Panel>
  )
}

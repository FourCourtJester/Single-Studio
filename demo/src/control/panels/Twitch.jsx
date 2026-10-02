import { useVelcroMutate } from '@single-studio/core'
import { Panel, Row } from '@single-studio/core/control'

const PEOPLE = ['Ada', 'Grace', 'Linus', 'Hedy', 'Alan', 'Katherine', 'Margaret', 'Tim']

const pick = (list) => list[Math.floor(Math.random() * list.length)]

/**
 * Made-up Twitch events, through the same mutations real ones use.
 *
 * A visitor to the demo has no channel signed in, and an overlay nobody can see
 * working does not demonstrate much. These put exactly what a real follow or a real
 * message would put on air -- the worker's Twitch handler calls the same mutations
 * -- so what the buttons show is what a channel gets.
 *
 * Emotes are Twitch's own ids: 25 is Kappa and 9 is the heart, both from Twitch's
 * global set, so they load from Twitch like any real message's would.
 */
const MESSAGES = [
  { text: 'gg that was close', fragments: [{ type: 'text', text: 'gg that was close' }] },
  {
    text: 'no way Kappa',
    fragments: [
      { type: 'text', text: 'no way ' },
      { type: 'emote', text: 'Kappa', emote: { id: '25' } },
    ],
  },
  { text: 'first time catching a stream live, love the overlay', fragments: [{ type: 'text', text: 'first time catching a stream live, love the overlay' }] },
  {
    text: 'GL in the next one <3',
    fragments: [
      { type: 'text', text: 'GL in the next one ' },
      { type: 'emote', text: '<3', emote: { id: '9' } },
    ],
  },
  { text: 'who is on the left team?', fragments: [{ type: 'text', text: 'who is on the left team?' }] },
]

const COLOURS = ['#1E90FF', '#FF4500', '#9ACD32', '#8A2BE2', '#DAA520', '#0000FF', '']

export default function TwitchPanel() {
  const mutate = useVelcroMutate()
  const alert = (payload) => mutate('twitch:alert', { name: pick(PEOPLE), ...payload })

  const tries = [
    { label: 'Chat', run: () => mutate('twitch:chat', { name: pick(PEOPLE), colour: pick(COLOURS), ...pick(MESSAGES) }) },
    { label: 'Follow', run: () => alert({ kind: 'follow' }) },
    { label: 'Sub', run: () => alert({ kind: 'subscribe', detail: 'Tier 1' }) },
    { label: 'Resub', run: () => alert({ kind: 'resub', detail: '14 months', text: 'Fourteen months and still the best scoreboard on Twitch' }) },
    { label: 'Gift', run: () => alert({ kind: 'gift', detail: '5 subs' }) },
    { label: 'Cheer', run: () => alert({ kind: 'cheer', detail: '500 bits', text: 'Take my bits' }) },
    { label: 'Raid', run: () => alert({ kind: 'raid', detail: '128 viewers' }) },
  ]

  return (
    <Panel title="Twitch">
      <p className="text-xs text-slate-400">Try the overlay without a channel. Your own: Settings → Plugins → Twitch → Sign in with Twitch.</p>
      {/* Eight buttons as two columns in a dock and four on a wider board: widths
          are twelfths, so half is 6 and a quarter is 3. */}
      <Row>
        {tries.map(({ label, run }) => (
          <button
            key={label}
            type="button"
            data-twitch-try={label.toLowerCase()}
            onClick={run}
            className="col-span-6 rounded-md bg-sky-600 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-sky-500 md:col-span-3"
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => mutate('twitch:clear')}
          className="col-span-6 rounded-md bg-slate-700 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-600 md:col-span-3"
        >
          Clear
        </button>
      </Row>
    </Panel>
  )
}

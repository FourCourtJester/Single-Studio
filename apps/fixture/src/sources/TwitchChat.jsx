import { Scene, Variable } from '@single-studio/core/source'

/** The newest at the bottom, the way every chat window reads. */
const LINES = [4, 3, 2, 1, 0]

/**
 * Add to OBS as a Browser source pointed at #/source/twitch-chat
 *
 * Its own graphic rather than the lower third, which is the operator's: a chat
 * message should never take over a name the board just put on air.
 *
 * The lines cut rather than fade. Every message moves all five down one, and a
 * fade would run on each of them at once, so the whole box would blink per message.
 */
export default function TwitchChat() {
  return (
    <Scene className="flex items-end justify-end p-16">
      <div className="twitch-chat w-full max-w-md overflow-hidden rounded-md bg-slate-950/90 text-white shadow-2xl ring-1 ring-white/10">
        <div className="twitch-alert border-l-4 border-fuchsia-500 px-5 py-3 text-xl font-semibold">
          <Variable name="twitch.alert" fallback="Twitch" transition="slide-up" fit />
        </div>
        <ul className="space-y-1 px-5 py-3 text-lg">
          {LINES.map((line) => (
            <li key={line} className="twitch-line" data-line={line}>
              <Variable name={`twitch.chat.${line}.name`} transition="cut" className="font-semibold text-fuchsia-300" />{' '}
              <Variable name={`twitch.chat.${line}.text`} transition="cut" className="text-slate-200" />
            </li>
          ))}
        </ul>
      </div>
    </Scene>
  )
}

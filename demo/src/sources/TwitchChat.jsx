import { useVelcroList } from '@single-studio/core'
import { Scene } from '@single-studio/core/source'

import { nameColour } from '../components/twitch'
import { Message } from '../components/TwitchMessage'

/**
 * Twitch chat, the last six messages. `#/source/twitch-chat` in OBS.
 *
 * Bottom right, because the rest of the demo already owns the other corners that
 * matter: the scoreboard is top centre and the lower third bottom left, and a chat
 * box over either is the overlay arguing with itself. Same glass panel and sky rule
 * as everything else here, so stacked in one OBS scene it reads as one show.
 *
 * Nothing at all until somebody says something, rather than an empty box waiting.
 */
export default function TwitchChat() {
  const lines = useVelcroList('variables.twitch.chat')

  return (
    <Scene className="flex items-end justify-end p-12">
      {lines.length ? (
        <div className="twitch-chat w-[26rem] overflow-hidden rounded-lg bg-slate-950/90 shadow-2xl ring-1 ring-white/10">
          <div className="h-1 bg-sky-500" />
          <div className="px-5 pt-3 text-[11px] font-medium uppercase tracking-[0.25em] text-sky-400">Chat</div>
          <ul className="flex flex-col gap-1.5 px-5 pb-4 pt-2 text-lg leading-snug text-slate-100">
            {lines.map(([key, line]) => (
              // Keyed by the collection key, so a new message is a new element and
              // gets the entrance; the ones already there stay put.
              <li key={key} className="twitch-line line-clamp-3 break-words">
                <span className="font-semibold" style={{ color: nameColour(line.colour, line.name) }}>
                  {line.name}
                </span>{' '}
                <Message text={line.text} fragments={line.fragments} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Scene>
  )
}

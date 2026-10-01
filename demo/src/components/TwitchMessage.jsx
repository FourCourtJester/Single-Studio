import { useState } from 'react'

/**
 * A message as Twitch split it: text, emotes, mentions.
 *
 * Emotes are why the fragments are kept at all -- a chat overlay that shows "Kappa"
 * where everybody else sees the face is the first thing a streamer notices. They
 * come from Twitch's own image server, by the id Twitch sent.
 */
export function Message({ text, fragments }) {
  if (!fragments?.length) return text ?? ''

  return fragments.map((fragment, at) => {
    if (fragment?.type === 'emote' && fragment.emote?.id) return <Emote key={at} id={fragment.emote.id} text={fragment.text} />

    if (fragment?.type === 'mention') {
      return (
        <span key={at} className="font-semibold text-white">
          {fragment.text}
        </span>
      )
    }

    return <span key={at}>{fragment?.text}</span>
  })
}

/**
 * One emote, or its name if the picture will not load.
 *
 * A broken-image icon with "Kappa" beside it is worse on air than the word alone,
 * and Twitch's image server is a second thing that can be unreachable from a
 * machine that can reach Twitch -- a firewall, a filtered network, a sandbox.
 */
function Emote({ id, text }) {
  const [failed, setFailed] = useState(false)

  if (failed) return <span>{text}</span>

  return (
    <img
      src={`https://static-cdn.jtvnw.net/emoticons/v2/${encodeURIComponent(id)}/default/dark/2.0`}
      alt={text}
      onError={() => setFailed(true)}
      className="mx-0.5 inline-block h-7 w-auto align-middle"
    />
  )
}

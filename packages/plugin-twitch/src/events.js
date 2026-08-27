// Twitch's payloads, turned into something a studio author would have written.
//
// The wire format is snake_case with the broadcaster's name repeated in three
// fields on every event, and a subscription tier of "1000". None of that is wrong,
// and all of it is Twitch's shape rather than a show's. A studio should write
// `onCheer({ bits, from })`, not reach through `event.user_name` and remember that
// anonymous cheers set it to null.
//
// Each of these is a pure function from one payload to one object, which is what
// makes the whole module testable against a recorded sample and nothing else.

/** Twitch sends tiers as "1000" | "2000" | "3000". Nobody says "tier one thousand". */
const tierOf = (raw) => (raw === '2000' ? 2 : raw === '3000' ? 3 : 1)

/**
 * Who did it, in one shape, whoever they are.
 *
 * The prefix is the whole field stem, not a role: chat calls its author
 * `chatter_user_id`, so the prefix is `chatter_user` rather than `chatter`. Getting
 * that wrong reads every field as undefined and puts a nameless chatter on air,
 * which is what happened the first time this was written.
 */
const actor = (event, prefix = 'user') => ({
  id: event?.[`${prefix}_id`] ?? null,
  login: event?.[`${prefix}_login`] ?? null,
  name: event?.[`${prefix}_name`] ?? event?.[`${prefix}_login`] ?? null,
})

/**
 * The subset of `channel.chat.message` a graphic actually shows.
 *
 * `fragments` is kept because it is the only way to render emotes, and a chat
 * overlay that cannot show emotes is not a chat overlay. Everything else about the
 * message -- badges as ids, the source room for shared chat -- stays on `raw`.
 */
const chat = (event) => ({
  id: event?.message_id ?? null,
  text: event?.message?.text ?? '',
  fragments: event?.message?.fragments ?? [],
  from: actor(event, 'chatter_user'),
  colour: event?.color || null,
  badges: (event?.badges ?? []).map((badge) => badge.set_id),
  // A first message from somebody is worth greeting, and it is the sort of thing a
  // studio wants without having to work out what "message_type" means.
  first: event?.message_type === 'user_intro' || Boolean(event?.is_first_message),
  reply: event?.reply ? { to: event.reply.parent_user_name ?? null, text: event.reply.parent_message_body ?? null } : null,
})

const follow = (event) => ({ from: actor(event), at: event?.followed_at ?? null })

const subscribe = (event) => ({
  from: actor(event),
  tier: tierOf(event?.tier),
  gifted: Boolean(event?.is_gift),
})

/** A resub, where the point is the message the viewer wrote with it. */
const resub = (event) => ({
  from: actor(event),
  tier: tierOf(event?.tier),
  months: event?.cumulative_months ?? null,
  streak: event?.streak_months ?? null,
  text: event?.message?.text ?? '',
  fragments: event?.message?.fragments ?? [],
})

const gift = (event) => ({
  // Anonymous gifts arrive with the user fields null rather than absent, which is
  // the one case that will put "null" on air if nobody looks for it.
  from: event?.is_anonymous ? null : actor(event),
  anonymous: Boolean(event?.is_anonymous),
  count: event?.total ?? 1,
  tier: tierOf(event?.tier),
  lifetime: event?.cumulative_total ?? null,
})

const cheer = (event) => ({
  from: event?.is_anonymous ? null : actor(event),
  anonymous: Boolean(event?.is_anonymous),
  bits: event?.bits ?? 0,
  text: event?.message ?? '',
})

const raid = (event) => ({
  from: {
    id: event?.from_broadcaster_user_id ?? null,
    login: event?.from_broadcaster_user_login ?? null,
    name: event?.from_broadcaster_user_name ?? event?.from_broadcaster_user_login ?? null,
  },
  viewers: event?.viewers ?? 0,
})

/**
 * Twitch's subscription type, the event this plugin emits, and how to shape it.
 *
 * Keyed by the wire name so a notification is one lookup, and exported so the
 * plugin can turn it into the subscription requests it has to create -- the same
 * list doing both jobs, rather than two that can disagree.
 */
export const EVENTS = {
  'channel.chat.message': { emit: 'chat', shape: chat, scope: 'user:read:chat' },
  'channel.follow': { emit: 'follow', shape: follow, scope: 'moderator:read:followers', version: '2' },
  'channel.subscribe': { emit: 'subscribe', shape: subscribe, scope: 'channel:read:subscriptions' },
  'channel.subscription.message': { emit: 'resub', shape: resub, scope: 'channel:read:subscriptions' },
  'channel.subscription.gift': { emit: 'gift', shape: gift, scope: 'channel:read:subscriptions' },
  'channel.cheer': { emit: 'cheer', shape: cheer, scope: 'bits:read' },
  'channel.raid': { emit: 'raid', shape: raid, scope: null },
}

/** Every scope the configured events need, deduped. */
export const scopesFor = (types = Object.keys(EVENTS)) => [...new Set(types.map((type) => EVENTS[type]?.scope).filter(Boolean))]

/**
 * Turn one notification into the event a studio hears.
 *
 * Unknown types still come through, under their wire name and unshaped, rather than
 * being dropped: Twitch adds subscription types faster than any plugin tracks them,
 * and a studio that wants a new one should not have to wait for a release.
 *
 * @param {string} type
 * @param {unknown} event
 * @returns {{ name: string, payload: object }}
 */
export function normalise(type, event) {
  const known = EVENTS[type]

  return {
    name: known?.emit ?? type,
    // `raw` on everything, always. The shaped fields are the ones a show usually
    // wants; the escape hatch is what stops a missing field being a blocker.
    payload: { ...(known ? known.shape(event) : {}), raw: event },
  }
}

# Sequence

A graphic that cycles through slides of anything: a sponsor line, a logo beside a
clock, a countdown. `Slideshow` already does this for pictures, all held for the
same time. `Sequence` is the same idea for arbitrary children, each held for as long
as it says.

```jsx
<Sequence>
  <SequenceItem duration={10} transition="slide-up">
    <Variable name="sponsor.line" />
  </SequenceItem>
  <SequenceItem duration={8}>
    <div className="flex gap-2">
      <Image value="asset:logos/main" />
      <Clock />
    </div>
  </SequenceItem>
  <SequenceItem duration="0:15">
    <Timer name="break" />
  </SequenceItem>
</Sequence>
```

The design came out of a conversation in October 2026 that first proposed a
`useSequence` hook, for pieces that build up and stay on screen together (fade in a
logo, slide in two teams, hold, reverse). That is still a real need and is not this.
This came first because the overlay that needed it was a rotation, and a component
that owns its children is the natural shape for one.

## Each item is a Transition

Every `SequenceItem` is a `Transition` whose trigger is "I am the current item". The
current one enters; the one before it exits; the rest rest in `inactive`. That is the
whole animation story -- every variant, `--ss-duration`, `ss-cut`, a studio's own
classes -- and nothing in `Sequence` knows what any of them look like.

The items are stacked in one grid cell, so the box is the size of the largest item
and does not move as the sequence plays, and an outgoing item and an incoming one
occupy the same place.

Contents stay mounted while their item is off, as a `Toggle`'s do, so a clock in an
item that comes round every minute shows the right time when it arrives.

## Duration is time in the active state

An item's `duration` is how long it is the current item: from the moment it starts
entering to the moment it starts leaving. In `Transition`'s terms, the time it holds
`ss-active` -- and the entrance plays inside that, because `ss-active` is the class
whose transition carries it on.

The exit is not counted. It happens while the next item is already current, which
makes the default a cross-fade: one goes as the other comes. A studio that wants one
out before the next comes in delays the entrance in CSS:

```css
.ss-sequence-item.ss-active {
  transition-delay: 300ms;
}
```

The other definition -- duration as the time fully settled on screen, entrance and
exit added either side -- was turned down because the sequence would then have to
read every item's computed animation timing to know where it was. Counting only the
active time makes one loop exactly the sum of the durations, which is what makes the
arithmetic below possible. Timing for the motion stays in the stylesheet, as it is
everywhere else.

## Which item is on is arithmetic, not a timer

The obvious build -- show item 0, set a timeout for its duration, show item 1 -- is a
counter, and a counter belongs to whichever tab is running it. A show has several
copies of a graphic, every timeout in the chain is late by however long its tab was
busy, and the lateness adds up item by item until the copies disagree. A source
reloaded mid-show has no way back in at all.

So `cueAt` in `toolkits/sequence.js` works out the current item from how long the
sequence has been running and the list of durations, and the component only
schedules a re-render for the next boundary. A tab throttled in the background wakes
up on the right item rather than the next one in line.

## What starts it

- **Nothing** (no `name`) -- loops forever, timed from the room clock's epoch, the
  way `Slideshow` is. Every output shows the same item at the same moment, and a
  source reloaded mid-show comes back on the right one. This is the corner overlay.
- **A toggle** (`name="intro"`) -- follows `toggles.intro`. Turning it on plays from
  the first item; turning it off sends the current item out. `loop={false}` holds the
  last item instead of going round again, until the toggle goes off.

### What a toggle-started sequence does not do yet

A toggle stores `true`, not when it was turned on, so each output times the sequence
from the moment it saw the toggle change. Outputs that are open at the time start
together, within the moment it takes a change to reach them, and stay together,
because each one times every item from that same start rather than chaining
timeouts. What does not work is joining late: a browser source reloaded mid-sequence,
or opened after the toggle went on, starts again from the first item.

The fix is for the toggle to store the instant it was turned on -- truthy, so every
`Boolean(value)` reader is unaffected -- and for the sequence to time itself from
that. It was left out of the first version because it changes a stored shape that
plugins, studio mutations and `docs/data.md` all write as `true`, and those would
still need the fallback.

## Not in the first version

- **The scene going live.** obs-browser dispatches `obsSourceActiveChanged` on
  `window` with `event.detail.active` -- active meaning on programme, where
  `obsSourceVisibleChanged` also counts studio mode's preview. That is a per-output
  trigger by nature. Read from obs-browser's README; not yet tried against a real OBS.
- **Events.** An item that holds until something happens rather than for a duration.
  Even an event-driven item needs a timer for when the event never comes, so timed
  came first.
- **Overlap beyond the cross-fade**, and the build-up shape above.

## Rules worth knowing

- **Items are direct children.** `Sequence` reads `duration` off them. An item inside
  a component of your own, or a fragment, is invisible to it.
- **Leave items out only on a shared value.** `{showSponsor && <SequenceItem>}`
  changes the length of the loop. If `showSponsor` is shared, every output changes
  together; if it is local to one page, that page drifts from the rest.
- **A duration of `0` takes an item out of the rotation** without unmounting it.

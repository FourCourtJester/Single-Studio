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
      <Image name="logo" alt="" />
      <Clock />
    </div>
  </SequenceItem>
  <SequenceItem duration={15}>
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

## What an item falls back to

Durations are seconds, numbers only. The sequence's `duration` (8 by default) and
`transition` (`fade` by default) are the last word for its items: a `SequenceItem`'s
own default is `NaN` for `duration` and `null` for `transition`, and either means
"the sequence's". A child that is not a `SequenceItem` takes both.

`NaN` rather than leaving it out, so "say nothing" is a value an item can be given
explicitly. The sequence reads `duration` off its children's props, where
`SequenceItem`'s own default never applies, so it treats an absent one as `NaN` too.
Anything that is not a number, such as an `"m:ss"` string, is `NaN` as well and falls
back, rather than leaving the rotation without a word.

The first draft called these props `every` and `name`, after `Slideshow` and
`Toggle`. They were renamed so that the sequence's `duration` reads as the default
for its items' `duration`, and `toggle` says what it names.

## Which item is on is arithmetic, not a timer

The obvious build -- show item 0, set a timeout for its duration, show item 1 -- is a
counter, and a counter belongs to whichever tab is running it. A show has several
copies of a graphic, every timeout in the chain is late by however long its tab was
busy, and the lateness adds up item by item until copies that started together
disagree.

So `cueAt` in `toolkits/sequence.js` works out the current item from how long the
sequence has been running and the list of durations, and the component only
schedules a re-render for the next boundary. A tab throttled in the background wakes
up on the right item rather than the next one in line.

## What starts it

- **Its `Scene` mounting** (no `toggle`) -- plays from the first item the moment it
  mounts, and goes round and round. That is the "scene goes live" trigger, where the
  scene is the `Scene`, not OBS's programme: a browser source set to _Refresh browser
  when scene becomes active_ remounts it every time the scene is taken. This is the
  corner overlay.
- **A toggle** (`toggle="intro"`) -- follows `toggles.intro`. Turning it on plays from
  the first item; turning it off sends the current item out. `loop={false}` holds the
  last item instead of going round again, until the toggle goes off.

The first build timed a sequence without a toggle from the room clock's epoch, the
way `Slideshow` is, so every output showed the same item and a reload came back on
the right one. It was changed to start from its mount because a sequence is
something that plays from its beginning when it comes up, which the epoch never
gave it: it joined wherever the shared rotation happened to be.

## Each output keeps its own time

A known weakness, and not one we are addressing. Each output times its sequence
from its own start -- its own mount, or the moment it saw the toggle change -- on
its own clock. Outputs that start together stay together, because each times every
item from that one start rather than chaining timeouts. But a browser source
reloaded mid-sequence, or opened after the toggle went on, starts again from the
first item, and two outputs mounted at different times are on different items.

Joining late would need the start stored in the shared state: for a toggle, the
instant it was turned on rather than `true`, which plugins, studio mutations and
`docs/data.md` all write; for a mount, there is no shared moment to store at all.

## Decided against

- **Items that wait for an event.** Items are timed, and only timed. An item that
  holds until something happens is a different component, if it is ever wanted.
- **OBS's own programme signal.** obs-browser dispatches `obsSourceActiveChanged`
  when a source goes on programme. The `Scene` mounting is the trigger instead,
  which works the same in a browser as in OBS, and OBS's refresh-on-active setting
  turns one into the other.

## Not this

- **The build-up shape** -- pieces that come in one after another and stay on screen
  together (fade in a logo, slide in two teams, hold, reverse). That was the
  `useSequence` hook first proposed, and is not a rotation.
- **Overlap beyond the cross-fade.**

## Rules worth knowing

- **Items are direct children.** `Sequence` reads `duration` off them. An item inside
  a component of your own, or a fragment, is invisible to it.
- **Changing the items while it plays jumps.** `{showSponsor && <SequenceItem>}`, or
  a changed duration, changes the length of the loop, and the sequence moves to
  wherever the new durations say it would be by now rather than finishing the item
  on screen.
- **A duration of `0` takes an item out of the rotation** without unmounting it.

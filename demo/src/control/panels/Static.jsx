import { Countdown, CountdownTo, Field, Panel, Stopwatch, Toggle } from '@single-studio/core/control'

/** A clock, and the button that puts it on the card in place of the others. */
function Clock({ name, label, children }) {
  return (
    <div className="flex flex-col gap-2">
      {children}
      {/* `group` makes the three behave as radio buttons: showing one hides the others. */}
      <Toggle name={`static.${name}`} label={label} group="static-clock" />
    </div>
  )
}

/**
 * The full-screen card for before the show and the breaks: a message, one of three
 * clocks, a ticker along the bottom.
 *
 * All three of the framework's clocks, because they answer three different questions
 * an audience asks of a holding card. A countdown is "back in five minutes", a
 * countdown *to* is "we start at 19:30", and a stopwatch is "we have been on a break
 * this long" -- or "the stream has been up this long" before anything has started.
 * Each runs whether or not it is shown, so the next one can be set up while the
 * current one is on air.
 *
 * The backdrop is a slideshow of the image library's `static` group. Drop a folder
 * named `static` on the library and it plays; with nothing there the card is a plain
 * gradient rather than an empty frame.
 */
export default function Static() {
  return (
    <Panel title="Static">
      <Field name="static.message" label="Message" placeholder="Back shortly" />
      <Field name="static.ticker" label="Ticker" placeholder="Scrolls along the bottom. Empty hides it." />

      <Clock name="countdown" label="countdown">
        <Countdown name="static.countdown" label="Back in" />
      </Clock>
      <Clock name="until" label="countdown to">
        <CountdownTo name="static.until" label="Starts at" />
      </Clock>
      <Clock name="stopwatch" label="stopwatch">
        <Stopwatch name="static.stopwatch" label="Running for" />
      </Clock>
    </Panel>
  )
}

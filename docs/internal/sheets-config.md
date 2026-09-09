# The sheet's address belongs to the studio, not the operator

A change made in `SS-BSU-Rocket-League-Esports` and worth taking upstream, because it
is about what a plugin should ask for rather than about one show.

## What it was

`plugin-sheets` put four things on the operator's panel:

| Field | Whose is it, really |
| --- | --- |
| Spreadsheet id | the studio's |
| Range | the studio's |
| API key | the operator's |
| Read every | the operator's |

## Why two of those are wrong to ask

**A range is not a preference.** The studio reading it has code that expects columns
in an order — `teamName` is the first column because the range starts where it does.
Change the range and the graphics do not show a different view of the same data; they
show the wrong column, confidently, with no error anywhere. That is the worst
available failure, and the panel invites it at the worst available moment.

**The id is the same argument one step out.** A studio ships knowing the shape of the
sheet it was written against. Pointing it at a different spreadsheet is not
configuration, it is a different studio.

Both are also *already* decided by the time anybody opens the panel, so offering them
is offering a choice that has been made.

## What it is now

The factory takes them, so the studio declares them where its parsing lives:

```js
// the plugin
export const sheets = (Handler = GoogleSheetsHandler, sheet = {}) =>
  definePlugin({
    …
    create: (context) => {
      const plugin = new GoogleSheets({ ...context, config: { ...context.config, ...sheet } })
      new Handler({ ...context, plugin }).attach(plugin.events)
      return plugin
    },
  })
```

```js
// the studio
plugins: [sheets(MyGoogleSheets, SHEET)]
```

and the panel asks for the API key and the read interval, which really are the
operator's: a credential they hold, and a rate they may want to move.

The help gained a note saying where the sheet comes from, so somebody looking for the
missing fields finds out rather than assuming the plugin is broken.

## Also

`every` now defaults to **10 seconds** rather than 30. Thirty is a long time for a
scoreboard when somebody has just corrected a misspelled name, and Google allows sixty
reads a minute — ten is well inside that, and the floor of five is still the floor.

## While here: what `type: 'secret'` can and cannot promise

Asking for the key on the panel is the right shape, and it fixes the failure that
actually happened. A studio that shipped its key had it compiled into the bundle, and
one such bundle sat on a public `gh-pages` branch for thirteen months. Nothing in the
repository, nothing in the build: that is the whole of the problem worth solving.

What `secret` cannot do is hide it at runtime. The plugin fetches from the browser, so
the key is in the request, in the network tab, on the machine running the board. That
is the operator's own machine and it is not much of a secret from them — but it does
mean the protection is **restriction rather than concealment**, and the help should
lead with that rather than mention it in passing:

- restrict the key to the Sheets API in the Cloud console
- add an HTTP referrer restriction where the studio is served from a known origin
- the sheet is shared read-only to anyone with the link anyway, so the key is not what
  is keeping it private

The current help says the first of those as a closing note. It is the most useful
sentence on the panel and should be the first one.

## The trade, stated

This narrows the plugin. A studio that genuinely wants an operator-selectable
spreadsheet — a league running several fixtures from one board, say — can no longer
have one, and would need the fields put back or exposed some other way.

That case is worth reconsidering if it turns up. It has not, and the failure it guards
against is silent and mid-show, which is the one worth designing against first.

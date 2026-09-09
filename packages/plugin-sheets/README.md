# @single-studio/plugin-sheets

A Google Sheet as a data source for
[Single Studio](https://fourcourtjester.github.io/Single-Studio/) — a standings table,
a roster, a running order — with an API key and no backend.

```bash
npm i @single-studio/plugin-sheets
```

```js
import { sheets, GoogleSheetsHandler } from '@single-studio/plugin-sheets'

// Which sheet, and which cells, are the *studio's* — see below.
const SHEET = { id: '1AbC…', range: 'Standings!A1:D20' }

class MyShow extends GoogleSheetsHandler {
  onRows({ rows }) {
    this.mutate('replace', { prefix: 'standings', members: rows })
  }
}

createVelcroHost({ name: STUDIO_ID, mutations, plugins: [sheets(MyShow, SHEET)] })
```

The first row becomes column names by default, so a heading of `Team Name` reaches
your graphics as `teamName`.

## What the operator sets, and what you set

The operator's board asks for **an API key** and **how often to read**. That is
deliberately all of it.

The **spreadsheet id and range are yours**, passed to the factory. A range is not a
preference: your graphics have code expecting columns in an order, and a range that
does not match does not show a different view of the same data — it shows the wrong
column, confidently, with no error anywhere. Both are also already decided by the time
anyone opens the panel, so offering them is offering a choice that has been made.

## The key

Share the sheet as **anyone with the link can view**, then create an API key with the
Sheets API enabled.

`type: 'secret'` masks the field on the board. It does not hide the key at runtime —
the request is made from the browser, so it is in the network tab of the machine
running the board. The protection is **restriction, not concealment**: limit the key
to the Sheets API in the Cloud console, and add an HTTP referrer restriction where the
studio is served from a known origin.

What it does solve is the failure that actually happens — a key compiled into a bundle
and sitting on a public `gh-pages` branch for a year.

## Reading

Only one machine in a room polls, and an unchanged answer says nothing at all — so a
read that finds no change costs one request and no document write. Five seconds is the
floor, whatever is typed; Google allows sixty reads a minute.

A refusal stops rather than retrying, because a private sheet stays private however
many times it is asked. A dropped network retries, because that is what backoff is
for.

## Licence

MIT.

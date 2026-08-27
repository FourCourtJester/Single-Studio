# Google Sheets

The one production teams actually ask for. A spreadsheet is the tool they already
have and already know: the roster, the running order, the standings, the
lower-third copy for the night. Somebody who will never open a code editor keeps a
sheet up to date happily, and it is collaborative for free.

## No backend, and this time it is straightforward

A sheet shared as **"anyone with the link can view"** is readable with an **API
key**, over CORS, from a browser. No OAuth, no consent screen, no token to refresh,
nothing to deploy.

```
GET https://sheets.googleapis.com/v4/spreadsheets/{id}/values/{range}?key={key}
```

An API key is not a secret in the way a client secret is — it is restrictable by
HTTP referrer, and it grants only what the sheet's own sharing already grants. It
still lives in the settings database rather than the build, because it is the
operator's key and not the studio author's.

`FORMATTED_VALUE`, not `UNFORMATTED_VALUE`. The unformatted form hands back serial
dates and bare numbers; what an operator typed in the cell is what they expect on
air, currency symbols and all.

## It does not push, and everything follows from that

There is no socket and no notification. The plugin asks on a timer, so the design
is about asking as rarely as possible and saying nothing when the answer has not
changed.

**Ownership matters more here than anywhere else.** Five operators each polling the
same sheet is five times the quota and five writers racing on the same paths, for
one sheet's worth of information. `Service`'s predicate answers it: one machine
asks, everybody else reads the replicated result. This is the case its comments were
written about.

**Unchanged reads say nothing.** The parse is compared with the last one, so a read
that finds no edit costs one request and nothing else — no event, no mutation, no
replication, no re-render. That is what makes a thirty-second poll affordable.

**Five seconds is the floor**, whatever is typed. Google allows sixty reads a minute
per user; a typo of `1` spends that in a minute and gets the key rate limited
mid-show.

## Three shapes of trouble, told apart

They are told apart because the fixes are completely different, and Google's own
messages are accurate and useless at the moment something breaks on a show.

| What happened          | What the operator is told                              | What the plugin does  |
| ---------------------- | ------------------------------------------------------ | --------------------- |
| Sheet is private (403) | It has to be shared as "anyone with the link can view" | Stops                 |
| Key refused (403)      | Check the key, and that the Sheets API is on           | Stops                 |
| Wrong id (404)         | No spreadsheet with that id                            | Stops                 |
| Bad range (400)        | Use A1 notation, like `Standings!A1:D20`               | Stops                 |
| Rate limited (429)     | Poll less often                                        | Stops                 |
| Network dropped        | —                                                      | Backs off and retries |

A refusal is not something a retry fixes: a private sheet stays private however many
times it is asked, and retrying only spends quota to be refused again. A dropped
network is the opposite, and `Service`'s backoff handles it.

## Two things about the data that bite

**The API omits trailing empty cells rather than padding them.** A row whose last
two columns are blank comes back short, so reading by index silently shifts every
value left of a gap. Rows are padded to the widest row before anything else touches
them.

**People leave blank rows in sheets as spacers.** Emitting one puts an empty name on
air, so entirely-blank rows are dropped.

Headings become keys somebody would type — `Team Name` is `teamName` — because a
graphic writing `row['Team Name']` breaks the day somebody tidies the
capitalisation. An unnamed column gets `column3` rather than colliding on `''`.

## Tested

28 tests: parsing, key naming, change detection, URL building, error explanation,
and the polling itself against a stubbed `fetch` — including that an unchanged sheet
emits nothing, that the floor holds, that a non-owner never polls, and that a
refusal stops while a dropped network retries.

Not tested: a real spreadsheet. The shapes come from Google's documented response
format, and the first real key is the first real proof.

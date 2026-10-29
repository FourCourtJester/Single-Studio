# NGS

The Nexus Gaming Series, the amateur Heroes of the Storm league, as a data source:
teams, logos, rosters, the schedule, results and standings. What follows was read from
the league's own source, [nexusgamingseries/ngs-mean-core] on the `development`
branch at `5ef0ef6` (2026-10-26) — its `docs/API/*.txt` and the Express routes and
Mongoose models behind them. **Nothing here has been checked against a live
response.** The container this was written in could not reach the league's host;
the owner confirmed on 2026-10-29 that the API answers a plain `curl` from their own
machine.

[nexusgamingseries/ngs-mean-core]: https://github.com/nexusgamingseries/ngs-mean-core/tree/development/docs/API

## It is open, and a browser may read it

Every read a broadcast wants is marked `Auth: Open` — no key, no login. The ones
behind a login are writes (reporting, scheduling, casters signing up) and a few bulk
queries, none of which a show needs.

`server.js` sets `Access-Control-Allow-Origin: *` on every request, before the routes,
and allows `Content-Type`. So unlike the shape [next.md](next.md) feared, a studio on
GitHub Pages can read it straight from the worker, with no relay route, the way
`plugin-sheets` reads Google. Unverified: whether a JSON `POST`'s preflight
`OPTIONS` gets a 2xx. No route declares `OPTIONS`; Express answers it for any path
with a matching route, and the headers are already set by then, so it should.

That makes it the shape of `plugin-sheets`: a poller, one machine in the room asking,
an unchanged answer saying nothing.

## The base, and the envelope

`https://www.nexusgamingseries.org/api/…`. GET routes read their parameters from the
query string, POST routes from a JSON body (`commonResponseHandler.js`). A success is
wrapped:

```json
{ "message": "…", "route": "/api/…", "returnObject": … }
```

so the payload is always `returnObject`. An error has `err` instead, and the HTTP
status says which.

## What a show reads

| Route                                 | Method | Takes                               | Gives                                      |
| ------------------------------------- | ------ | ----------------------------------- | ------------------------------------------ |
| `admin/getSeasonInfo`                 | GET    | `season`, optional                  | the current season; despite `admin/`, open |
| `division/get/all`                    | GET    | —                                   | every division                             |
| `team/get`                            | GET    | `team` (name), `id` or `ticker`     | one team                                   |
| `team/fetch/teams`                    | POST   | `teams`, `teamIds` or `teamTickers` | several teams                              |
| `schedule/fetch/match`                | POST   | `matchId`                           | one match                                  |
| `schedule/fetch/matches`              | POST   | `season`, `round`, `division`       | a division's round                         |
| `schedule/get/matches/scheduled`      | GET    | `season`                            | every scheduled match in a season          |
| `schedule/get/matches/casted/playing` | GET    | —                                   | matches being cast right now               |
| `schedule/fetch/matchup/history`      | POST   | `teamAid`, `teamBid`                | every meeting of the two teams             |
| `standings/fetch/division`            | POST   | `season`, `pastSeason`, `division`  | a division's standings, sorted             |

`division` is the `divisionConcat` — the system name, not the display name.

## The shapes

**A match** (`match-model.js`): `matchId`, `season`, `divisionConcat`, `round`,
`home` and `away` as `{ id, teamName, score, dominator }`, `scheduledTime` as
`{ startTime, endTime }`, `casterName`, `casterUrl`, `reported`, `forfeit`, `boX`
(best of; 3 by default), `vodLinks`, `mapBans`. Tournament matches add `type`,
`parentId` and the Challonge references. The scores are maps won, which is what a
scoreboard wants.

**A team** (`team-models.js`): `teamName`, `ticker` (the short name), `logo`,
`divisionConcat`, `captain`, `teamMembers` as small user objects.

**A standing** (`standings-methods.js`): per team `id`, `teamName`, `points`, `wins`
and `losses` (maps, not matches), `dominations`, `matchesPlayed`. Sorted by the
league's own tiebreaks — points, then head to head, then map differential — so the
plugin keeps the order rather than re-sorting. Cup divisions are a different, smaller
shape: `{ teamName, id, points }` from tournament placings.

**A logo** is a key, not a URL. The site's client builds it
(`team.service.ts`, `imageFQDN`) as `https://s3.amazonaws.com/ngs-image-storage/`
plus the key, URI-encoded, falling back to `defaultTeamLogo.png`; a past season's
logo lives in `ngs-archive-image` instead. A key that already starts with
`https://s3.amazonaws.com/` is used as is.

## The operator action this suggests

Pick a match by its `matchId`, and everything follows: `schedule/fetch/match` gives
both team ids, the score and the casters; `team/fetch/teams` gives names, tickers,
logos and rosters; `standings/fetch/division` with the match's `season` and
`divisionConcat` gives the table both sides sit in. Three requests, and only the
match needs polling during a broadcast — the score changes when a result is
reported, the rest does not change mid-show.

`schedule/get/matches/casted/playing` is the candidate for picking the match
automatically, or for a short list the board offers rather than a typed id. It is
narrower than its name: matches with a `casterUrl` whose scheduled window contains
now, at most five, cached server-side. It compares `scheduledTime` with
`Date.now()`, so the times are likely epoch milliseconds, though the schema declares
strings.

## Open, and checkable only against the live API

- The real `returnObject` of each route above — especially `standings`, which may be
  an array or an object around one, and `getSeasonInfo`, whose season number the
  code reads as `.value`.
- Whether the score of a match in progress is updated before it is reported, or only
  at reporting. If only at reporting, the plugin is not a live scoreboard and the
  operator keeps the score by hand during the series.
- The preflight, above.
- Rate limits. None in the code; the owner of the site is a volunteer league, so the
  floor should be generous anyway.

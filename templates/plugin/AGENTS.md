# Working on this plugin

For anyone — person or agent — building a Single Studio plugin from this template.

## What a plugin is, and what it deliberately is not

A plugin brings the outside world in — a game, a spreadsheet, a scoring service — and
**emits events**. It does not write to anybody's show.

That single rule decides three things at once. A plugin installed from npm has no
authority over a broadcast, so nobody has to audit a dependency for it. It imposes no
vocabulary, so a studio that already calls things `home.score` keeps calling them
that. And it is testable with no store at all: feed the parser a frame, assert on the
event.

The studio author writes what a goal _means_ to their graphics. You write what
arrived.

## First job: pick a shape and delete the other

`src/index.js` ships two classes. Keep one.

|                     |                                                                  |
| ------------------- | ---------------------------------------------------------------- |
| **`ExampleSocket`** | for something that **tells** you — a game, OBS, a chat service   |
| **`ExamplePoller`** | for something that must be **asked** — a spreadsheet, a REST API |

If the far end offers both, take the socket: a poll that finds nothing still costs a
request, and a socket that says nothing costs nothing.

Then delete the other class, its tests in `test/plugin.test.js`, and whichever of
`SocketService`/`PollingService` is now unused from the import.

Both shapes emit the same events from the same table. That is worth noticing before
you delete one: the shape is an implementation detail, and `src/events.js` is the
contract a studio writes against.

## The order to build it in

1. **`src/events.js` first**, before anything connects. This is where a plugin's bugs
   actually live — a wrong field name is a graphic reading `undefined` for a whole
   broadcast, with nothing to see and nothing to log. It needs no network and no
   fake, so it is the cheapest useful thing you can write.
2. **The service.** `url` and `receive` for a socket; `read` and `fatal` for a poller.
3. **`handles` and the no-op methods**, one per event.
4. **`config` and `help`**, which is what an operator actually sees.

## What belongs on the operator's panel

The test is: **is it a fact about this computer, or about this show?**

A port number chosen by whoever runs the game is theirs — panel. A spreadsheet range
that your graphics expect columns in is the studio's; putting it on the panel invites
somebody to change it mid-show and see the wrong column with no error anywhere. Take
those as arguments to the factory instead.

`type: 'secret'` masks a field. It does **not** hide it at runtime — the request is
made from a browser, so the value is in the network tab of the machine running the
board. It is restriction, not concealment. Say so in the `help`, and lead with how to
restrict the credential rather than mentioning it in passing.

## Testing

```bash
npm install
npm test
npm run lint
```

`.github/workflows/test.yml` runs all three on every push and pull request, and a
`npm pack --dry-run` so the log shows exactly what a studio would install.

`@single-studio/core/testing` gives you `FakeSocket` and `fakeSockets()`. Subclass the
fake to add your protocol's own shorthand — see `ExampleFeed` in the tests.

**Make the fake exactly as awkward as the wire.** The most expensive bug this
framework has had was a fake that was tidier than the game: Rocket League nests a JSON
_string_ inside its frame, the fake passed an object, and every field read `undefined`
while the suite stayed green for weeks. Making the fake faithful turned seven passing
tests red at once. A fake that is easier to write than the protocol is a fake that is
lying to you.

**Negative-test every check you add.** Break the code it is meant to catch, watch it
go red, put the code back. A check that cannot fail reads exactly like coverage and
is worse than nothing.

## Publishing

This ships **source**, not a build — a studio's bundler compiles it, so there is no
build step, no `dist`, and no bundler config to keep working.

**Push a version tag and `.github/workflows/publish.yml` publishes it:**
`git tag v0.1.0 && git push --tags`. It refuses when the tag is not the version in
`package.json`, when the package is still named `single-studio-plugin-example`, and
when `repository.url` does not name your repository; then it runs the tests and lint,
and publishes with provenance. It does nothing in the template's own repository.

The first publish of a new name needs a token: npm can only attach a trusted
publisher to a package that already exists. Add an `NPM_TOKEN` secret — a granular
token with read and write, and **Bypass 2FA on**, or the publish uploads and then
stops asking for a code a runner cannot give. Once it is published, add your
repository as the package's trusted publisher on npmjs.com, **opt it into `npm
publish`** (new ones only allow `npm stage publish`), and delete the secret.

Four things that will bite:

- **`@single-studio/core` must stay a `peerDependency`.** If it is a normal
  dependency, npm is free to install a second copy — and two copies of the framework
  in one worker means two document registries. The plugin connects, emits, and
  nothing reaches the show. It fails silently, which is the worst way for it to fail.
- **The peer range is `>=0.15.0 <1.0.0`, and keep it that shape.** Below 1.0.0 a
  caret pins the _minor_: `^0.15.0` admits 0.15.x and refuses 0.16.0, so every core
  release would put your plugin in a peer conflict — which npm refuses by default —
  until you republished. Single Studio's own plugins never meet this, because they
  release in lockstep with core; yours does not. The dev dependency stays a caret:
  it is what your tests run against, and bumping it is how you test a new core.
  Raise the floor when you start using something a newer core added.
- **Relative imports need their `.js`.** Your source is resolved by Node, not by a
  bundler, so `from './events'` throws `ERR_MODULE_NOT_FOUND` on install where
  `from './events.js'` works — and the tests cannot tell you, because Vitest
  resolves either. `npm run lint` refuses the extensionless form in `src/`.
- **`repository` must name your repository.** npm compares it against the repository
  that built the tarball and refuses a provenance publish outright — `422 ...
"repository.url" is "", expected to match ...`. `package.json` here says
  `YOUR-NAME/YOUR-REPO`; change it. The publish workflow checks it before uploading.

Before the first publish: `npm pack` and look inside the tarball. npm refuses to
unpublish after 72 hours.

Decide the licence while you are there. The template ships the Unlicense, which is
what makes the starter code free for you to take -- nobody's copyright follows it
into your repository. But once the code is yours, that file is dedicating _your_
plugin to the public domain, and publishing is not the moment to discover you did
that by default. Replace `LICENSE` with whatever you want -- MIT is the usual answer
-- and set `license` in `package.json` to match.

Watch the spelling if you go proprietary: npm's `UNLICENSED` means "you may not use
this" and SPDX's `Unlicense` means "this belongs to everybody". One letter, opposite
meanings.

## Naming

The npm package name is yours — `single-studio-plugin-<thing>`, or your own scope.
`@single-studio/` is not available to you and nothing requires it.

The `name` inside `definePlugin` is different and unrelated: it is what a studio
addresses the plugin by (`ctx.ask('example', …)`) and the key its settings are stored
under. Keep it short, lowercase, and no scope.

## Where the answers are

- [Plugins](https://fourcourtjester.github.io/Single-Studio/plugins) — the full guide, both base classes, and what a handler is given
- [Your own data](https://fourcourtjester.github.io/Single-Studio/data) — what a studio does with your events

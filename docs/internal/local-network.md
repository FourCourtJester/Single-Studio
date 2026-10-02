# Local Network Access

Chrome's rule that a page on a public site may not reach this computer or its
network without the user's permission, and what the framework does about it.

## What happened

October 2026, testing Single-Studio-GameState: the Rocket League plugin, in a studio
on GitHub Pages, pointed at `ws://localhost:47600`. The worker's console said
`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`, and no prompt ever appeared. Allowing
the site for "local network" in Chrome's site settings did not help.

## What is true (Chrome 154.0.8037.58, checked by hand)

- **There are two permissions, not one.** Chrome split it: one for the network the
  computer is on, one for the computer itself. Version 154's settings call the
  second **App devices**. Allowing the first left `localhost` blocked; allowing
  App devices let the connection through.
- **A WebSocket never prompts.** It fails. That is Chrome's stated design.
- **A worker cannot prompt.** Plugins run in a SharedWorker, so they could never
  have asked.
- **The worker inherits the site's permission.** Once the site was allowed, the
  SharedWorker's socket connected.
- **A plain request from a page does prompt.** `fetch('http://localhost:47600/',
{ mode: 'no-cors' })` from the board's console brought up "access other apps and
  services on this device", although that port speaks WebSocket.
- **Chrome 154 knows all three permission names.** `loopback-network`,
  `local-network` and `local-network-access` each answered `prompt` from the
  board's console before anything was allowed, so the board's first choice for
  this computer, `loopback-network`, is one 154 recognises. Chromium 141, the one
  the end-to-end suite runs, knows only `local-network-access`, and reports it as
  `prompt` although 141 does not enforce it. So 141 shows the notice for a plugin
  that is down for other reasons, and Allow is then harmless. The check, for the
  next version that renames something:

  ```js
  for (const name of ['loopback-network', 'local-network', 'local-network-access'])
    navigator.permissions.query({ name }).then(
      (s) => console.log(name, s.state),
      () => console.log(name, 'unknown'),
    )
  ```

- **OBS does not enforce it, today.** OBS's browser sources and docks run its own
  Chromium, which was 127 when checked -- fifteen versions before enforcement began
  in 142, so a studio on the web should reach `localhost` from inside OBS with no
  prompt and no permission. That is read off the version, not watched happen. It
  changes the day OBS ships a Chromium of 142 or later, and the
  notice and Allow will not help there: a browser source has no address bar, no
  site settings and nobody to click a prompt.

## What the framework does

- The worker reports each plugin's address in the manifest.
- The board works out whether reaching it is a step inwards from where the page is
  served (`toolkits/network.js`), and asks the browser for the permission's state.
  A browser that knows none of the permission names gates nothing, so says nothing.
- If the plugin is not connected and the state is `prompt` or `denied`, the row
  says the browser is blocking it. `prompt` gets an **Allow** button that makes the
  plain request above; `denied` gets directions to site settings, since the browser
  will not ask twice.
- Every plugin now retries at most every ten seconds rather than thirty, with up
  to a quarter taken off at random. Measured before: 29 seconds from a stats port
  coming back to "Connected".

## Not verified

- **The end-to-end test stands in for an enforcing browser.** It serves the fixture
  as `studio.test` and supplies the permission's answer; what it proves is the
  board's decision and the request it makes, not Chrome's side.

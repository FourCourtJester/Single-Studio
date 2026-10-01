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

## What the framework does

- The worker reports each plugin's address in the manifest.
- The board works out whether reaching it is a step inwards from where the page is
  served (`toolkits/network.js`), and asks the browser for the permission's state.
  A browser that knows none of the permission names gates nothing, so says nothing.
- If the plugin is not connected and the state is `prompt` or `denied`, the row
  says the browser is blocking it. `prompt` gets an **Allow** button that makes the
  plain request above; `denied` gets directions to site settings, since the browser
  will not ask twice.
- A socket to a local address retries at most every five seconds rather than
  thirty. Measured before: 29 seconds from the stats port coming back to
  "Connected".

## Not verified

- **The permission names in Chrome 154.** The board asks `loopback-network`, then
  `local-network-access` (or `local-network` first, for the home network).
  Chromium 141, the one the end-to-end suite runs, knows only
  `local-network-access`, and reports it as `prompt` although 141 does not
  enforce it. So 141 shows the notice for a plugin that is down for other reasons,
  and Allow is then harmless. One line in Chrome 154's console settles the names:

  ```js
  for (const name of ['loopback-network', 'local-network', 'local-network-access'])
    navigator.permissions.query({ name }).then(
      (s) => console.log(name, s.state),
      () => console.log(name, 'unknown'),
    )
  ```

- **OBS docks.** Whether OBS's built-in browser enforces this depends on the
  Chromium version it ships. Not checked.
- **The end-to-end test stands in for an enforcing browser.** It serves the fixture
  as `studio.test` and supplies the permission's answer; what it proves is the
  board's decision and the request it makes, not Chrome's side.

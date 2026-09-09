# Releasing 0.6.0 — what is left, in order

Everything mechanical is done and verified. What remains needs npm credentials,
which is why it is written down rather than done.

Delete this file once 0.6.0 is out.

## The state of things

|                                 |                                                                       |
| ------------------------------- | --------------------------------------------------------------------- |
| `main`                          | carries 0.6.0 across all six packages, and both templates             |
| Release run #18                 | green on all three jobs, against this exact commit                    |
| `TEMPLATE_DEPLOY_KEY`           | proven: pushed a scratch tag to the studio mirror and deleted it      |
| `PLUGIN_TEMPLATE_DEPLOY_KEY`    | proven the same way                                                   |
| `Single-Studio-Plugin-Template` | exists, and is **empty** — see below                                  |
| npm                             | nothing published yet; `core` and `provider-supabase` are still 0.5.0 |

The plugin mirror is empty on purpose. `Commit, push, and tag` in the template job
is gated on `refs/tags/`, so a branch dispatch only ever proves the key can write.
Both mirrors populate when the tag goes out.

## Do this

### 1. A token, because trusted publishing cannot bootstrap a name

npm attaches a trusted publisher to a package that already **exists**. `plugin-obs`,
`plugin-sheets`, `plugin-twitch` and `plugin-rocket-league` have never existed, so
there is nothing for OIDC to authenticate against and the first publish of each has
to carry a token.

[npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens) → **Granular
Access Token**:

- read **and write**
- scoped to the `@single-studio` organisation
- **Bypass 2FA — on**

That last box is the one people miss, and missing it fails late and confusingly: the
publish authenticates, uploads, prints the entire tarball manifest, and _then_ stops
on `EOTP`, asking for a code from an authenticator that a runner has no way to
answer. It reads like an auth failure and is the opposite one. The setting cannot be
changed on an existing token — make a new one.

Add it to `Single-Studio` → Settings → Secrets and variables → **Actions** →
`NPM_TOKEN`.

### 2. Tag

```bash
git checkout main && git pull
git tag v0.6.0 && git push origin v0.6.0
```

The tag has to be exactly `v0.6.0`. The check compares it against **all six**
package versions and refuses before anything ships if any disagrees — which is the
point, but it does mean a typo fails the release rather than half-doing it.

What the run then does:

1. lint, 755 tests, build, `verify:template` across six tarballs and both templates
2. publishes all six with the token — a notice in the log says it used one
3. syncs both template mirrors, commits, and tags them `v0.6.0`

### 3. Afterwards, in this order

1. **Configure trusted publishing** on npm for the four new packages. Settings →
   the package → Publishing access → GitHub Actions, repository
   `FourCourtJester/Single-Studio`, workflow `release.yml`.
2. **Delete `NPM_TOKEN`.** With it gone the workflow returns to the tokenless path
   with no other change, and there is no long-lived publish credential sitting in
   the repository.

Do them in that order. Deleting the token before the trusted publishers exist leaves
the next release with no way to authenticate at all.

### 4. Then the studio

Point the one existing studio at `@single-studio/core@^0.6.0` and the plugins it
uses, and read the 0.6.0 changelog before you do — it is mostly behavioural, and
three entries change something a studio can see:

- `ResetButton` and `SwapButton` **ask before acting**; `confirm={false}` restores the
  old single press
- `Variable`, `Timer` and `Clock` render a `<span>` rather than a `<div>`
- `fit` now actually works, which means text that was silently overflowing will
  start shrinking — check anything using it at 1920×1080

## If something goes wrong

**The publish loop runs under `bash -e`**, so the first refusal stops it with
everything before it already on the registry. Those versions cannot be republished.
Getting out of that means bumping to `0.6.1`, not retrying.

The most likely refusal is a missing or wrong `NPM_TOKEN`, which is why step 1 is
step 1.

## Still true, and not blocking

- `plugin-sheets` has never run against the real Google API.
- `plugin-rocket-league`'s `static commands` is empty — the v2.72 wire names are
  unconfirmed.

Both are going out at the same version as the framework, which implies a maturity
they do not quite have. Worth a line in each README if that bothers you; it is not a
reason to hold the release.

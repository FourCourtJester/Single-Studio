# Releasing

Two packages go to npm: `@single-studio/core` and `@single-studio/provider-supabase`.
`@single-studio/relay` is `private: true` and stays out of it — it is a thing you
deploy, not a thing you install.

## The thing that surprises everyone

**You do not register a package.** There is no form, no reservation, no CLI command
that claims a name. The first `npm publish` creates the package, and from then on
that name is yours. Names are first-come and cannot be transferred away from you.

What you _do_ create ahead of time is the **scope**. `@single-studio/core` lives
under the `@single-studio` scope, and a scope is either a username or an
organisation — so `single-studio` has to exist as an npm organisation before
anything can be published under it. That part is a form, on the website.

## First time only

1. **Account** — sign up at [npmjs.com](https://www.npmjs.com/signup), verify the
   email, turn on 2FA. Publishing requires it.
2. **Organisation** — [npmjs.com/org/create](https://www.npmjs.com/org/create), name
   it `single-studio`, free plan. The free plan publishes unlimited _public_
   packages; it only charges for private ones, and these are public.
3. **A token** — [npmjs.com/settings/~/tokens](https://www.npmjs.com/settings/~/tokens)
   → **Granular Access Token**, read and write, scoped to the `@single-studio`
   organisation, **Bypass 2FA** on so it can run unattended. Write tokens cap at 90
   days, which is fine: this one is scaffolding.

   Classic tokens are not an option and are not hiding somewhere in the UI. npm
   revoked every one of them in November 2025 and disabled creating more.

   **Bypass 2FA is the box people miss**, and missing it fails late and confusingly:
   the publish authenticates, uploads, prints the whole tarball manifest, and then
   stops on `EOTP` — a request for a code from your authenticator that a runner has
   no way to answer. It reads like an auth failure and is the opposite one. The
   setting cannot be changed on an existing token; make a new one.

   It is also the reason the token is temporary rather than permanent. Since August
   2026 a bypass-2FA token can no longer manage the account, and from around January
   2027 it will not publish directly at all — npm is moving everybody to trusted
   publishing, which is where this goes as soon as the packages exist.

4. **Publish.** From CI: add the token as the `NPM_TOKEN` repository secret, then
   `git tag v0.1.0 && git push --tags`, same as every release after it.

   Or from a laptop, if you would rather watch the first one go. Note there is no
   `npm login` step — writing the token into `.npmrc` is the same credential with
   less ceremony:

   ```bash
   npm config set //registry.npmjs.org/:_authToken=<token>
   pnpm install
   pnpm verify:template          # the rehearsal — see below
   pnpm -r --filter "./packages/*" publish --access public
   ```

   `--access public` matters: **scoped packages default to private**, and without it
   a free account gets a permission error rather than a package. It is also in each
   package's `publishConfig`, so this is belt and braces.

   `prepack` on `packages/core` builds `dist` first, so there is no separate build
   step and no way to ship a stale one.

The first publish is the one that cannot use OIDC: npm requires a package to _exist_
before a trusted publisher can be attached to it. It can still come from CI — a
token works anywhere — it just cannot be tokenless. That is the whole reason the
token above exists, and the reason to delete it afterwards.

### If `npm login` says there is no BROWSER

Then skip it. The `npm config set` above writes the same credential the login flow
would, and is the better answer on a devcontainer or any headless box —
`npm login` now hands out a two-hour session rather than a lasting token, so it is
the _more_ fiddly path, not the less.

If you want it anyway: the web flow shells out to `$BROWSER`, so `BROWSER=echo npm
login` prints the URL rather than trying to open it, and you finish signing in in
whatever browser you already have.

## Every release after that

Bump both packages to the same version, commit, tag, push:

```bash
git tag v0.2.0 && git push --tags
```

`.github/workflows/release.yml` lints, tests, builds, checks the tag against both
manifests, rehearses the publish against the starter template, and publishes.

Running that workflow **by hand publishes nothing** — every publishing step is gated
on the ref being a tag — so a manual run is a free rehearsal of a version you cannot
take back.

### Why the tag is checked against the manifests

Six lines to prevent a tarball published under a version number nobody can find the
source for. npm does not let you take a version back: `npm unpublish` is refused
after 72 hours, and even inside that window it burns the version number forever.

## The rehearsal

`pnpm verify:template` packs both packages exactly as `npm publish` would, copies
`templates/studio` somewhere clean, points it at the tarballs and builds it with no
workspace to fall back on.

It exists because the demo cannot answer the question. The demo resolves the
framework through `workspace:*`, which reaches the whole package directory
regardless of what `files` says — so it would keep building for years after `dist`
fell out of the published tarball, and the first person to find out would be the
first person to start a project.

## Worth doing once the packages exist: trusted publishing

npm can authenticate a publish from GitHub Actions over OIDC instead of a stored
token — short-lived credentials scoped to one workflow, nothing to rotate, nothing
to leak, and provenance attached automatically. Configure it per package under
**Settings → Trusted Publisher** on npmjs.com (or `npm trust` for both at once),
pointing at this repository and `release.yml`.

Configure it **per package** — there is no repository-wide switch, so both
`@single-studio/core` and `@single-studio/provider-supabase` need their own entry
naming this repository and `release.yml`. A package without one fails the publish on
authentication, and the fix is that settings page rather than anything in the
workflow.

Once both are configured, the token is dead weight: delete the `NPM_TOKEN` secret
and revoke the token on npm. `release.yml` already carries no reference to either.

**Order matters here and is easy to get backwards.** Configure the publishers, then
merge the tokenless workflow, then tag. Deleting the secret while the workflow still
expects one leaves the next release failing on a credential nobody meant to remove.

### The publish uses `npm`, not `pnpm`

Trusted publishing is npm's feature and the npm CLI is where it is implemented.
pnpm 10.33 does not perform the OIDC exchange at all — it looks for a token, finds
none, and stops on `ENEEDAUTH` without ever mentioning OIDC, which reads exactly
like a missing credential and is not one.

The workflow also upgrades npm before publishing, because Node 22 ships npm 10 and
OIDC publishing needs 11.5.1 or newer. pnpm still owns install and build; this is
only about who talks to the registry.

## Provenance needs a public repository

npm can attach a signed statement linking a tarball back to the commit and workflow
that built it — but only when the **source repository is public**. A private one is
refused outright:

```
422 Unsupported GitHub Actions source repository visibility: "private".
Only public source repositories are supported when publishing with provenance.
```

So `release.yml` asks for provenance only when the repository is public, and warns
in the run when it cannot. Nothing has to be remembered: the day this repository
goes public, releases start being signed on their own.

Worth knowing while it stays private: the published packages are public and their
`repository` field points at a URL that nobody outside the repo can open. That is
not broken, but it is a dead link on two public npm pages, and anybody evaluating
the package cannot read the source before installing it.

## Versioning

Both packages move together and share a version. They are two halves of one release
— the provider imports nothing from core, but a studio installs both and a mismatch
is a debugging session nobody signed up for. Independent versioning buys flexibility
nobody has asked for and costs a compatibility matrix.

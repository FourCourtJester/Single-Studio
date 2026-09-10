# Releasing

Six packages go to npm, in `PACKAGES` in `.github/workflows/release.yml`:

|                                                                     |                                         |
| ------------------------------------------------------------------- | --------------------------------------- |
| `@single-studio/core`                                               | the framework                           |
| `@single-studio/provider-supabase`                                  | one of the two ways a show collaborates |
| `@single-studio/plugin-obs`, `-sheets`, `-twitch`, `-rocket-league` | the first-party plugins                 |

`@single-studio/relay` is `private: true` and stays out of it — it is a thing you
deploy, not a thing you install.

**All six share one version**, and the tag is checked against every one of them
before anything publishes. That is deliberate rather than tidy: a plugin names core
as a peer, so its range has to name a version that exists, and four ranges maintained
separately are four chances for one to name a version that was never published —
which npm reports at somebody else's install, not at ours. Lockstep costs a version
bump on a package that did not change.

**A plugin ships its source, not a build.** Which means Node's own resolver reads it
rather than a bundler, and every relative import needs its `.js`. All four packed
cleanly, installed cleanly and threw on first import the day they were made
publishable; `verify:template` now installs and imports every package for exactly
this reason.

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

Bump every published package to the same version — all six, not just the ones you
changed — then commit, tag, push:

```bash
git tag v0.2.0 && git push --tags
```

`.github/workflows/release.yml` lints, tests, builds, checks the tag against every
manifest in `PACKAGES`, rehearses the publish against the starter template, and
publishes.

A package you did not touch still has to move. The tag check compares the tag to all
six and fails on the first mismatch, so bumping only what changed does not produce a
narrower release — it produces no release at all.

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

## Introducing a package name that has never been published

The first publish of a name cannot use OIDC — npm requires a package to _exist_
before a trusted publisher can be attached to it — so a release that introduces a
name needs one publish on the token path before the workflow can take it over.

This is what 0.6.0 went through for the four plugins. Do it again the same way for
the next new name.

**Do it as one tagged release, with a temporary token.** The workflow reads
`NPM_TOKEN` when the secret exists and falls back to OIDC when it does not, so a
release that introduces a name needs the secret and every release after it does not.

1. Create a **granular access token** — read and write, scoped to the
   `@single-studio` organisation, **Bypass 2FA on**. That box is the one people miss,
   and missing it fails late: the publish authenticates, uploads, prints the whole
   manifest, then stops on `EOTP` asking for a code a runner cannot give.
2. Add it as the `NPM_TOKEN` repository secret.
3. Tag. Everything publishes on the token; the run says so in a notice.
4. Configure trusted publishing for each new package on npm — **and opt it into
   `npm publish`**, which is not the default. See below.
5. **Delete `NPM_TOKEN`.** The next release is tokenless again.

### Why not publish the new names by hand first

Because the versions would then exist, and the tagged release would die trying to
publish them again — and by then it would already have published `core`.

That used to strand the release. It no longer does: the publish loop skips a version
already on the registry, so a run that died partway through is resumable and a
by-hand publish is merely wasted effort rather than a burnt version number. One tag
with a token is still the shortest path.

Check what is about to go out first — `npm pack` in each, and look inside. npm
refuses to unpublish after 72 hours.

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

Once every package is configured, the token is dead weight: delete the `NPM_TOKEN`
secret and revoke the token on npm.

### A new trusted publisher is stage-only until you say otherwise

This is the one that will catch the next new package, because it is a default that
changed under us and it fails only once the token is gone.

A trusted publisher grants two permissions separately: `npm publish`, which publishes,
and `npm stage publish`, which uploads to a staging area that a maintainer then has to
approve with 2FA before anything is public. **Configurations created from 3 September
2026 default to stage-only.** `npm publish` is an opt-in extra.

So a package configured on the defaults will publish fine while `NPM_TOKEN` exists and
refuse the moment the workflow falls back to OIDC — because the loop runs
`npm publish`, which that publisher does not permit. Half the release goes out and the
rest stops, which is the shape of failure this whole file exists to avoid.

Either opt every package into `npm publish`, or move the loop to `npm stage publish`
and approve each release by hand. What is not survivable is a mix: check all of them
say the same thing.

Staged publishing is worth considering on its own merits, though — nothing is public
until it is approved, so a release that dies partway through strands nothing and burns
no version numbers. It would need the loop changed, and the already-published check
below rethought, since `npm view` does not see a staged version.

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

### Provenance also requires every package to say where it came from

npm compares each package's `repository.url` against the repository that built the
tarball, and refuses the publish when they disagree:

```
422 Unprocessable Entity - PUT .../@single-studio%2fplugin-obs
Error verifying sigstore provenance bundle: package.json:
"repository.url" is "", expected to match "https://github.com/FourCourtJester/Single-Studio"
```

Nothing local sees this coming. `npm pack` builds the tarball happily, because the
comparison happens on npm's servers, at publish time, one package at a time. 0.6.0
found out the hard way: four plugins had no `repository` field at all, and the run
published `core` and `provider-supabase` before stopping on the third.

It is now checked twice — `verify-template.mjs` compares all six on every pull
request, and `release.yml` compares them again before the publish loop, inside the
same condition that decides whether provenance is requested at all, so the check
cannot drift out of step with whether npm is going to apply it.

## The template repositories and the demo are synced by the release

`templates/studio` and `templates/plugin` here are authoritative. Both mirrors are
pushed by the `template` job in `release.yml`, as a matrix, once the packages are
actually on npm:

| Source             | Mirror                                                                              | Secret                       |
| ------------------ | ----------------------------------------------------------------------------------- | ---------------------------- |
| `templates/studio` | [Single-Studio-Template](https://github.com/FourCourtJester/Single-Studio-Template) | `TEMPLATE_DEPLOY_KEY`        |
| `templates/plugin` | Single-Studio-Plugin-Template                                                       | `PLUGIN_TEMPLATE_DEPLOY_KEY` |

It works this way because neither template is independent of the framework the way
the demo is. Their source calls the components and base classes by name, so an API
change here forces a change there — 0.2.0 alone moved every import to `/control` and
`/source`, renamed `ToggleButton`, and changed what `swap` and `group` mean; 0.6.0
renamed two plugin handlers and moved cross-plugin calls into the framework. A
template repository that missed any of it would hand somebody a project that does not
compile, and nothing would say so: `verify-template.mjs` would keep passing here,
against the copy nobody uses.

The matrix runs with `fail-fast: false`, so a missing key on one does not hide the
state of the other — on a manual check run, knowing both are wrong beats finding out
twice.

The job replaces the mirror's contents rather than merging, so a file deleted here is
deleted there. It never force-pushes the branch, and it skips the commit entirely when
nothing changed — but it tags every release either way, so "which template goes with
0.2.0" has an answer even when the template did not move.

### The credential: a deploy key, not a token

The job needs a secret **per mirror** in _this_ repository — `TEMPLATE_DEPLOY_KEY`
and `PLUGIN_TEMPLATE_DEPLOY_KEY` — each holding the **private half** of an SSH keypair
whose public half is a write-enabled deploy key on that mirror.

Two keypairs, not one reused. A deploy key is scoped to a single repository by design,
and that is the property worth keeping: the whole reason this is not a personal access
token is that a leak should reach one repository rather than everything its owner can
see.

Do the following twice, once per mirror, changing the filename and the secret name.

Generate it somewhere that is **not a git repository** — an absolute path into a
temporary directory, so there is no chance of a private key landing next to files you
are about to commit:

```bash
cd "$(mktemp -d)" && pwd            # prints where you are; the keys land here
ssh-keygen -t ed25519 -C "single-studio template sync" -f "$PWD/template-sync" -N ""
```

- **Public half** (`template-sync.pub`) → the **mirror** repository → Settings →
  Deploy keys → Add deploy key → **tick "Allow write access"**
- **Private half** (`template-sync`) → Single-**Studio** → Settings → Secrets and
  variables → Actions → the secret name for that mirror

Paste the private half whole, including the `-----BEGIN OPENSSH PRIVATE KEY-----` and
`-----END-----` lines and the trailing newline.

Then delete both files. The private half lives in the secret now, and a copy left in
a working directory is a copy that can leak:

```bash
shred -u template-sync template-sync.pub 2>/dev/null || rm -f template-sync template-sync.pub
```

If you generated them inside a repository by mistake, deleting the file is not
enough on its own — check `git status` first, and if the private half was ever
committed, remove the deploy key from GitHub and generate a new pair rather than
trying to scrub the history.

**Why not a personal access token.** Three reasons, and the third decides it:

1. `GITHUB_TOKEN` cannot reach another repository at all — it is scoped to this one.
2. A PAT acts as whoever minted it, expires on a schedule somebody has to remember,
   and grants whatever that person can reach rather than this one repository.
3. The template contains `.github/workflows/pages.yml`, and GitHub refuses any push
   from an OAuth or GitHub App credential that creates or updates a workflow file
   unless it carries the `workflow` scope:

   ```
   ! [remote rejected] main -> main (refusing to allow an OAuth App to create or
     update workflow `.github/workflows/pages.yml` without `workflow` scope)
   ```

   SSH is not subject to that rule. A deploy key never meets the problem.

A deploy key is also the smallest credential that does the job: one repository, write
access, no account behind it, and revoking it is deleting one entry.

### Check it before you need it

The credential fails in the worst possible place: after `npm publish` has already
run and cannot be taken back. So check it first, without cutting anything.

**Actions → Release → Run workflow**, tick **"Also check the template deploy key can
write"**, and run it against `main`.

That does the ordinary rehearsal — lint, test, build, template against packed
tarballs — and then, instead of publishing or syncing, pushes a scratch tag to the
template repository and immediately deletes it. Nothing is published, nothing is
committed, and the template repository is left exactly as it was.

It is a real write against the real remote on purpose. A deploy key added without
ticking **Allow write access** clones perfectly and refuses to push, so a read-only
check would pass and tell you nothing. The run also prints what a real release would
have changed in the template, which is a useful thing to see before it happens.

Without the secret the job stops before touching anything and says so. That failure
mode is deliberate: the packages are already published by then, so the honest outcome
is a red release with a clear reason rather than a silent skip that leaves the
template a version behind.

## The demo is a mirror, like the templates

**`SS-` is for studios, and only for studios.** `SS-Demo` is a show -- graphics, a
board, something you can watch -- and so is anybody's own studio. The two template
repositories keep their full names on purpose: `Single-Studio-Template` and
`Single-Studio-Plugin-Template` say what they are at a glance, which is the whole job
of a name somebody meets by pressing "Use this template". Renaming them to `SS-` for
consistency would trade the only thing their names are for.

This repository keeps its name too. It is the framework rather than a studio, the npm
scope is `@single-studio/*` and cannot be renamed to match, and every published
package declares `repository.url` pointing here -- npm refuses provenance unless that
names the building repository, so a rename would hard-stop the next release until all
six manifests and `ORIGIN` in `scripts/verify-template.mjs` followed it.

`demo/` in this repository is the source of truth. `SS-Demo` is a mirror,
replaced on every release by the third entry in the `template` job's matrix, using
`DEMO_DEPLOY_KEY`. It is a separate repository only because GitHub Pages serves one
site per repository and this one's slot is the documentation.

It did stand on its own, and that is exactly why it is here now. It sat at one
commit, pinned to `@single-studio/core@^0.2.0`, through four releases -- while being
linked from the README, from the documentation hero and navbar, and from
`packages/core/README.md`, which is the npm page for the framework. Nothing failed,
because nothing was watching.

`pnpm verify:template` now builds it on every pull request against the packed
tarballs, and typechecks it. Both halves are needed and the second is the one that
matters:

- The **build** catches a package that cannot resolve.
- The **typecheck** catches a component that no longer exists. A build does not:
  Rollup leaves an import of a name a module no longer exports as `undefined` rather
  than failing, so a demo importing a deleted component builds perfectly and throws
  `Element type is invalid` the first time somebody opens the graphic. This was
  measured rather than assumed -- an import of a name that does not exist passed the
  build and was caught only by `tsc`.

### Setting up DEMO_DEPLOY_KEY

Exactly the procedure in [The credential: a deploy key, not a
token](#the-credential-a-deploy-key-not-a-token) above -- a third time, not a
different method. Do not reuse either template's keypair: a deploy key is scoped to
one repository by design, and that is the property worth keeping.

The three things that change:

|                     |                           |
| ------------------- | ------------------------- |
| Comment             | `single-studio demo sync` |
| Mirror repository   | `FourCourtJester/SS-Demo` |
| Secret in this repo | `DEMO_DEPLOY_KEY`         |

Everything else is the same, including the two parts people get wrong: generate it
somewhere that is **not a git repository**, and tick **Allow write access** when you
add the public half. A deploy key added without that box clones perfectly and refuses
to push, so the mistake is invisible until a release is half done.

Then rehearse it. Running the release workflow by hand publishes nothing -- every
publishing step is gated on the ref being a tag -- and the mirror job pushes a scratch
tag and deletes it, which is a real write against the real remote. That is the only
thing that actually answers whether the key works.

## Versioning

All six published packages move together and share a version. A studio installs
several of them and a mismatch is a debugging session nobody signed up for.
Independent versioning buys flexibility nobody has asked for and costs a
compatibility matrix.

The plugins peer on `@single-studio/core` at `^0.6.0` rather than an exact version,
so a patch release does not need those ranges touched — `^0.6.0` already admits
`0.6.1`. Only the `version` fields move.

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
3. **Log in locally** — `npm login`, which opens a browser.
4. **Publish once, by hand:**

   ```bash
   pnpm install
   pnpm verify:template          # the rehearsal — see below
   pnpm -r --filter "./packages/*" publish --access public
   ```

   `--access public` matters: **scoped packages default to private**, and without it
   a free account gets a permission error rather than a package. It is also in each
   package's `publishConfig`, so this is belt and braces.

   `prepack` on `packages/core` builds `dist` first, so there is no separate build
   step and no way to ship a stale one.

That first publish has to come from a laptop rather than from CI, and not by choice:
npm requires a package to _exist_ before a trusted publisher can be attached to it,
so OIDC cannot perform a package's first publish. Every release after this one is a
tag.

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

Once both packages are configured, delete the `NPM_TOKEN` secret and the
`NODE_AUTH_TOKEN` line from the workflow. Until then the token path is what works.

## Versioning

Both packages move together and share a version. They are two halves of one release
— the provider imports nothing from core, but a studio installs both and a mismatch
is a debugging session nobody signed up for. Independent versioning buys flexibility
nobody has asked for and costs a compatibility matrix.

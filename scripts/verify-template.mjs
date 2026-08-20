#!/usr/bin/env node
// Build the starter template the way a stranger would, from packed tarballs.
//
// The demo cannot answer this question. It resolves the framework through
// `workspace:*`, which reaches the whole package directory regardless of what
// `files` says, so the demo would keep building for years after `dist` fell out of
// the published tarball. What a new project gets is the tarball, and the failure
// there is total: `pnpm install` succeeds, `vite build` cannot resolve
// `@single-studio/core`, and the first person to find out is the first person to
// try the thing.
//
// So: pack the packages exactly as `npm publish` would, copy the template
// somewhere clean, point it at the tarballs, install, build. Every part of the
// publish surface is exercised on the way through -- `files`, `exports`, the
// dependency ranges, and whether the template's own manifest lists everything it
// imports.
//
//   node scripts/verify-template.mjs [--keep]
//
// `--keep` leaves the built project behind and prints where, for poking at when
// something has gone wrong.

import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const keep = process.argv.includes('--keep')

/** Published packages, in the order the template depends on them. */
const PACKAGES = ['packages/core', 'packages/provider-supabase']

const run = (command, args, cwd) => execFileSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env } })
const capture = (command, args, cwd) => execFileSync(command, args, { cwd, encoding: 'utf8', env: { ...process.env } }).trim()

const stage = mkdtempSync(join(tmpdir(), 'single-studio-template-'))
const tarballs = join(stage, 'tarballs')
const project = join(stage, 'studio')

try {
  console.log(`\n→ packing into ${tarballs}`)

  const packed = {}

  for (const dir of PACKAGES) {
    const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))

    // `pnpm pack` runs the package's own prepack/prepublishOnly, so a package that
    // builds before it publishes builds here too -- which is the point: this has to
    // fail the same way a real publish would.
    const out = capture('pnpm', ['pack', '--pack-destination', tarballs], join(root, dir))
      .split('\n')
      .filter((line) => line.endsWith('.tgz'))
      .at(-1)

    if (!out) throw new Error(`pnpm pack produced no tarball for ${manifest.name}`)

    packed[manifest.name] = out
    console.log(`  ${manifest.name} → ${out.split('/').at(-1)}`)
  }

  console.log(`\n→ copying templates/studio to ${project}`)
  cpSync(join(root, 'templates/studio'), project, { recursive: true })

  // The only edit. Everything else about the template is exactly what somebody
  // gets, including the version ranges -- which are left alone deliberately, so a
  // range that no published version satisfies is still caught by an actual install.
  const manifest = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8'))

  for (const [name, tarball] of Object.entries(packed)) {
    if (!manifest.dependencies?.[name]) throw new Error(`templates/studio does not depend on ${name}`)

    manifest.dependencies[name] = `file:${tarball}`
  }

  writeFileSync(join(project, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  console.log('\n→ installing')
  // No lockfile and no workspace: a fresh resolve, the way a new project gets one.
  run('pnpm', ['install', '--ignore-workspace', '--no-frozen-lockfile'], project)

  console.log('\n→ building')
  run('pnpm', ['build'], project)

  if (!existsSync(join(project, 'dist/index.html'))) throw new Error('the template built without producing dist/index.html')

  console.log('\ntemplate builds against the packed packages')
} finally {
  if (keep) console.log(`\nleft behind at ${project}`)
  else rmSync(stage, { recursive: true, force: true })
}

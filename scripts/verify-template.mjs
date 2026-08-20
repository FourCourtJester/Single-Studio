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
// It also checks what is *in* the tarballs, which is a different worry with the
// same answer. A studio's assets are its client's -- logos, headshots, sponsor
// artwork -- and none of it belongs in a framework that gets published to a public
// registry. `.gitignore` keeps client studios out of the repository; this keeps
// anything that did get committed out of a tarball, because a mistake here is not
// one you can take back: npm refuses to unpublish after 72 hours, and the tarball
// is mirrored the moment it lands.
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

/**
 * What a framework package is made of, and nothing else.
 *
 * Deliberately an allowlist of *code*. A denylist of image extensions would have to
 * be right about every format anybody might drop in, and would be wrong about the
 * next one; this is wrong only if the framework legitimately grows a new kind of
 * file, which is a two-word change made by somebody who knows they are making it.
 */
const SHIPPABLE = /\.(js|jsx|mjs|cjs|ts|tsx|d\.ts|css|json|md|map)$/i

/**
 * The paperwork npm adds whatever `files` says.
 *
 * It force-includes these, so they turn up in a tarball without anybody asking and
 * a check that did not know about them would fail on a correct package -- which is
 * how a guard gets switched off.
 */
const PAPERWORK = /^(package\.json|README|LICEN[CS]E|CHANGELOG|NOTICE)/i

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

    // Read back what actually went in, rather than trusting `files` to have meant
    // what somebody thought it meant. `tar -tf` is the tarball npm would receive.
    const contents = capture('tar', ['-tzf', out], root)
      .split('\n')
      .map((entry) => entry.replace(/^package\//, ''))
      .filter((entry) => entry && !entry.endsWith('/'))

    const strangers = contents.filter((entry) => !PAPERWORK.test(entry) && !SHIPPABLE.test(entry))

    if (strangers.length) {
      throw new Error(
        `${manifest.name} would publish files that are not framework code:\n  ${strangers.join('\n  ')}\n` +
          'A published tarball is public and permanent -- npm refuses to unpublish after 72 hours. ' +
          "If this is legitimate, widen SHIPPABLE in this script; if it is a studio's assets, it belongs in that studio's own repo.",
      )
    }

    console.log(`  ${manifest.name} → ${out.split('/').at(-1)} (${contents.length} files, all code)`)
  }

  console.log(`\n→ copying templates/studio to ${project}`)
  cpSync(join(root, 'templates/studio'), project, { recursive: true })

  // The same worry about the template, which is copied wholesale into every new
  // studio anybody starts. A stray asset in here would not merely be published
  // once -- it would be handed to every project made from it, and turn up in repos
  // whose owners never knew it was there.
  const scaffold = capture('git', ['ls-files', 'templates/studio'], root).split('\n').filter(Boolean)
  const assets = scaffold.filter((file) => !PAPERWORK.test(file.split('/').at(-1)) && !/\.(js|jsx|css|json|md|html|yml|yaml|gitignore)$/i.test(file))

  if (assets.length)
    throw new Error(`templates/studio carries files that are not scaffolding:\n  ${assets.join('\n  ')}\nEvery studio made from the template gets a copy.`)

  console.log(`  ${scaffold.length} scaffold files, no assets`)

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

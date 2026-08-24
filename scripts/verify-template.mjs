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
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs'
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

  // npm will not create its own --pack-destination, where pnpm did.
  mkdirSync(tarballs, { recursive: true })

  const packed = {}

  for (const dir of PACKAGES) {
    const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))

    /**
     * `npm pack`, because `npm publish` is what actually ships these.
     *
     * It used to be `pnpm pack`, and the two do not produce the same tarball: pnpm
     * copies the workspace root's LICENSE into every package and npm does not. So
     * the rehearsal carried a licence the real publish dropped, and said the
     * packages were fine while two releases went out without one. A rehearsal that
     * uses a different tool from the performance is not a rehearsal.
     *
     * `npm pack` runs the package's own prepack, so a package that builds before it
     * publishes builds here too -- which is the point: this has to fail the same way
     * a real publish would, including the ways nobody has thought of yet.
     */
    // npm reports the bare filename where pnpm reported a full path, so resolve it
    // against the destination rather than trusting either shape.
    const named = capture('npm', ['pack', '--pack-destination', tarballs], join(root, dir))
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.tgz'))
      .at(-1)

    if (!named) throw new Error(`npm pack produced no tarball for ${manifest.name}`)

    const out = named.startsWith('/') ? named : join(tarballs, named)

    packed[manifest.name] = out

    // Read back what actually went in, rather than trusting `files` to have meant
    // what somebody thought it meant. `tar -tf` is the tarball npm would receive.
    const contents = capture('tar', ['-tzf', out], root)
      .split('\n')
      .map((entry) => entry.replace(/^package\//, ''))
      .filter((entry) => entry && !entry.endsWith('/'))

    const strangers = contents.filter((entry) => !PAPERWORK.test(entry) && !SHIPPABLE.test(entry))

    // The other direction, and the one that bit. Switching the publish from pnpm to
    // npm silently dropped LICENSE from both tarballs: pnpm copies the workspace
    // root's into every package, npm does not. Nothing failed, nothing warned, and
    // two releases went out declaring a licence they did not carry. A guard that
    // only looks for files that should not be there cannot see that.
    const missing = ['package.json', 'README.md', 'LICENSE'].filter((need) => !contents.includes(need))

    if (missing.length) {
      throw new Error(
        `${manifest.name} would publish without ${missing.join(' and ')}.\n` +
          'npm force-includes these from the package directory whatever `files` says, so a missing one means the file is not there at all -- ' +
          'not that it was excluded. A package that states a licence and does not carry its text is worse than one that states neither.',
      )
    }

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

  /**
   * And that the source glob actually found the graphics.
   *
   * The template registers its sources with `sourcesFrom(import.meta.glob(...))`,
   * and a glob that matches nothing is not an error -- it is an empty object. The
   * build succeeds, the board comes up, and the Browser sources list is empty, which
   * is a bad thing to discover from OBS.
   *
   * Vite code-splits each dynamic import into its own chunk named after the file, so
   * a chunk per graphic is the evidence that the glob resolved and stayed lazy.
   */
  const graphics = readdirSync(join(root, 'templates/studio/src/sources')).filter((file) => file.endsWith('.jsx'))
  const chunks = readdirSync(join(project, 'dist/assets'))

  for (const graphic of graphics) {
    const stem = graphic.replace('.jsx', '')

    if (!chunks.some((chunk) => chunk.startsWith(`${stem}-`))) {
      throw new Error(`${graphic} produced no chunk of its own, so the source glob did not reach it. The Browser sources list would be short by one.`)
    }
  }

  console.log(`  the source glob found all ${graphics.length} graphic${graphics.length === 1 ? '' : 's'}, each code-split on its own`)

  /**
   * And that a TypeScript studio gets types out of the tarball.
   *
   * Shipping `.d.ts` files is not the same as a consumer resolving them. The
   * `exports` map has to name them, and it has to name them *first* -- a `types`
   * condition listed after `import` is one no resolver ever reaches, which fails
   * silently and looks exactly like success from inside this repository, where
   * everything resolves through the workspace anyway.
   *
   * So: a probe that uses the components the way a studio would, compiled with
   * `strict` on against the installed package. Without types it does not merely
   * lose autocomplete -- `noImplicitAny` refuses the import outright.
   *
   * It imports from both subpaths, which is the other thing worth proving: the
   * dashboard and the graphics are separate entry points precisely so that each can
   * have a <Toggle>, and a package that resolved only one of them would look
   * completely fine from inside this repository, where everything resolves through
   * the workspace anyway.
   */
  console.log('\n→ typechecking a consumer against the packed types')

  writeFileSync(
    join(project, 'probe.tsx'),
    [
      "import { Countdown, CountdownTo, Field, ResetButton, Stepper, Toggle } from '@single-studio/core/control'",
      "import { Scene, Timer, Toggle as OnAir, Variable } from '@single-studio/core/source'",
      '',
      'export const Board = () => (',
      '  <>',
      '    <Field name="home.name" label="Home" />',
      '    <Stepper name="home.score" label="Home score" step={3} />',
      '    <Countdown name="round" duration="5:00" />',
      '    <CountdownTo name="showtime" as="time" />',
      '    <ResetButton names={[\'home.score\']} label="scores" />',
      '    <Toggle name="lowerthird" label="Lower third" group="panels" />',
      '  </>',
      ')',
      '',
      'export const Graphic = () => (',
      "  <Scene vars={{ '--accent': 'home.color' }} style={{ opacity: 1 }}>",
      '    <Variable name="home.name" fallback="Home" />',
      '    <Timer name="round" onComplete={() => {}} />',
      '    <OnAir name="lowerthird">shown while on</OnAir>',
      '  </Scene>',
      ')',
      '',
    ].join('\n'),
  )

  writeFileSync(
    join(project, 'tsconfig.probe.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          strict: true,
          noEmit: true,
          jsx: 'react-jsx',
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'es2022',
          lib: ['es2022', 'dom'],
          skipLibCheck: true,
        },
        files: ['probe.tsx'],
      },
      null,
      2,
    )}\n`,
  )

  run('node', [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(project, 'tsconfig.probe.json')], project)

  console.log('  a TypeScript studio resolves the components and their props')

  /**
   * And that the template's own sources still match the components they use.
   *
   * The probe above proves a consumer can *resolve* the types. This proves the code
   * we hand people actually satisfies them -- which is a different failure. A studio
   * passing a prop the framework has since removed builds, renders, and does nothing:
   * React hands an unknown lowercase attribute straight to the DOM without a word.
   * The demo lost a `retries` that way and nothing noticed until this ran.
   *
   * It checks against the installed tarball rather than the workspace, because that
   * is what somebody generating a studio from this template will have.
   */
  console.log('\n→ typechecking the template against what it ships with')

  writeFileSync(
    join(project, 'tsconfig.template.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          allowJs: true,
          checkJs: true,
          noEmit: true,
          jsx: 'react-jsx',
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'es2022',
          lib: ['es2022', 'dom', 'dom.iterable'],
          // Same setting the template's own studios get: this is here to catch a
          // prop that no longer exists, not to hold a broadcast studio to
          // `strictNullChecks` on a `getElementById`.
          strict: false,
          skipLibCheck: true,
          types: ['vite/client'],
        },
        include: ['src/**/*.js', 'src/**/*.jsx'],
      },
      null,
      2,
    )}\n`,
  )

  run('node', [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(project, 'tsconfig.template.json')], project)

  console.log('  every graphic and control in the template still matches its component')

  console.log('\ntemplate builds against the packed packages')
} finally {
  if (keep) console.log(`\nleft behind at ${project}`)
  else rmSync(stage, { recursive: true, force: true })
}

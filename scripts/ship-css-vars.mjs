#!/usr/bin/env node
// Put the CSS custom property augmentation where a consumer will actually load it.
//
// `tsc --emitDeclarationOnly` emits declarations for the source it compiles and
// copies nothing else, so a hand-written `.d.ts` sitting beside package.json is
// shipped in the tarball and never read. Referencing it from the emitted entry
// point is what makes it ambient for anybody who imports the package -- rather than
// something each studio has to discover and add to its own tsconfig.

import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const core = resolve(fileURLToPath(new URL('../packages/core', import.meta.url)))
const entry = join(core, 'dist/types/index.d.ts')
const reference = '/// <reference path="./css-vars.d.ts" />'

copyFileSync(join(core, 'css-vars.d.ts'), join(core, 'dist/types/css-vars.d.ts'))

const declarations = readFileSync(entry, 'utf8')

if (!declarations.startsWith(reference)) writeFileSync(entry, `${reference}\n${declarations}`)

console.log('css-vars.d.ts shipped alongside the emitted types')

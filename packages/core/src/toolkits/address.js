// One way to name a value, everywhere a component takes more than one.
//
// Most components take a single `name` and a `namespace` that defaults to the
// right thing, so a studio author writes `name="home.score"` and never thinks
// about it. The handful that act on *several* values at once used to take
// fully-qualified `paths` instead -- `['variables.home.score']` -- which meant the
// same value was written two different ways within a few lines of the same panel,
// with nothing to say why.
//
// It failed quietly, too, which is the part that made it worth changing rather
// than documenting: `unset` on a path nobody ever wrote does exactly nothing, so a
// reset button built the wrong way is a button that works and resets nothing.

import { normalize } from '../velcro/paths'

/**
 * Resolve `names` against a namespace, and pass `paths` through untouched.
 *
 * `names` is what a studio author reaches for. `paths` stays for the case names
 * cannot express -- reaching across namespaces, usually clearing a toggle and a
 * variable together -- so nothing that reads naturally has to become a special
 * case, and nothing written before this stopped working.
 *
 *   qualify({ names: ['home.score'], namespace: 'variables' })
 *   // → ['variables.home.score']
 *
 *   qualify({ names: ['lowerthird'], paths: ['variables.guest.name'], namespace: 'toggles' })
 *   // → ['toggles.lowerthird', 'variables.guest.name']
 */
export function qualify({ names = [], paths = [], namespace = 'variables' } = {}) {
  const one = (value) => (Array.isArray(value) ? value : [value]).filter((entry) => typeof entry === 'string' && entry.trim())

  return [...one(names).map((name) => normalize(`${namespace}.${name}`)), ...one(paths).map(normalize)]
}

// The operator's dashboard, as its own entry point.
//
// Separate from `/source` because they are separate worlds: a control file imports
// only from here, a graphic imports only from there, and nothing in this repository
// or in the template has ever needed both in one file. Keeping them apart lets each
// side use the name that is right for it -- <Toggle> is a button here and the thing
// being toggled over there -- instead of one of them carrying a longer name to stay
// out of the other's way.
//
// Hooks, toolkits and the studio wiring stay on the root entry, because those are
// genuinely shared.

export * from './components/control'

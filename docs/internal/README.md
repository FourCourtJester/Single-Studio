# Internal

Not documentation for using Single Studio — that is one level up, in [`docs/`](../).

These are for working on the framework itself, and they are written to a different
standard: they argue, they record decisions that have already been made, and they
carry status markers rather than instructions.

|                                      |                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [contributing.md](contributing.md)   | Running the checks, what each one is for, and the layout of the repository                                    |
| [architecture.md](architecture.md)   | How the store, routes and components fit together, and why each is shaped that way                            |
| [collaboration.md](collaboration.md) | The design for going from one operator to several. A plan with staged delivery, not a guide                   |
| [rocket-league.md](rocket-league.md) | The Stats API as transcribed from Psyonix's docs, which CI cannot reach. The working reference for the plugin |
| [twitch.md](twitch.md)               | EventSub, the auth constraint that shapes it, and what is still unverified                                    |
| [releasing.md](releasing.md)         | Publishing both packages to npm — trusted publishing, tags, and the rehearsal                                 |

**If you are building a studio, none of this is for you.** Start at
[getting-started.md](../getting-started.md).

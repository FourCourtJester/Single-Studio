// Custom properties are a documented part of this framework's surface -- `Scene`'s
// `vars`, `--ss-shift`, `--ss-duration` -- and React's `CSSProperties` does not
// admit them, so `style={{ '--ss-shift': '14rem' }}` is a type error in every studio
// that uses the feature as written.
//
// Shipped rather than left to each studio to rediscover. It widens one index
// signature and nothing else: a key beginning with two dashes takes a string or a
// number, which is exactly what the CSSOM accepts.

import 'react'

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
}

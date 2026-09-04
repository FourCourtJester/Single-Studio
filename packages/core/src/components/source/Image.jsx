import { useEffect, useState } from 'react'

import { useAssetUrl } from '../../hooks/useAssets'
import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { slugify } from '../../toolkits/slug'
import { Transition } from '../common/Transition'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

const isAbsolute = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url)

/** Remote hosts commonly block hotlinking by Referer, and we never need to send one. */
const REFERRER_POLICY = 'no-referrer'

/**
 * @typedef {object} ImageProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [value] - A value outright rather than a path to one. Wins over `name`.
 * @property {string} [src] - URL template; `:value:` is replaced. Defaults to `":value:"`, so a pasted URL just works.
 * @property {boolean} [slug] - [Slugify](https://github.com/FourCourtJester/Single-Studio/blob/main/packages/core/src/toolkits/slug.js) the value first — "Single Studio" becomes `single-studio`.
 * @property {string} [fallback] - URL used when the value is empty or fails to load.
 * @property {'cover'|'contain'|'fill'|'none'|'scale-down'} [fit] - Fill the box this way instead of sitting inside it — `"cover"` for a backdrop.
 * @property {string} [alt] - Alt text.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. See [the transitions guide](getting-started.md#transitions).
 * @property {string} [className] - Added to the component's own classes.
 */
/**
 * Load and decode before showing. Resolves to the URL once it is safe to paint.
 *
 * `decode()` rather than `onload` because onload fires before the bitmap is ready,
 * and painting then can still drop a frame on a large image.
 */
function preload(url) {
  return new Promise((resolve, reject) => {
    const probe = new window.Image()

    probe.referrerPolicy = REFERRER_POLICY
    probe.onerror = () => reject(new Error(`could not load ${url}`))
    probe.onload = () =>
      probe.decode
        ? probe.decode().then(
            () => resolve(url),
            () => resolve(url),
          )
        : resolve(url)
    probe.src = url
  })
}

/**
 * A picture chosen by a value the operator controls. Loads and decodes off-screen
 * first and only swaps once ready, so a change never leaves a hole on air.
 *
 * Two shapes, and both matter on a broadcast:
 *
 *   <Image name="home.name" src="/logos/:value:.svg" slug />   templated from a value
 *   <Image name="sponsor.logo" />                              the value *is* the URL
 *   <Image name="guest.photo" />                               ...or an `asset:<key>` entry
 *
 * The second is the default (`src` is `:value:`), so pasting a URL into a field
 * puts that image on air with no studio code at all. An `asset:<key>` reference --
 * what ImagePicker writes -- resolves through the library and then follows exactly
 * the same path, so nothing downstream knows whether the bytes came from a bundled
 * file, a remote host, or an operator's upload.
 *
 * What makes this different from an `<img>` tag is what happens between images.
 * A new URL is loaded and decoded off-screen first, and only swapped in once it is
 * ready to paint. The previous image stays up in the meantime. Swapping the src
 * directly leaves a hole on air for however long the network takes -- fine in a
 * web page, not fine over a live scene.
 *
 * **Where the URL comes from, in order.** Three props decide it and they resolve
 * the same way every time:
 *
 *   1. `value`, if given, is the value -- used as-is, ignoring `name`. This is for
 *      a component that already holds a string (one row of a list, an entry being
 *      previewed) and wants the loading and decoding without inventing a path to
 *      park it at. A studio author writing a graphic almost never passes this.
 *   2. Otherwise `name` reads a path under `variables`, which is what a graphic
 *      normally does.
 *   3. Whichever of those produced a value is then substituted into `src` wherever
 *      `:value:` appears, after `slug` has had its say. `src` defaults to
 *      `":value:"`, so with no `src` at all the value *is* the URL.
 *   4. If the result is empty, or the image fails to load, `fallback` is used.
 *
 * So `<Image name="sponsor.logo" />` puts a pasted URL on air with no studio code,
 * and `<Image name="home.name" src="/logos/:value:.svg" slug />` turns a typed team
 * name into a badge lookup. Both are the same four steps with different props left
 * out.
 *
 * An `asset:<key>` value -- what ImagePicker writes -- is resolved through the
 * library at step 3 and then follows exactly the same path, so nothing downstream
 * knows whether the bytes came from a bundled file, a remote host, or a file an
 * operator dropped on the board.
 *
 * @example
 * // No `src`: the stored value is the URL, or an `asset:` key from the library
 * <Image name="sponsor.logo" alt="" />
 *
 * @example
 * // Templated: "Single Studio" resolves /logos/single-studio.svg
 * <Image name="home.name" src="/logos/:value:.svg" slug fallback="/logos/tbd.svg" />
 *
 * @example
 * // `value` instead of `name`: a plain string, not a path. Nothing is read from
 * // the store, so this is for a component already holding the value itself.
 * <Image value="https://cdn.example.com/acme.svg" alt="Acme" />
 * <Image value="asset:acme-logo" alt="Acme" />
 * <Image value="vanguard" src="./factions/:value:.svg" alt="Vanguard" />
 *
 * @param {ImageProps & import("react").ImgHTMLAttributes<HTMLElement>} props
 */
export function Image({ name, value: literal, src = ':value:', slug = false, fallback, alt = '', fit, className, ...rest }) {
  const { value: stored, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)
  // A literal value stands in for the store, so a component that already holds a
  // value -- one row of a list, say -- can reuse all of the loading machinery below
  // without inventing a path to put it at.
  const value = literal !== undefined ? literal : stored
  const hydrated = literal !== undefined || loaded
  // What is on air. Only ever replaced by something already decoded.
  const [shown, setShown] = useState(null)

  const templated = hydrated && src ? String(src).replace(/:value:/g, slug ? slugify(value) : String(value ?? '')) : null
  // An asset reference becomes an object URL here; everything else passes through.
  const target = useAssetUrl(templated)
  const usable = target && !/:value:|^\s*$/.test(target) && target !== 'undefined' && target !== 'null'

  useEffect(() => {
    if (!usable) {
      setShown(null)
      return undefined
    }

    // An http:// image on an https:// page is blocked as mixed content and fails
    // with nothing useful in the console. Say so plainly -- pasting an http URL is
    // the single most common way this goes wrong.
    if (isAbsolute(target) && target.startsWith('http://') && window.location.protocol === 'https:') {
      console.warn(`[single-studio] blocked as mixed content: ${target}\nThe page is served over https, so the image URL must be https too.`)
    }

    let live = true

    const show = (url) => {
      if (live) setShown(url)
    }

    preload(target).then(show, (err) => {
      if (!live) return

      console.warn(`[single-studio] image failed: ${target}`, err?.message ?? err)

      if (fallback) preload(fallback).then(show, () => show(null))
      else show(null)
    })

    return () => {
      live = false
    }
  }, [fallback, target, usable])

  if (!shown) return null

  return (
    <Transition trigger={shown} className={cx('ss-image', className)} {...rest}>
      <img
        src={shown}
        alt={alt}
        referrerPolicy={REFERRER_POLICY}
        className="max-h-full max-w-full object-contain"
        /*
         * `fit` fills the box rather than sitting inside it, and does so as an
         * inline style because the classes above are Tailwind utilities -- a
         * stylesheet rule in any layer loses to them, so a background that has to
         * cover its frame could not be expressed in CSS at all.
         */
        style={fit ? { width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none', objectFit: fit } : undefined}
      />
    </Transition>
  )
}

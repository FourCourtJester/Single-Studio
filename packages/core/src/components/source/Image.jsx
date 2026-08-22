import { useEffect, useState } from 'react'

import { useAssetUrl } from '../../hooks/useAssets'
import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { slugify } from '../../toolkits/slug'
import { Transition } from '../common/Transition'

const isAbsolute = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url)

/** Remote hosts commonly block hotlinking by Referer, and we never need to send one. */
const REFERRER_POLICY = 'no-referrer'

/**
 * @typedef {object} ImageProps
 * @property {string} name - Path under `namespace`, e.g. `home.score`.
 * @property {string} [value] - A value outright rather than a path to one. Wins over `name`.
 * @property {string} [src] - URL template; `:value:` is replaced. Defaults to `":value:"`, so a pasted URL just works.
 * @property {boolean} [slug] - Slugify the value first — "Boise State" becomes `boise-state`.
 * @property {string} [fallback] - URL used when the value is empty or fails to load.
 * @property {string} [alt] - Alt text.
 * @property {string} [namespace] - Where the value lives. Defaults to `variables`.
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
 * Two ways in, and only one of them is for a studio author. `name` reads a path,
 * which is what a graphic normally does. `value` hands it a string outright, for a
 * component that already holds one -- a row of a list, an entry being previewed --
 * and wants the loading, decoding and retry machinery without inventing a path to
 * park the value at. `value` wins when both are given.
 *
 * @example
 * // The value is the URL, or an `asset:` key from the library
 * <Image name="sponsor.logo" alt="" />
 *
 * @example
 * // Templated from a value: "Boise State" resolves /logos/boise-state.svg
 * <Image name="home.name" src="/logos/:value:.svg" slug fallback="/logos/tbd.svg" />
 *
 * @param {ImageProps & import("react").ImgHTMLAttributes<HTMLElement>} props
 */
export function Image({
  name,
  value: literal,
  src = ':value:',
  slug = false,
  fallback,
  alt = '',
  className,
  namespace = 'variables',
  ...rest
}) {
  const { value: stored, loaded } = useVelcroState(name ? `${namespace}.${name}` : undefined)
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
      <img src={shown} alt={alt} referrerPolicy={REFERRER_POLICY} className="max-h-full max-w-full object-contain" />
    </Transition>
  )
}

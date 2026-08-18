import { useEffect, useRef, useState } from 'react'

import { useAssetUrl } from '../../hooks/useAssets'
import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { slugify } from '../../toolkits/slug'
import { Transition } from '../common/Transition'

/**
 * An image chosen by a value the operator controls.
 *
 * Two shapes, and both matter on a broadcast:
 *
 *   <Image name="home.name" src="/logos/:value:.svg" slug />   templated from a value
 *   <Image name="sponsor.logo" />                              the value *is* the URL
 *   <Image name="guest.photo" />                               ...or an `asset:` upload
 *
 * The second is the default (`src` is `:value:`), so pasting a URL into a field
 * puts that image on air with no studio code at all. An `asset:<hash>` reference --
 * what ImagePicker writes when an operator drops a file in -- resolves through the
 * local asset store and then follows exactly the same path, so nothing downstream
 * needs to know where the bytes came from.
 *
 * What makes this different from an `<img>` tag is what happens between images.
 * A new URL is loaded and decoded off-screen first, and only swapped in once it is
 * ready to paint. The previous image stays up in the meantime. Swapping the src
 * directly leaves a hole on air for however long the network takes -- fine in a
 * web page, not fine over a live scene.
 *
 * `refresh` re-fetches on an interval for an image whose *contents* change behind a
 * stable URL -- a chart, a camera still, an externally generated card. Each poll is
 * cache-busted and, again, only swapped once decoded, so a slow or failed refresh
 * never blanks what is already showing.
 */

const RETRY_BASE = 400
const isAbsolute = (url) => /^[a-z][a-z0-9+.-]*:/i.test(url)

/** Remote hosts commonly block hotlinking by Referer, and we never need to send one. */
const REFERRER_POLICY = 'no-referrer'

function bust(url, token) {
  try {
    const parsed = new URL(url, window.location.href)

    parsed.searchParams.set('_ss', token)

    return parsed.toString()
  } catch {
    // Not parseable as a URL (a bare relative path on an odd base); fall back to
    // naive concatenation rather than dropping the refresh entirely.
    return `${url}${url.includes('?') ? '&' : '?'}_ss=${token}`
  }
}

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

export function Image({ name, src = ':value:', slug = false, fallback, alt = '', refresh, retries = 3, className, namespace = 'variables', ...rest }) {
  const { value, loaded: hydrated } = useVelcroState(name ? `${namespace}.${name}` : undefined)
  // What is on air. Only ever replaced by something already decoded.
  const [shown, setShown] = useState(null)
  const attempt = useRef(0)
  const timer = useRef(null)

  const templated = hydrated && src ? String(src).replace(/:value:/g, slug ? slugify(value) : String(value ?? '')) : null
  // An asset reference becomes an object URL here; everything else passes through.
  const target = useAssetUrl(templated)
  const usable = target && !/:value:|^\s*$/.test(target) && target !== 'undefined' && target !== 'null'

  useEffect(() => {
    clearTimeout(timer.current)
    attempt.current = 0

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

    const load = (url) => {
      preload(url).then(show, (err) => {
        if (!live) return

        attempt.current += 1

        if (attempt.current <= retries) {
          // A blip mid-show should not cost the graphic for the rest of the night.
          timer.current = setTimeout(() => load(url), RETRY_BASE * 2 ** (attempt.current - 1))
          return
        }

        console.warn(`[single-studio] image failed after ${retries} retries: ${url}`, err?.message ?? err)

        if (fallback) preload(fallback).then(show, () => show(null))
        else show(null)
      })
    }

    load(target)

    return () => {
      live = false
      clearTimeout(timer.current)
    }
  }, [fallback, retries, target, usable])

  // Polling for an image whose contents change behind a stable URL.
  useEffect(() => {
    if (!usable || !refresh) return undefined

    const every = Number(refresh) * 1000

    if (!Number.isFinite(every) || every <= 0) return undefined

    const poll = setInterval(() => {
      preload(bust(target, Date.now())).then(
        (url) => setShown(url),
        () => {
          // Keep whatever is already on air. A failed refresh is not a reason to
          // blank a graphic mid-show.
        },
      )
    }, every)

    return () => clearInterval(poll)
  }, [refresh, target, usable])

  if (!shown) return null

  return (
    <Transition trigger={shown} className={cx('ss-image', className)} {...rest}>
      <img src={shown} alt={alt} referrerPolicy={REFERRER_POLICY} className="max-h-full max-w-full object-contain" />
    </Transition>
  )
}

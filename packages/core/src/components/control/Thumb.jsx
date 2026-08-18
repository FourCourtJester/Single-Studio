import { useEffect, useState } from 'react'

import { useAssetUrl } from '../../hooks/useAssets'
import { cx } from '../../toolkits/cx'

/**
 * The face of an image-driven control.
 *
 * Takes whatever the studio wrote -- a bundled path, a remote URL, an `asset:<key>`
 * reference -- and shows it, falling back to the label when there is no image or the
 * image fails to load. A control that renders an empty box is worse than one that
 * renders a word: an operator picking a commander mid-draft needs to hit the right
 * tile whether or not the art shipped.
 *
 * Unlike the graphic-side <Image>, nothing here waits for a decode. This is a
 * control surface, not air; a tile popping in is fine.
 */
export function Thumb({ src, label = '', className }) {
  const url = useAssetUrl(src ?? null)
  const [broken, setBroken] = useState(false)

  useEffect(() => setBroken(false), [url])

  if (!url || broken) {
    return (
      <span className={cx('ss-thumb flex h-full w-full items-center justify-center px-1 text-center text-[0.65rem] leading-tight text-slate-500', className)}>
        {label ? String(label) : '—'}
      </span>
    )
  }

  return <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} className={cx('ss-thumb max-h-full max-w-full object-contain', className)} />
}

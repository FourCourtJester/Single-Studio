import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Image } from './Image'

/**
 * A row of images from one multi-valued path.
 *
 * <ImageSelect multiple> writes an array; this puts it on air. An army composition,
 * a ban list, the three sponsors running this segment -- one subscription, one
 * ordered list, and each entry gets the full <Image> treatment (templated or raw,
 * decoded before it paints, retried on failure).
 *
 *   <ImageList name="home.army" src="/units/:value:.svg" slug />
 *
 * A string value is treated as a list of one, so a path that used to hold a single
 * pick keeps rendering after the control behind it grows a `multiple`.
 */
export function ImageList({ name, src = ':value:', slug = false, fallback, alt = '', limit, className, itemClassName, namespace = 'variables', ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${namespace}.${name}` : undefined)

  if (!loaded) return null

  const all = Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value]
  const items = limit ? all.slice(0, Number(limit)) : all

  if (!items.length) return null

  return (
    <div className={cx('ss-image-list flex items-center gap-2', className)} {...rest}>
      {items.map((item, index) => (
        <Image key={`${item}:${index}`} value={item} src={src} slug={slug} fallback={fallback} alt={alt} className={itemClassName} />
      ))}
    </div>
  )
}

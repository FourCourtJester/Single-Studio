import { useVelcroState } from '../../hooks/useVelcroValue'
import { cx } from '../../toolkits/cx'
import { Image } from './Image'

/** Where this component's values live. Not a prop: a studio never needs another. */
const NAMESPACE = 'variables'

/**
 * @typedef {object} ImageListProps
 * @property {string} name - Names a value under `variables` — e.g. `home.score`.
 * @property {string} [src] - URL template; `:value:` is replaced by each entry. Defaults to `":value:"`.
 * @property {boolean} [slug] - Slugify each value first — "Single Studio" becomes `single-studio`.
 * @property {string} [fallback] - URL used for an entry that fails to load.
 * @property {string} [alt] - Alt text for every image.
 * @property {number} [limit] - Render at most this many entries.
 * @property {string} [transition] - Motion variants, space-separated — e.g. `"slide-up ease-back"`. See the transitions guide.
 * @property {string} [className] - Added to the component's own classes.
 * @property {string} [itemClassName] - Added to each image rather than to the list.
 */
/**
 * Several pictures from one value — what `ImageSelect multiple` writes. Each entry
 * is templated exactly as `Image` templates one.
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
 *
 * @example
 * <ImageList name="home.army" src="/units/:value:.svg" slug />
 *
 * @example
 * // Cap what goes on air, whatever the operator picked
 * <ImageList name="home.army" limit={8} itemClassName="h-10 w-10" />
 *
 * @param {ImageListProps & import("react").HTMLAttributes<HTMLElement>} props
 */
export function ImageList({ name, src = ':value:', slug = false, fallback, alt = '', limit, className, itemClassName, ...rest }) {
  const { value, loaded } = useVelcroState(name ? `${NAMESPACE}.${name}` : undefined)

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

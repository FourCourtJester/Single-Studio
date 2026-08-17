import { cx } from '../../toolkits/cx'

/** Root of a graphic. One Scene per OBS browser source. */
export function Scene({ children, className, ...rest }) {
  return (
    <div className={cx('ss-scene relative h-full w-full overflow-hidden', className)} {...rest}>
      {children}
    </div>
  )
}

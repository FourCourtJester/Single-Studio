// Import core components
import cN from 'classnames'

// Import our components
// ...

// Import style
// ...

/**
 * Component: Scene
 *
 * @returns {React.FunctionComponentElement} React.FunctionComponentElement
 */
export const Scene = (properties) => {
  const { children, className, id } = properties

  return (
    <div id={id} className={cN(className, 'overflow-hidden')}>
      {children}
    </div>
  )
}

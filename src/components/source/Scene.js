// Import core components
import cN from 'classnames'

// Import our components
// ...

// Import style
// ...

export const Scene = (properties) => {
  const { children, className, id } = properties

  return (
    <div id={id} className={cN(className, 'overflow-hidden')}>
      {children}
    </div>
  )
}

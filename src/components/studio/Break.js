// Import core components
import cN from 'classnames'

// Import style
// ...

export const Break = (properties) => {
  // Properties
  const { className } = properties

  return <div className={cN(className, 'p-0 m-0 w-100')} />
}

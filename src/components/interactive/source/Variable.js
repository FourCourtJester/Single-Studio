// Import core components
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
import cN from 'classnames'
import useFitText from 'use-fit-text'

// Import our components
import { SourceVariable } from 'components/global/styled'
import { selectComponent } from 'db/slices/interactive'

// Import style
// ...

export const Source = () => {
  // Hooks
  const params = useParams()
  const { fontSize, ref: $ref } = useFitText({
    minFontSize: 0,
  })
  // Redux
  const component = useSelector((state) => selectComponent(state, params.source))
  // Variables
  const parentStyle = useMemo(() => {
    const fs = Number(fontSize.slice(0, -1)) / 100

    return {
      backgroundColor: component.style.backgroundColor || 'var(--bs-body-bg)',
      fontSize: `calc(${component.style.fontSize || 32}px * ${fs})`,
    }
  }, [component, fontSize])
  const variableStyle = useMemo(
    () => ({
      color: component.style.fontColor || 'var(--bs-body-color)',
    }),
    [component]
  )

  console.log(variableStyle)

  return (
    <div
      ref={$ref}
      className={cN(
        'd-flex justify-content-center align-items-center',
        `fw-${component.style.fontWeight || 'normal'}`,
        `fst-${component.style.fontStyle || 'normal'}`,
        component.style.textDecoration ? `text-decoration-${component.style.textDecoration}` : false,
        'w-100 h-100'
      )}
      style={parentStyle}
    >
      <SourceVariable name={params.source} style={variableStyle} />
    </div>
  )
}

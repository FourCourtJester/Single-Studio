// Import core components
import { useMemo } from 'react'
import { useSelector } from 'react-redux'
import { useParams } from 'react-router-dom'
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
      fontSize: `calc(2rem * ${fs})`,
    }
  }, [component, fontSize])
  const variableStyle = useMemo(
    () => ({
      color: component.style.fontColor || 'var(--bs-body-color)',
      fontWeight: component.style.fontWeight,
      fontStyle: component.style.fontStyle,
      textDecoration: component.style.textDecoration,
    }),
    [component]
  )

  console.log(variableStyle)

  return (
    <div ref={$ref} className="d-flex w-100 h-100" style={parentStyle}>
      <SourceVariable name={params.source} style={variableStyle} />
    </div>
  )
}

// Import core components
import { useParams } from 'react-router-dom'
import useFitText from 'use-fit-text'

// Import our components
import { SourceVariable } from 'components/global/styled'
import { useMemo } from 'react'

// Import style
// ...

export const Source = () => {
  // Hooks
  const params = useParams()
  const { fontSize, ref: $ref } = useFitText({
    minFontSize: 0,
  })
  // Variables
  const actualFontSize = useMemo(() => {
    const fs = Number(fontSize.slice(0, -1)) / 100
    return `calc(2rem * ${fs})`
  }, [fontSize])

  return (
    <div ref={$ref} className="d-flex w-100 h-100" style={{ fontSize: actualFontSize }}>
      <SourceVariable name={params.source} />
    </div>
  )
}

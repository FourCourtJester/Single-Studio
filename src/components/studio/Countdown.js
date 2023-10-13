// Import core components
import { useEffect, useRef, useState } from 'react'
import { useDispatch } from 'react-redux'
import { FloatingLabel, Form, InputGroup } from 'react-bootstrap'

// Import our components
import { Button } from 'components/global/styled'
import { useNamespace } from 'hooks'
import { updateStudio } from 'db/slices/studio'
import { clockDifference, dateDifference } from 'toolkits/time'
import { useTimer } from './hooks'

// Import style
// ...

function min() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth()).length === 2 ? now.getMonth() + 1 : `0${now.getMonth() + 1}`
  const day = String(now.getDate()).length === 2 ? now.getDate() : `0${now.getDate()}`

  return `${[year, month, day].join('-')}T00:00`
}

const namespace = 'timers'
const ts = '_ts'
const nput = '_input'

export const Countdown = (properties) => {
  // Properties
  const { as = 'datetime-local', label = 'Countdown', name, placeholder } = properties
  // Hooks
  const dispatch = useDispatch()
  const path = useNamespace(namespace, name)
  const { active, input, text } = useTimer({ path: `${namespace}.${name}` })
  // States
  const [disabled, setDisable] = useState(false)
  // Variables
  const paths = {
    ts: `${path}.${ts}`,
    input: `${path}.${nput}`,
  }
  // Refs
  const $ref = useRef(null)

  const handleFocus = () => {
    $ref.current?.showPicker()
  }

  const handleStart = () => {
    // Ignore zero length inputs
    if (!$ref.current.value.length) return true

    const now = new Date()

    switch (as) {
      case 'datetime-local': {
        const later = new Date($ref.current.value)

        // Ignore the past
        if (later < now) return true

        dispatch(
          updateStudio({
            [paths.ts]: dateDifference(now, later),
            [paths.input]: $ref.current.value,
          })
        )
        break
      }

      case 'time': {
        dispatch(
          updateStudio({
            [paths.ts]: clockDifference(now, $ref.current.value),
            [paths.input]: $ref.current.value,
          })
        )
        break
      }

      default:
        break
    }

    setDisable(true)
  }

  const handleStop = () => dispatch(updateStudio({ [paths.ts]: null }))

  const handleKey = (e) => {
    if (e.which === 13) {
      e.preventDefault()
      handleStart()
    }
  }

  useEffect(() => {
    setDisable(active)
  }, [active])

  return active ? (
    <Button className="d-flex flex-grow-1 justify-content-center align-items-center w-100 h-100" variant="outline-obs" onClick={handleStop}>
      {label} - {text}
    </Button>
  ) : (
    <InputGroup>
      <FloatingLabel label={label} onKeyDown={handleKey}>
        <Form.Control ref={$ref} type={as} min={min()} placeholder={placeholder} defaultValue={input || ''} onClick={handleFocus} disabled={disabled} />
      </FloatingLabel>
      <Button variant="obs" disabled={disabled} onClick={handleStart}>
        <i className="await fa fa-spin fa-spinner" />
        <i className="fas fa-play" />
      </Button>
    </InputGroup>
  )
}

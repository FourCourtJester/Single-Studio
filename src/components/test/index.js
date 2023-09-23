// Import core components
import { useEffect, useRef, useState } from 'react'
import cN from 'classnames'

// Import our components
import { useStudio } from 'hooks'
import { Variable } from 'components/global/styled/source'

function _getCSSTransitionDuration($ele) {
  return parseFloat(window.getComputedStyle($ele).transitionDuration) * 1000
}

const namespace = 'variables'
const states = {
  active: {
    class: 'active',
    flow: false,
    next: 'exit',
  },
  exit: {
    class: 'exit',
    flow: true,
    immediate: true,
    next: 'exiting',
  },
  exiting: {
    class: 'exiting',
    flow: true,
    next: 'inactive',
  },
  inactive: {
    class: 'inactive',
    content: true,
    flow: true,
    immediate: true,
    next: 'enter',
  },
  enter: {
    class: 'enter',
    flow: true,
    immediate: true,
    next: 'entering',
  },
  entering: {
    class: 'entering',
    flow: true,
    next: 'active',
  },
}

const CustomTransition = (properties) => {
  // Properties
  const { fallback, name } = properties
  // Redux
  const val = useStudio(`${namespace}.${name}`)
  // States
  const [content, setContent] = useState(undefined)
  const [props, setProps] = useState({})
  const [state, setState] = useState(states.inactive)
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const { className } = properties

    setProps({
      ...properties,
      className: cN('variable', state.class, className),
    })
  }, [properties, state])

  useEffect(() => {
    const duration = _getCSSTransitionDuration($ref.current) || 1
    let t

    console.log(state)

    if (state.flow && state?.immediate) setState(states[state.next])
    else if (state.flow) {
      t = setTimeout(() => {
        setState(states[state.next])
      }, duration)
    }

    return () => clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (state?.content) setContent(val || fallback)
  }, [fallback, state, val])

  useEffect(() => {
    setState(states.exit)
  }, [val])

  return (
    <Variable ref={$ref} {...props}>
      {content}
    </Variable>
  )
}

export default CustomTransition

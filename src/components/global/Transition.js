// Import core components
import React, { Children, cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import cN from 'classnames'

// Import our components
// ...

function _filterProps(props) {
  const validProps = ['className', 'id', 'name', 'style']
  const wildCardProps = ['data-']

  return Object.keys(props).reduce((obj, prop) => {
    if (validProps.includes(prop)) obj[prop] = props[prop]
    else if (wildCardProps.some((prefix) => prop.startsWith(prefix))) obj[prop] = props[prop]
    return obj
  }, {})
}

function _getCSSTransitionDuration($ele) {
  if (!$ele) return 1
  return parseFloat(window.getComputedStyle($ele).transitionDuration) * 1000
}

const failStates = [false, null, undefined]

const states = {
  active: {
    class: 'active',
    flow: false,
    immediate: true,
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

const Transition = (properties) => {
  // Properties
  const { children, trigger, update = ['inactive'] } = properties
  // States
  // eslint-disable-next-line react/jsx-no-useless-fragment
  const [content, setContent] = useState(<></>)
  const [props, setProps] = useState({})
  const [state, setState] = useState(states.inactive)
  // Refs
  const $ref = useRef(null)

  useEffect(() => {
    const _props = _filterProps(properties)

    setProps({
      ..._filterProps(properties),
      className: cN(state.class, _props.className),
    })
  }, [properties, state])

  useEffect(() => {
    const duration = _getCSSTransitionDuration($ref.current) || 1
    let t

    if (update.includes(state.class) && failStates.includes(trigger)) return () => clearTimeout(t)

    if (state.flow && state?.immediate) {
      setState(states[state.next])
    } else if (state.flow) {
      t = setTimeout(() => {
        setState(states[state.next])
      }, duration)
    }

    return () => clearTimeout(t)
  }, [state, trigger, update])

  useEffect(() => {
    if (update.includes(state.class)) setContent(children)
  }, [children, state, update])

  useEffect(() => {
    setState(states.exit)
  }, [trigger])

  return Children.map(content, (child) =>
    !isValidElement(child)
      ? child
      : cloneElement(child, {
          ref: $ref,
          ...props,
        })
  )
}

export { Transition }

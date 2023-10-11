// Import core components
import { Children, cloneElement, forwardRef, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

// Import our components
// ...

// Import style
// ...

export const Fit = forwardRef((properties, $forwardRef) => {
  // Properties
  const { children, delta = 2, ...props } = properties
  // States
  const [isResizing, setResizing] = useState(false)
  // Observers
  const mObserver = useMemo(() => new MutationObserver(() => setResizing(true)), [])
  const rObserver = useMemo(() => new ResizeObserver(() => setResizing(true)), [])
  // Refs
  const $localRef = useRef(null)
  const $ref = $forwardRef || $localRef

  useLayoutEffect(() => {
    if (!isResizing) return () => {}

    // console.time('resizing')

    // Element
    const $element = $ref.current

    // Parent
    const $parent = $element.parentElement
    const parentStyle = window.getComputedStyle($parent)
    let parentWidth = $parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)

    // Control variables
    let i = 0
    const fontSizes = {
      min: 0,
      max: parseFloat(parentStyle.fontSize),
    }

    // Reset the font size
    $element.style.fontSize = null

    // Success case
    if ($element.offsetWidth <= parentWidth) {
      // console.timeEnd('resizing')
      setResizing(false)
      return () => {}
    }

    while (i < 25) {
      // New font size
      const midFontSize = (fontSizes.min + fontSizes.max) / 2

      // Apply the font size
      $element.style.fontSize = `${midFontSize}px`

      // New widths
      const elementWidth = $element.offsetWidth
      parentWidth = $parent.clientWidth - parseFloat(parentStyle.paddingLeft) - parseFloat(parentStyle.paddingRight)

      // Success case
      if (elementWidth <= parentWidth && elementWidth > parentWidth - delta) break

      // Adjust
      if (elementWidth > parentWidth) fontSizes.max = midFontSize
      else fontSizes.min = midFontSize

      // Iterate
      i += 1
    }

    // console.timeEnd('resizing')
    setResizing(false)
  }, [$ref, delta, isResizing])

  useEffect(() => {
    // Apply the Mutation Observer
    mObserver.observe($ref.current.parentElement, { characterData: true, childList: true, subtree: true })

    return () => mObserver.disconnect()
  }, [$ref, mObserver])

  useEffect(() => {
    // Apply the Resize Observer
    rObserver.observe($ref.current.parentElement, { box: 'device-pixel-content-box' })

    return () => rObserver.disconnect()
  }, [$ref, rObserver])

  return Children.map(children, (child) =>
    !isValidElement(child)
      ? child
      : cloneElement(child, {
          ref: $ref,
          ...props,
        })
  )
})

Fit.displayName = 'Fit'

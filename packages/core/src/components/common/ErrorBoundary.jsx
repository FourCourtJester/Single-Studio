import { Component } from 'react'

/**
 * Catches a crash in whatever it wraps, so one broken component does not take the
 * page with it.
 *
 * What it renders afterwards is the whole design, and the answer is different on
 * the two halves of a studio -- so it is passed in rather than decided here.
 *
 * On a graphic, nothing. A browser source is composited over a live scene, and an
 * error card on air is worse than the graphic being missing: missing reads as a
 * cue not fired, while a red box reads as the broadcast being broken. React
 * unmounts a crashed tree either way, so the choice is between showing nothing and
 * showing something wrong.
 *
 * On the board, the error. It is not on air, and an operator staring at a panel
 * that silently stopped existing has no way to know whether they mis-clicked or the
 * studio broke.
 *
 * Either way the error reaches the console, because the console is the one place
 * both halves agree on and the only one an author is reading.
 */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    const where = this.props.label ? ` in ${this.props.label}` : ''

    console.error(`[single-studio] a component crashed${where}`, error, info?.componentStack)
    this.props.onError?.(error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return this.props.fallback?.(this.state.error, () => this.setState({ error: null })) ?? null
  }
}

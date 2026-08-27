/**
 * Renders a cents value as currency, and briefly flashes gold whenever the
 * value increases (e.g. right after revenue is logged). Presentational, with a
 * small amount of local animation state.
 */

import { useEffect, useRef, useState } from 'react'

import { formatCents } from '../format.js'

function AnimatedCents({ value }) {
  // remember the value from the previous render to detect an increase
  const previous = useRef(value)
  const [flashing, setFlashing] = useState(false)

  useEffect(() => {
    if (value > previous.current) {
      setFlashing(true)
      const timer = setTimeout(() => setFlashing(false), 1100)
      previous.current = value
      return () => clearTimeout(timer)
    }
    previous.current = value
  }, [value])

  return (
    <span className={flashing ? 'cents flash' : 'cents'}>
      {formatCents(value)}
    </span>
  )
}

export default AnimatedCents

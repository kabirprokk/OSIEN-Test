import { useRef } from 'react'

export default function SpotlightCard({ children, className = '', ...props }) {
  const ref = useRef(null)
  const onPointerMove = (event) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    ref.current.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    ref.current.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
    ref.current.style.setProperty('--spot-opacity', '1')
  }
  const onPointerLeave = () => ref.current?.style.setProperty('--spot-opacity', '0')
  return <section ref={ref} className={`spotlight-card ${className}`} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} {...props}>{children}<span className="spotlight-follow" aria-hidden="true" /></section>
}

import './BorderBeam.css'

export function BorderBeam({
  size = 40,
  initialOffset = 20,
  className = '',
  transition = {},
}) {
  const duration = transition.duration ?? 6
  const delay = transition.delay ?? 0
  const springSpeed = transition.stiffness ? Math.max(2, 360 / transition.stiffness) : duration

  return (
    <span
      aria-hidden="true"
      className={`border-beam ${className}`.trim()}
      style={{
        '--beam-size': `${Math.max(8, size)}px`,
        '--beam-span': `${Math.min(45, Math.max(5, size / 4))}%`,
        '--beam-offset': `${initialOffset}deg`,
        '--beam-duration': `${springSpeed}s`,
        '--beam-delay': `${delay}s`,
      }}
    />
  )
}

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { HugeiconsIcon } from '@hugeicons/react'
import { SparklesIcon, Tick02Icon } from '@hugeicons/core-free-icons'

export default function ThoughtLine({ working, label, steps = [], onSettle }) {
  const reduce = useReducedMotion()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!working) return undefined
    const start = performance.now()
    const timer = setInterval(() => setElapsed((performance.now() - start) / 1000), 100)
    return () => clearInterval(timer)
  }, [working])
  useEffect(() => {
    if (!working && elapsed > 0) onSettle?.(elapsed)
  }, [working])
  return <div className="thought-line" role="status" aria-live="polite">
    <motion.span className="thought-glyph" animate={working && !reduce ? { opacity: [0.48, 1, 0.48], rotate: [0, 12, 0] } : { opacity: 1, rotate: 0 }} transition={working && !reduce ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.25 }}><HugeiconsIcon icon={working ? SparklesIcon : Tick02Icon} size={16} /></motion.span>
    <div className="thought-content"><strong>{label}</strong>{steps.length > 0 && <div className="thought-steps">{steps.map((step, index) => <motion.span key={`${step}-${index}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>{!working || index < steps.length - 1 ? <HugeiconsIcon icon={Tick02Icon} size={12} /> : <i className="thought-pulse" />}{step}</motion.span>)}</div>}</div>
    {working && <small className="thought-timer">{elapsed.toFixed(1)}s</small>}
  </div>
}

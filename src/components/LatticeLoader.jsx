import { useEffect, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick02Icon, Cancel01Icon } from '@hugeicons/core-free-icons'

export default function LatticeLoader({ status = 'working', label = 'Working', elapsed = 0, pattern = 'orbit' }) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (status !== 'working') return undefined
    const start = performance.now()
    const timer = setInterval(() => setSeconds(Math.floor((performance.now() - start) / 100) / 10), 100)
    return () => clearInterval(timer)
  }, [status])
  const delays = pattern === 'sweep' ? [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6] : [0, 1, 2, 7, -1, 3, 6, 5, 4]
  return <span className="lattice-loader" data-status={status} role="status" aria-live="polite">
    {status === 'working' && <span className="lattice-grid" data-size={delays.length === 16 ? 4 : 3} aria-hidden="true">{delays.map((delay, index) => <i key={index} style={{ '--delay': `${delay * 90}ms` }} />)}</span>}
    <span>{label}</span>
    {status === 'done' && <HugeiconsIcon icon={Tick02Icon} size={15} />}
    {status === 'error' && <HugeiconsIcon icon={Cancel01Icon} size={15} />}
    {status === 'working' && <small>{(elapsed || seconds).toFixed(1)}s</small>}
  </span>
}

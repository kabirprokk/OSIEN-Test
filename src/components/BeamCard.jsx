import { BorderBeam } from './BorderBeam.jsx'

export default function BeamCard({ as: Element = 'div', className = '', children, ...props }) {
  return (
    <Element className={`beam-card ${className}`.trim()} {...props}>
      {children}
      <BorderBeam size={100} transition={{ duration: 8 }} />
    </Element>
  )
}

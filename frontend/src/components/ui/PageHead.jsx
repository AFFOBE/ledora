import { badgeClass } from '../../utils/helpers'

export default function PageHead({ title, sub, children }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      {children}
    </div>
  )
}

export function StatusBadge({ s }) {
  return <span className={`badge ${badgeClass(s)}`}>{s}</span>
}
import { badgeClass } from '../../utils/helpers'

export default function Badge({ s }) {
  return <span className={`badge ${badgeClass(s)}`}>{s}</span>
}
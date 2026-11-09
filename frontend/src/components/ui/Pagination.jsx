export default function Pagination({ total, current, pageSize, onChange }) {
  const count = Math.max(1, Math.ceil(total / pageSize))
  return (
    <div className="pagination">
      <span className="sub" />
      <div className="pages">
        {Array.from({ length: count }, (_, i) => i + 1).map((p) => (
          <button key={p} className={`btn ${p === current ? 'sel' : ''}`} onClick={() => onChange(p)}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
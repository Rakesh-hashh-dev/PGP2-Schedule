export default function CancellationVisibilitySelect({ value, onChange, label = "After cancellation" }) {
  return (
    <label className="admin-field cancellation-visibility-select" style={{ minWidth: 0 }}>
      <span>{label}</span>
      <select className="admin-input" value={value} onChange={e => onChange(e.target.value)}>
        <option value="show">Show as cancelled</option>
        <option value="hide">Hide from schedule</option>
      </select>
    </label>
  );
}

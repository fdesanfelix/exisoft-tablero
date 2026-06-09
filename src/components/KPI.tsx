interface KPIProps {
  label: string;
  value: string | number;
  meta?: string;
  variant?: 'total' | 'hours' | 'on' | 'at' | 'off' | 'alert';
}
export function KPI({ label, value, meta, variant = 'total' }: KPIProps) {
  return (
    <div className={`kpi k-${variant}`}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {meta && <div className="kpi-meta">{meta}</div>}
    </div>
  );
}

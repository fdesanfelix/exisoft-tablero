import { useMemo } from 'react';
import type { useStore } from '../data/storage';
import { SortableTh, useSort } from '../components/Sort';

type Store = ReturnType<typeof useStore>;

export function AlertasView({ store }: { store: Store }) {
  const activos = store.servicios.filter(s => s.estado === 'En curso');

  const bloqueos = useMemo(() => {
    const items: { proyecto: string; cliente: string; titulo: string; desc: string; owner: string; estado: string; escalado: boolean }[] = [];
    activos.forEach(s => s.bloqueos.forEach(b => {
      if (b.estado !== 'Cerrado') items.push({ proyecto: s.nombre, cliente: s.cliente, titulo: b.titulo, desc: b.desc, owner: b.owner, estado: b.estado, escalado: b.escalado });
    }));
    return items.sort((a, b) => Number(b.escalado) - Number(a.escalado));
  }, [activos]);

  const horasAgotandose = useMemo(() => {
    return activos.filter(s => s.horasCont != null && s.horasCons != null && s.horasCont > 0)
      .map(s => ({ ...s, pct: ((s.horasCons! / s.horasCont!) * 100) }))
      .filter(s => s.pct >= 80);
  }, [activos]);

  const certVencidas = useMemo(() => {
    return activos.filter(s => s.alertas?.some(a => /vencid|sin OC|pendiente/i.test(a)) || s.tieneOC === false);
  }, [activos]);

  type HK = 'nombre' | 'cliente' | 'pct' | 'horasRest';
  const horasSort = useSort<typeof horasAgotandose[number], HK>(horasAgotandose, (s, k) => (s as any)[k], 'pct', 'desc');

  type CK = 'nombre' | 'cliente' | 'tieneOC';
  const certSort = useSort<typeof certVencidas[number], CK>(certVencidas, (s, k) => (s as any)[k], 'nombre');

  return (
    <>
      <div className="view-hero">
        <h1>Centro de <span style={{ color: 'var(--red)' }}>Alertas</span></h1>
        <p>Bloqueos, fechas vencidas, certificaciones pendientes y horas agotándose</p>
      </div>

      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Bloqueos por Proyecto</div>
          {bloqueos.length === 0 ? (
            <div style={{ color: 'var(--gray-mute)', fontSize: 12, padding: 12 }}>Sin bloqueos activos</div>
          ) : bloqueos.map((b, i) => (
            <div key={i} className={`alert-box ${b.escalado ? '' : 'warn'}`}>
              <span style={{ fontSize: 16 }}>{b.escalado ? '🔴' : '🟠'}</span>
              <div>
                <strong>{b.proyecto}</strong> ({b.cliente}) — {b.titulo}
                <small style={{ display: 'block', color: 'var(--gray-mute)' }}>{b.desc} · Owner: {b.owner} · {b.estado}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="panel">
          <div className="panel-title">Horas agotándose (≥80% consumido)</div>
          {horasAgotandose.length === 0 ? (
            <div style={{ color: 'var(--gray-mute)', fontSize: 12, padding: 12 }}>Sin alertas de horas</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <SortableTh field="nombre" sort={horasSort.sort}>Servicio</SortableTh>
                  <SortableTh field="cliente" sort={horasSort.sort}>Cliente</SortableTh>
                  <SortableTh field="pct" sort={horasSort.sort}>% Consumido</SortableTh>
                  <SortableTh field="horasRest" sort={horasSort.sort}>Restan</SortableTh>
                </tr>
              </thead>
              <tbody>
                {horasSort.sorted.map(s => (
                  <tr key={s.id}>
                    <td><strong>{s.nombre}</strong></td>
                    <td>{s.cliente}</td>
                    <td>
                      <div className="progress-track" style={{ width: 80 }}>
                        <div className="progress-fill" style={{ width: `${Math.min(s.pct, 100)}%`, background: s.pct >= 95 ? 'var(--red)' : 'var(--orange)' }} />
                      </div>
                      <span className="mono" style={{ marginLeft: 4 }}>{Math.round(s.pct)}%</span>
                    </td>
                    <td className="mono">{s.horasRest ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-title">Certificaciones vencidas / sin OC</div>
        {certVencidas.length === 0 ? (
          <div style={{ color: 'var(--gray-mute)', fontSize: 12, padding: 12 }}>Sin alertas de certificación</div>
        ) : (
          <table>
            <thead>
              <tr>
                <SortableTh field="nombre" sort={certSort.sort}>Servicio</SortableTh>
                <SortableTh field="cliente" sort={certSort.sort}>Cliente</SortableTh>
                <SortableTh field="tieneOC" sort={certSort.sort}>OC</SortableTh>
                <th>Alertas</th>
              </tr>
            </thead>
            <tbody>
              {certSort.sorted.map(s => (
                <tr key={s.id}>
                  <td><strong>{s.nombre}</strong></td>
                  <td>{s.cliente}</td>
                  <td>{s.tieneOC === false ? <span className="pill venc">Sin OC</span> : <span className="pill ok">Con OC</span>}</td>
                  <td>{s.alertas?.map((a, i) => <span key={i} className="chip" style={{ marginRight: 4 }}>{a}</span>)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

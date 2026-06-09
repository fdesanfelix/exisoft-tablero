import { useMemo } from 'react';
import type { useStore } from '../data/storage';
import { TipoBadge, EstadoBadge, PaisBadge } from '../components/Badges';
import { SortableTh, useSort } from '../components/Sort';
import { CAPACIDAD_MENSUAL_DEFAULT, type Cliente, type Servicio } from '../types';
import { showToast } from '../components/Toast';

type Store = ReturnType<typeof useStore>;

interface ClienteRow { cliente: Cliente | undefined; nombre: string; pais: string; servicios: Servicio[]; }

export function ClientesView({ store }: { store: Store }) {
  const clientes: ClienteRow[] = useMemo(() => {
    const map = new Map<string, ClienteRow>();
    store.servicios.forEach(s => {
      const k = s.cliente;
      if (!map.has(k)) {
        const c = store.clientes.find(x => x.nombre === k);
        map.set(k, { cliente: c, nombre: s.cliente, pais: s.pais, servicios: [] });
      }
      map.get(k)!.servicios.push(s);
    });
    return Array.from(map.values()).sort((a, b) => b.servicios.length - a.servicios.length);
  }, [store.servicios, store.clientes]);

  const cambiarCapacidad = (row: ClienteRow, valor: number) => {
    let c = row.cliente;
    if (!c) {
      // Cliente no estaba persistido aún (caso de servicios creados antes de poblar clientes).
      // Lo creamos al editarlo.
      c = { id: Date.now(), nombre: row.nombre, pais: row.pais as Cliente['pais'], capacidadMensual: valor };
    } else {
      c = { ...c, capacidadMensual: valor };
    }
    store.upsertCliente(c);
    showToast(`Capacidad de ${row.nombre} actualizada a ${valor} hs/mes`);
  };

  return (
    <>
      <div className="view-hero">
        <h1>Cartera de <span className="accent">Clientes</span></h1>
        <p>Qué servicios contrata cada cliente — horas y estado</p>
      </div>

      <div className="grid-2">
        {clientes.map(c => {
          const vivos = c.servicios.filter(s => s.estado !== 'Cerrado');
          const activos = c.servicios.filter(s => s.estado === 'En curso');
          // Cartera viva (excluye servicios cerrados) — refleja la relación actual con el cliente
          const hcontV = vivos.reduce((a, s) => a + (s.horasCont || 0), 0);
          const hconsV = vivos.reduce((a, s) => a + (s.horasCons || 0), 0);
          // Histórico total (incluye todo) — útil para ver el peso comercial acumulado del cliente
          const hcontT = c.servicios.reduce((a, s) => a + (s.horasCont || 0), 0);
          const hconsT = c.servicios.reduce((a, s) => a + (s.horasCons || 0), 0);
          const alertas = vivos.filter(s => s.alertas?.length).length;
          return (
            <div key={c.nombre} className="panel">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 160px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-dark)' }}>{c.nombre}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 2 }}>
                    <PaisBadge pais={c.pais as 'AR' | 'PE'} /> · {activos.length} activos / {c.servicios.length} totales
                  </div>
                  {alertas > 0 && <span className="chip" style={{ marginTop: 6, display: 'inline-block' }}>{alertas} alertas</span>}
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Cartera viva</div>
                    <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--orange)' }}>
                      {hcontV > 0 ? hcontV.toLocaleString() : '—'}
                      <span style={{ color: 'var(--gray-mute)' }}> / {hconsV > 0 ? hconsV.toLocaleString() : '—'}</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--gray-mute)' }}>cont. / cons.</div>
                  </div>
                  {hcontT !== hcontV && (
                    <div style={{ textAlign: 'right', paddingLeft: 12, borderLeft: '1px dashed var(--gray-line)' }}>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Histórico total</div>
                      <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-dark)' }}>
                        {hcontT.toLocaleString()}
                        <span style={{ color: 'var(--gray-mute)' }}> / {hconsT.toLocaleString()}</span>
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--gray-mute)' }}>incluye cerrados</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', background: '#fafafa', border: '1px solid var(--gray-line)', borderRadius: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Capacidad mensual estándar</span>
                <input type="number" min={1} max={300} step={1}
                  defaultValue={c.cliente?.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT}
                  onBlur={e => {
                    const v = Number(e.target.value);
                    if (!v || v <= 0) return;
                    const actual = c.cliente?.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT;
                    if (v !== actual) cambiarCapacidad(c, v);
                  }}
                  style={{ width: 64, height: 28, fontSize: 12, padding: '2px 6px', textAlign: 'center' }} />
                <span style={{ fontSize: 11, color: 'var(--gray-mute)' }}>hs/mes</span>
                {(c.cliente?.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT) !== CAPACIDAD_MENSUAL_DEFAULT && (
                  <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, marginLeft: 'auto' }}>· custom</span>
                )}
              </div>
              <ServiciosClienteTabla servicios={c.servicios} />
            </div>
          );
        })}
      </div>
    </>
  );
}

function ServiciosClienteTabla({ servicios }: { servicios: Servicio[] }) {
  type K = 'nombre' | 'tipo' | 'estado' | 'horasRest';
  const { sorted, sort } = useSort<Servicio, K>(servicios, (s, k) => (s as any)[k], 'nombre');
  return (
    <table>
      <thead>
        <tr>
          <SortableTh field="nombre" sort={sort}>Servicio</SortableTh>
          <SortableTh field="tipo" sort={sort}>Tipo</SortableTh>
          <SortableTh field="estado" sort={sort}>Estado</SortableTh>
          <SortableTh field="horasRest" sort={sort}>Restan</SortableTh>
        </tr>
      </thead>
      <tbody>
        {sorted.map(s => (
          <tr key={s.id}>
            <td><strong>{s.nombre}</strong></td>
            <td><TipoBadge tipo={s.tipo} /></td>
            <td><EstadoBadge estado={s.estado} /></td>
            <td className="mono">{s.horasRest ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

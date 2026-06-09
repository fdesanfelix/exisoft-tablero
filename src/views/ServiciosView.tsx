import { useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { KPI } from '../components/KPI';
import { PaisBadge, TipoBadge, EstadoBadge } from '../components/Badges';
import { SortableTh, useSort } from '../components/Sort';
import { ServicioModal } from './ServicioModal';
import { ServicioDetail } from './ServicioDetail';
import { showToast } from '../components/Toast';
import {
  ANIO_ACTUAL, ESTADOS_SERVICIO, HOY, MES_ACTUAL, parseDate, TIPOS_SERVICIO,
  type MiembroEquipo, type Rol, type Servicio,
} from '../types';

type Store = ReturnType<typeof useStore>;
const PAISES = ['PE', 'AR', 'OTROS'] as const;

type SortKey = 'cliente' | 'nombre' | 'pais' | 'tipo' | 'estado' | 'inicio' | 'fin' | 'horasCont' | 'horasCons' | 'horasRest' | 'certif';

// Próximo evento del servicio: el primer hito no cumplido futuro, sino la fecha fin estimada.
function proximoHito(s: Servicio): { fecha: string; label: string } | null {
  const hitos = (s.hitos || [])
    .filter(h => !h.cumplido && h.fechaCert)
    .map(h => ({ fecha: h.fechaCert, label: h.nombre, date: parseDate(h.fechaCert) }))
    .filter(h => h.date)
    .sort((a, b) => (a.date!.getTime() - b.date!.getTime()));
  if (hitos.length > 0) return { fecha: hitos[0].fecha, label: hitos[0].label };
  if (s.fin && s.fin !== '—' && s.fin !== 'TBD') {
    const fd = parseDate(s.fin);
    if (fd) return { fecha: s.fin, label: 'Fin estimado' };
  }
  return null;
}

export function ServiciosView({ store, rol, usuario, onGoToAvances }: {
  store: Store; rol: Rol; usuario: string;
  onGoToAvances?: (servicioId: number) => void;
}) {
  const [fPais, setFPais] = useState<string>('all');
  const [fTipo, setFTipo] = useState<string>('all');
  const [fEstado, setFEstado] = useState<string>('activos'); // ← default: activos (excluye cerrados)
  const [fAnio, setFAnio] = useState<string>(String(ANIO_ACTUAL));
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Servicio | null>(null);
  const [viewing, setViewing] = useState<Servicio | null>(null);
  const [openNew, setOpenNew] = useState(false);
  // Servicios = vista de Gerencia de Servicios. El PM puede mirar pero no edita
  // (el PM gestiona desde Gestión de Proyectos). Comercial es read-only por defecto.
  const puedeEditar = rol === 'GerenciaServicios' || rol === 'DirectorServicios';

  // Años disponibles (basado en fin del servicio o fecha de cierre)
  const aniosDisponibles = useMemo(() => {
    const set = new Set<number>();
    store.servicios.forEach(s => {
      const fc = s.cierreServicios?.fecha ? parseDate(s.cierreServicios.fecha) : null;
      const ff = parseDate(s.fin);
      if (fc) set.add(fc.getFullYear());
      else if (ff) set.add(ff.getFullYear());
      else set.add(ANIO_ACTUAL);
    });
    return [...set].sort((a, b) => b - a);
  }, [store.servicios]);

  // Ventana en días durante la que un servicio cerrado sigue apareciendo en "Activos"
  // antes de pasar a Historial. Configurable en Admin más adelante.
  const VENTANA_HISTORIAL_DIAS = 60;

  const diasDesdeCierre = (s: Servicio): number | null => {
    const fc = s.cierreServicios?.fecha ? parseDate(s.cierreServicios.fecha) : null;
    if (!fc) return null;
    return Math.floor((HOY.getTime() - fc.getTime()) / 86400000);
  };

  const filtrados = useMemo(() => store.servicios.filter(s => {
    if (fPais !== 'all') {
      if (fPais === 'OTROS' && (s.pais === 'PE' || s.pais === 'AR')) return false;
      if (fPais !== 'OTROS' && s.pais !== fPais) return false;
    }
    if (fTipo !== 'all' && s.tipo !== fTipo) return false;

    // Filtro de Estado — modos compuestos
    if (fEstado === 'activos') {
      // Activos = todo lo no-Cerrado + los Cerrado dentro de la ventana de 60 días
      if (s.estado === 'Cerrado') {
        const d = diasDesdeCierre(s);
        if (d == null || d > VENTANA_HISTORIAL_DIAS) return false;
      }
    } else if (fEstado === 'historial') {
      // Historial = solo los Cerrado fuera de la ventana (más de 60 días)
      if (s.estado !== 'Cerrado') return false;
      const d = diasDesdeCierre(s);
      if (d == null || d <= VENTANA_HISTORIAL_DIAS) return false;
    } else if (fEstado === 'all') {
      // Todos los estados — sin filtro
    } else {
      // Estado específico
      if (s.estado !== fEstado) return false;
    }

    if (fAnio !== 'all') {
      const fc = s.cierreServicios?.fecha ? parseDate(s.cierreServicios.fecha) : null;
      const ff = parseDate(s.fin);
      const anio = fc ? fc.getFullYear() : ff ? ff.getFullYear() : ANIO_ACTUAL;
      if (anio !== Number(fAnio)) return false;
    }
    if (q && !s.cliente.toLowerCase().includes(q.toLowerCase()) && !s.nombre.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [store.servicios, fPais, fTipo, fEstado, fAnio, q]);

  const { sorted, sort } = useSort<Servicio, SortKey>(
    filtrados,
    (s, k) => s[k] as string | number | null,
    'cliente',
  );

  const kpis = useMemo(() => {
    // KPIs siempre sobre lo NO cerrado, independiente del filtro local. Si el usuario
    // está viendo el Historial, los KPIs siguen mostrando la cartera viva.
    const baseKpis = filtrados.filter(s => s.estado !== 'Cerrado');
    const activos = baseKpis.filter(s => s.estado === 'En curso');
    const totalCont = baseKpis.reduce((a, s) => a + (s.horasCont || 0), 0);
    const totalCons = baseKpis.reduce((a, s) => a + (s.horasCons || 0), 0);
    const alertas = baseKpis.filter(s => s.alertas?.length).length;
    const certPend = baseKpis.filter(s => s.certificaciones?.[MES_ACTUAL] === 'Pendiente').length;
    return { activos: activos.length, totalCont, totalCons, alertas, certPend };
  }, [filtrados]);

  // Guardar servicio + sincronizar el equipo (PROFESIONAL_SERVICIO)
  const saveServicio = (srv: Servicio, equipo: MiembroEquipo[]) => {
    // Si el servicio nuevo heredó horas de un padre cerrado, actualizar el padre
    // para que registre el traslado (saldoCierre='Trasladadas' + cantidad).
    if (srv.horasHeredadas && srv.horasHeredadasDeId) {
      const padre = store.servicios.find(x => x.id === srv.horasHeredadasDeId);
      const prevHeredadas = editing?.horasHeredadas ?? 0;
      const delta = srv.horasHeredadas - prevHeredadas;
      // Solo si hay un cambio neto vs el estado anterior del servicio editado.
      if (padre && delta !== 0) {
        const yaTrasladado = padre.horasTrasladadasCant || 0;
        store.upsertServicio({
          ...padre,
          horasTrasladadasAId: srv.id,
          horasTrasladadasCant: yaTrasladado + delta,
          saldoCierre: 'Trasladadas',
        });
      }
    }

    store.upsertServicio(srv);

    // Sincronizar asignaciones en los recursos afectados
    const idsActuales = new Set(equipo.map(m => m.recursoId));
    const idsPrevios = new Set(
      store.recursos.filter(r => r.asignaciones.some(a => a.servicioId === srv.id)).map(r => r.id),
    );
    const ids = new Set([...idsActuales, ...idsPrevios]);

    ids.forEach(rid => {
      const r = store.recursos.find(x => x.id === rid);
      if (!r) return;
      const otros = (r.asignaciones || []).filter(a => a.servicioId !== srv.id);
      const nuevos = equipo
        .filter(m => m.recursoId === rid)
        .map(m => ({
          servicioId: srv.id,
          // Si el % en el modal es 0 (estaba en auto), no lo guardamos como override.
          porcentaje: m.porcentaje && m.porcentaje > 0 ? m.porcentaje : undefined,
          perfil: m.perfil,
          seniority: m.seniority,
          fechaDesde: m.fechaDesde,
          fechaHasta: m.fechaHasta,
        }));
      store.upsertRecurso({ ...r, asignaciones: [...otros, ...nuevos] });
    });

    showToast(editing ? 'Servicio actualizado' : 'Servicio creado');
    setEditing(null); setOpenNew(false);
  };

  return (
    <>
      <div className="view-hero">
        <h1>Control de <span className="accent">Servicios</span></h1>
        <p>Horas contratadas, consumidas, fechas de cierre y estado operativo (filtro inicial: activos)</p>
      </div>

      <div className="kpi-grid">
        <KPI label="Servicios Activos" value={kpis.activos} meta="en cartera" variant="total" />
        <KPI label="Hs Contratadas" value={kpis.totalCont > 0 ? kpis.totalCont.toLocaleString() : '—'} meta="totales" variant="hours" />
        <KPI label="Hs Consumidas" value={kpis.totalCons > 0 ? kpis.totalCons.toLocaleString() : '—'} meta="acumuladas" variant="hours" />
        <KPI label="Alertas Críticas" value={kpis.alertas} meta="requieren acción" variant="alert" />
        <KPI label="Certif. Pendientes" value={kpis.certPend} meta="mes en curso" variant="at" />
      </div>

      <div className="svc-toolbar">
        <input className="svc-search svc-search-compact" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar…" />
        <select className="svc-select" value={fEstado} onChange={e => setFEstado(e.target.value)}>
          <option value="activos">Activos (+ cerrados &lt; 60d)</option>
          <option value="historial">Historial</option>
          <option value="all">Todos los estados</option>
          {ESTADOS_SERVICIO.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <select className="svc-select" value={fTipo} onChange={e => setFTipo(e.target.value)}>
          <option value="all">Todos los tipos</option>
          {TIPOS_SERVICIO.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="svc-select" value={fPais} onChange={e => setFPais(e.target.value)}>
          <option value="all">Todos los países</option>
          {PAISES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="svc-select svc-select-anio" value={fAnio} onChange={e => setFAnio(e.target.value)}>
          <option value="all">Todos los años</option>
          {aniosDisponibles.map(a => <option key={a} value={String(a)}>{a}</option>)}
        </select>
        {puedeEditar && <button className="btn btn-primary svc-new-btn" onClick={() => setOpenNew(true)}>+ Nuevo</button>}
      </div>
      {/* Chips de filtros activos — para limpiarlos de a uno */}
      {(fPais !== 'all' || fTipo !== 'all' || fEstado !== 'activos' || fAnio !== String(ANIO_ACTUAL) || q) && (
        <div className="svc-active-chips">
          {fEstado !== 'activos' && (
            <span className="svc-chip" onClick={() => setFEstado('activos')}>
              {fEstado === 'all' ? 'Todos los estados' : fEstado} <span className="svc-chip-x">×</span>
            </span>
          )}
          {fTipo !== 'all' && (
            <span className="svc-chip" onClick={() => setFTipo('all')}>
              {fTipo} <span className="svc-chip-x">×</span>
            </span>
          )}
          {fPais !== 'all' && (
            <span className="svc-chip" onClick={() => setFPais('all')}>
              {fPais} <span className="svc-chip-x">×</span>
            </span>
          )}
          {fAnio !== String(ANIO_ACTUAL) && (
            <span className="svc-chip" onClick={() => setFAnio(String(ANIO_ACTUAL))}>
              Año {fAnio === 'all' ? 'todos' : fAnio} <span className="svc-chip-x">×</span>
            </span>
          )}
          {q && (
            <span className="svc-chip" onClick={() => setQ('')}>
              "{q}" <span className="svc-chip-x">×</span>
            </span>
          )}
          <button className="svc-chip-clear" onClick={() => { setFPais('all'); setFTipo('all'); setFEstado('activos'); setFAnio(String(ANIO_ACTUAL)); setQ(''); }}>limpiar todo</button>
        </div>
      )}

      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table>
          <thead>
            <tr>
              <SortableTh field="cliente" sort={sort} style={{ width: '15%' }}>Cliente</SortableTh>
              <SortableTh field="nombre" sort={sort} style={{ width: '32%' }}>Servicio</SortableTh>
              <SortableTh field="tipo" sort={sort} style={{ width: '11%' }}>Tipo</SortableTh>
              <SortableTh field="estado" sort={sort} style={{ width: '10%' }}>Estado</SortableTh>
              <SortableTh field="horasCont" sort={sort} style={{ width: '17%' }}>Horas</SortableTh>
              <th style={{ width: '15%' }}>Próximo</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Sin resultados</td></tr>
            )}
            {sorted.map(s => {
              const pct = s.horasCont ? Math.round(((s.horasCons || 0) / s.horasCont) * 100) : null;
              const tieneCritica = s.alertas?.some(a => /crítica|vencida|agotad/i.test(a));
              const cerrado = s.estado === 'Cerrado';
              const rowCls = cerrado ? 'svc-row-cerrado' : tieneCritica ? 'alert-row' : s.alertas?.length ? 'warn-row' : '';
              const barColor = pct == null ? '' : pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--green)';
              const proximo = proximoHito(s);
              return (
                <tr key={s.id} className={rowCls} onClick={() => setViewing(s)} style={{ cursor: 'pointer' }}>
                  <td><strong>{s.cliente}</strong>
                    <div className="svc-row-pais"><PaisBadge pais={s.pais} /></div>
                  </td>
                  <td>
                    <div className="svc-row-nombre">{s.nombre}</div>
                    {s.alertas && s.alertas.length > 0 && (
                      <div className="svc-row-alertas">
                        {s.alertas.slice(0, 2).map((a, i) => <span key={i} className="chip" style={{ marginRight: 4 }}>{a}</span>)}
                        {s.alertas.length > 2 && <span style={{ fontSize: 10, color: 'var(--gray-mute)' }}>+{s.alertas.length - 2}</span>}
                      </div>
                    )}
                  </td>
                  <td><TipoBadge tipo={s.tipo} /></td>
                  <td><EstadoBadge estado={s.estado} /></td>
                  <td>
                    {s.horasCont != null ? (
                      <>
                        <div className="svc-row-horas">
                          <span className="mono" style={{ fontWeight: 700 }}>{(s.horasCons || 0).toLocaleString()}</span>
                          <span style={{ color: 'var(--gray-mute)', fontSize: 11 }}>/ {s.horasCont.toLocaleString()} hs</span>
                          {pct != null && <span className="mono" style={{ fontSize: 11, color: barColor, fontWeight: 700, marginLeft: 'auto' }}>{pct}%</span>}
                        </div>
                        {pct != null && <div className="progress-track" style={{ marginTop: 4 }}>
                          <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                        </div>}
                      </>
                    ) : <span style={{ color: 'var(--gray-mute)', fontSize: 12 }}>—</span>}
                  </td>
                  <td>
                    {proximo ? (
                      <div className="svc-row-proximo">
                        <div className="mono" style={{ fontSize: 11 }}>{proximo.fecha}</div>
                        <div style={{ fontSize: 10, color: 'var(--gray-mute)' }}>{proximo.label}</div>
                      </div>
                    ) : <span style={{ color: 'var(--gray-mute)', fontSize: 12 }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ServicioDetail
        open={viewing != null}
        servicio={viewing}
        recursos={store.recursos}
        servicios={store.servicios}
        clientes={store.clientes}
        avances={store.avances}
        rol={rol}
        usuario={usuario}
        onGoToAvances={onGoToAvances ? (id => { onGoToAvances(id); setViewing(null); }) : undefined}
        onClose={() => setViewing(null)}
        onEdit={() => { if (viewing) { setEditing(viewing); setViewing(null); } }}
        onDelete={() => {
          if (!viewing) return;
          if (!confirm('¿Eliminar este servicio?')) return;
          store.deleteServicio(viewing.id);
          showToast('Servicio eliminado');
          setViewing(null);
        }}
        onCierre={s => {
          store.upsertServicio(s);
          showToast(`Servicio "${s.nombre}" → ${s.estado}`);
          setViewing(s);
        }}
      />

      <ServicioModal
        open={openNew || editing != null}
        servicio={editing}
        recursos={store.recursos}
        servicios={store.servicios}
        clientes={store.clientes}
        perfiles={store.perfiles}
        seniorities={store.seniorities}
        categoriasBloqueo={store.categoriasBloqueo}
        usuario={usuario}
        onClose={() => { setEditing(null); setOpenNew(false); }}
        onSave={saveServicio}
        onDelete={id => {
          if (!confirm('¿Eliminar este servicio?')) return;
          store.deleteServicio(id);
          showToast('Servicio eliminado');
          setEditing(null);
        }}
      />
    </>
  );
}

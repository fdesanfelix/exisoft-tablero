import { useEffect, useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { MacroplanPanel } from './MacroplanPanel';
import {
  ddmmaaaa, HOY, historialAvances, inferirEstadoAvance, lunesDeSemana, nombreCompleto, parseDate,
  pctAvanceGlobal, pmsDe, equipoDe, resumenAutoPulso, tareasAtrasadasAt, tareasCerradasEnRango, tareasDe,
  TIPO_CAMBIO_LABEL, ultimoAvance,
  severidadRiesgo,
  type Avance, type Bloqueo, type CambioServicio, type EstadoAvance, type HitoServicio,
  type NivelImpacto, type NivelProbabilidad, type Recurso, type Riesgo, type Rol, type Servicio,
} from '../types';
import { RegistrarAlcanceModal, RegistrarCambioFechaModal } from './CambioModals';
import { BloqueoEditModal, RiesgoEditModal } from './BloqueoRiesgoModals';

type Store = ReturnType<typeof useStore>;
type Mode = { kind: 'dashboard' } | { kind: 'proyecto'; servicioId: number };

export function AvancesView({ store, usuario, rol, initialServicioId, onConsumedInitial }: {
  store: Store;
  usuario: string;
  rol: Rol;
  initialServicioId?: number | null;
  onConsumedInitial?: () => void;
}) {
  const [mode, setMode] = useState<Mode>(
    initialServicioId ? { kind: 'proyecto', servicioId: initialServicioId } : { kind: 'dashboard' }
  );

  // Si llega un deep-link entrante, navegamos al proyecto y notificamos a App que se consumió.
  useEffect(() => {
    if (initialServicioId) {
      setMode({ kind: 'proyecto', servicioId: initialServicioId });
      onConsumedInitial?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialServicioId]);

  if (mode.kind === 'dashboard') {
    return <Dashboard store={store} onOpenProyecto={id => setMode({ kind: 'proyecto', servicioId: id })} />;
  }
  return (
    <ProyectoDetalle
      store={store}
      usuario={usuario}
      rol={rol}
      servicioId={mode.servicioId}
      onBack={() => setMode({ kind: 'dashboard' })}
    />
  );
}

// ============================================================
// DASHBOARD — vista única, último avance por proyecto
// ============================================================
function Dashboard({ store, onOpenProyecto }: { store: Store; onOpenProyecto: (id: number) => void }) {
  const [filtro, setFiltro] = useState<'all' | EstadoAvance | 'sin-pulso'>('all');
  const [q, setQ] = useState('');
  // Eliminado: la carga ya no se hace desde el dashboard, sino desde el panel
  // "Pulso en vivo" dentro de cada proyecto. Carga manual del modal solo queda
  // como path de edición de avances históricos (en el detalle).

  // Proyectos gestionables: TODOS los servicios con seguimiento activos —
  // tengan o no avances cargados. El "ultimo" puede ser null si todavía no hay pulsos.
  const proyectos = useMemo(() => {
    return store.servicios
      .filter(s => s.seguimientoAvances && s.estado !== 'Cerrado')
      .map(s => ({ s, ultimo: ultimoAvance(store.avances, s.id) }));
  }, [store.servicios, store.avances]);

  const filtrados = useMemo(() => proyectos.filter(({ s, ultimo }) => {
    if (filtro !== 'all') {
      if (filtro === 'sin-pulso') { if (ultimo != null) return false; }
      else if (!ultimo || ultimo.estado !== filtro) return false;
    }
    if (q && !s.nombre.toLowerCase().includes(q.toLowerCase()) && !s.cliente.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [proyectos, filtro, q]);

  const kpi = useMemo(() => {
    const on = proyectos.filter(p => p.ultimo?.estado === 'ON-TRACK').length;
    const at = proyectos.filter(p => p.ultimo?.estado === 'AT-RISK').length;
    const off = proyectos.filter(p => p.ultimo?.estado === 'OFF-TRACK').length;
    const sinPulso = proyectos.filter(p => p.ultimo == null).length;
    const clientes = new Set(proyectos.map(p => p.s.cliente)).size;
    return { total: proyectos.length, on, at, off, sinPulso, clientes };
  }, [proyectos]);

  const grupos = useMemo(() => {
    const m = new Map<string, typeof filtrados>();
    filtrados.forEach(x => {
      if (!m.has(x.s.cliente)) m.set(x.s.cliente, []);
      m.get(x.s.cliente)!.push(x);
    });
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [filtrados]);

  const bloqueos = useMemo(() => {
    // Los bloqueos viven en el SERVICIO (única fuente). Iteramos sus bloqueos abiertos.
    const items: { proyecto: string; cliente: string; titulo: string; desc: string; owner: string; escalado: boolean }[] = [];
    proyectos.forEach(({ s }) => {
      (s.bloqueos || []).filter(b => b.estado !== 'Cerrado').forEach(b => {
        items.push({ proyecto: s.nombre, cliente: s.cliente, titulo: b.titulo, desc: b.desc, owner: b.owner, escalado: b.escalado });
      });
    });
    return items.sort((a, b) => Number(b.escalado) - Number(a.escalado));
  }, [proyectos]);

  const barsClientes = useMemo(() => {
    const m: Record<string, { on: number; at: number; off: number; t: number }> = {};
    proyectos.forEach(({ s, ultimo }) => {
      if (!m[s.cliente]) m[s.cliente] = { on: 0, at: 0, off: 0, t: 0 };
      m[s.cliente].t++;
      if (!ultimo) return;  // sin pulso no incide en el conteo de estados
      if (ultimo.estado === 'ON-TRACK') m[s.cliente].on++;
      else if (ultimo.estado === 'AT-RISK') m[s.cliente].at++;
      else m[s.cliente].off++;
    });
    return Object.entries(m).sort((a, b) => b[1].t - a[1].t);
  }, [proyectos]);

  return (
    <>
      <div className="report-header-bar">
        <div style={{ flex: 1 }}>
          <h2>Gestión de <span className="accent">Proyectos</span></h2>
          <p style={{ color: 'var(--gray-mute)', fontSize: 13, marginTop: 4 }}>
            Foto al {HOY.toLocaleDateString('es-AR')} — último avance publicado por proyecto · click en una card para ver evolución y publicar el pulso
          </p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi k-total"><div className="kpi-label">Proyectos en gestión</div><div className="kpi-value">{kpi.total}</div><div className="kpi-meta">activos con seguimiento</div></div>
        <div className="kpi k-on"><div className="kpi-label">On-Track</div><div className="kpi-value">{kpi.on}</div></div>
        <div className="kpi k-at"><div className="kpi-label">At-Risk</div><div className="kpi-value">{kpi.at}</div></div>
        <div className="kpi k-off"><div className="kpi-label">Off-Track</div><div className="kpi-value">{kpi.off}</div></div>
        <div className="kpi k-hours"><div className="kpi-label">Sin pulso</div><div className="kpi-value">{kpi.sinPulso}</div><div className="kpi-meta">esperan publicación</div></div>
      </div>

      <div className="charts">
        <div className="panel">
          <div className="panel-title">Distribución por estado</div>
          <Donut on={kpi.on} at={kpi.at} off={kpi.off} total={kpi.total} />
        </div>
        <div className="panel">
          <div className="panel-title">Proyectos por cliente</div>
          <div className="clients-bars">
            {barsClientes.map(([cli, c]) => (
              <div key={cli} className="cbar">
                <div className="cbar-name" title={cli}>{cli}</div>
                <div className="cbar-track">
                  <div className="cbar-fill" style={{ width: `${(c.on / c.t) * 100}%`, background: 'var(--green)' }} />
                  <div className="cbar-fill" style={{ width: `${(c.at / c.t) * 100}%`, background: 'var(--orange)' }} />
                  <div className="cbar-fill" style={{ width: `${(c.off / c.t) * 100}%`, background: 'var(--red)' }} />
                </div>
                <div className="cbar-count">{c.t}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Bloqueos activos</div>
          <div className="blocks-list">
            {bloqueos.length === 0 ? <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin bloqueos activos</div> :
              bloqueos.map((b, i) => (
                <div key={i} className={`block-row ${b.escalado ? 'escalar' : ''}`}>
                  <div className="block-row-head">
                    <div className="block-title">{b.titulo}</div>
                    {b.escalado && <span className="escalar-badge">ESCALAR</span>}
                  </div>
                  <div className="block-meta">{b.cliente} · {b.proyecto} · Owner: {b.owner}</div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="filter-bar">
        <div className="filter-group">
          <span className="filter-group-label">Estado</span>
          <button className={`filter-btn ${filtro === 'all' ? 'active' : ''}`} onClick={() => setFiltro('all')}>Todos <span className="mono">{kpi.total}</span></button>
          <button className={`filter-btn ${filtro === 'ON-TRACK' ? 'active' : ''}`} onClick={() => setFiltro('ON-TRACK')}>On-Track <span className="mono">{kpi.on}</span></button>
          <button className={`filter-btn ${filtro === 'AT-RISK' ? 'active' : ''}`} onClick={() => setFiltro('AT-RISK')}>At-Risk <span className="mono">{kpi.at}</span></button>
          <button className={`filter-btn ${filtro === 'OFF-TRACK' ? 'active' : ''}`} onClick={() => setFiltro('OFF-TRACK')}>Off-Track <span className="mono">{kpi.off}</span></button>
          <button className={`filter-btn ${filtro === 'sin-pulso' ? 'active' : ''}`} onClick={() => setFiltro('sin-pulso')}>Sin pulso <span className="mono">{kpi.sinPulso}</span></button>
        </div>
        <div className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar proyecto o cliente…" /></div>
      </div>

      {grupos.length === 0 ? (
        <div className="empty-state">
          Sin proyectos elegibles. Marcá "Elegible para Gestión de Proyectos" en un servicio para que aparezca acá.
        </div>
      ) : grupos.map(([cli, items]) => {
        const on = items.filter(i => i.ultimo?.estado === 'ON-TRACK').length;
        const at = items.filter(i => i.ultimo?.estado === 'AT-RISK').length;
        const off = items.filter(i => i.ultimo?.estado === 'OFF-TRACK').length;
        const pais = items[0].s.pais;
        return (
          <div key={cli} className="client-group">
            <div className="client-head">
              <span className="client-name">{cli}</span>
              <span className="client-region">{pais}</span>
              <div className="client-pills">
                {on > 0 && <span className="client-pill on">{on}</span>}
                {at > 0 && <span className="client-pill at">{at}</span>}
                {off > 0 && <span className="client-pill off">{off}</span>}
              </div>
            </div>
            <div className="cards-grid">
              {items.map(({ s, ultimo }) => (
                <ProyectoCard
                  key={s.id}
                  servicio={s}
                  ultimo={ultimo}
                  historial={historialAvances(store.avances, s.id)}
                  onClick={() => onOpenProyecto(s.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

    </>
  );
}

// ============================================================
// CARD por proyecto en el dashboard — muestra último avance + sparkline
// ============================================================
function ProyectoCard({
  servicio, ultimo, historial, onClick,
}: { servicio: Servicio; ultimo: Avance | null; historial: Avance[]; onClick: () => void }) {
  // Card sin pulso — se ve más liviana, te invita a entrar a publicar el primero.
  if (!ultimo) {
    return (
      <div className="av-card av-card-empty" onClick={onClick} style={{ cursor: 'pointer' }}>
        <div className="av-card-head">
          <div className="av-card-name">{servicio.nombre}</div>
          <span className="status-badge" style={{ background: 'var(--gray-line)', color: 'var(--gray-text)' }}>Sin pulso</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 6 }}>
          Aún no hay pulsos publicados. Entrá para gestionar el proyecto.
        </div>
      </div>
    );
  }
  const cls = ultimo.estado === 'ON-TRACK' ? 's-on' : ultimo.estado === 'AT-RISK' ? 's-at' : 's-off';
  const stCls = ultimo.estado === 'ON-TRACK' ? 'on' : ultimo.estado === 'AT-RISK' ? 'at' : 'off';
  const chips = (servicio.bloqueos || []).filter(b => b.estado !== 'Cerrado');

  // Edad del último avance — alerta si > 7 días
  const fechaUlt = parseDate(ultimo.fechaSemana);
  const dias = fechaUlt ? Math.floor((HOY.getTime() - fechaUlt.getTime()) / 86400000) : null;
  const edadCls = dias == null ? '' : dias > 14 ? 'edad-rojo' : dias > 7 ? 'edad-naranja' : '';
  const edadColor = dias == null ? 'var(--gray-mute)' : dias > 14 ? 'var(--red)' : dias > 7 ? 'var(--orange)' : 'var(--green)';
  const edadLabel = dias == null ? '—' : dias === 0 ? 'hoy' : dias === 1 ? 'hace 1d' : `hace ${dias}d`;

  // Avance global desde el snapshot (o desde la versión vieja real)
  const pctReal = ultimo.pctAvanceGlobal ?? ultimo.real ?? 0;
  const pctPlaneado = ultimo.planeado ?? null;

  return (
    <div className={`av-card ${cls} ${edadCls}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="av-card-head">
        <div className="av-card-name">{servicio.nombre}</div>
        <span className={`status-badge ${stCls}`}>{ultimo.estado}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--gray-text)', marginBottom: 8 }}>
        <span><strong style={{ color: 'var(--gray-mute)' }}>Avance:</strong> <span className="mono">{pctReal}%</span></span>
        {pctPlaneado != null && <span><strong style={{ color: 'var(--gray-mute)' }}>Plan:</strong> <span className="mono">{pctPlaneado}%</span></span>}
        <span style={{ marginLeft: 'auto', color: edadColor, fontWeight: 700, fontSize: 11 }}>● {edadLabel}</span>
      </div>
      <div className="progress-block">
        <div className="progress-row real">
          <span className="progress-label">Avance</span>
          <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pctReal}%` }} /></div>
          <span className="progress-val">{pctReal}%</span>
        </div>
      </div>
      {ultimo.motivoEstado && (
        <div style={{ fontSize: 11, color: 'var(--gray-text)', fontStyle: 'italic', marginTop: 4 }}>
          ⚠ {ultimo.motivoEstado}
        </div>
      )}
      {(ultimo.tareasCompletadas != null || ultimo.tareasAtrasadas != null) && (
        <div style={{ display: 'flex', gap: 8, fontSize: 11, marginTop: 6 }}>
          {ultimo.tareasCompletadas != null && <span style={{ color: 'var(--green)' }}>✓ {ultimo.tareasCompletadas.length} cerradas</span>}
          {ultimo.tareasAtrasadas != null && ultimo.tareasAtrasadas.length > 0 && <span style={{ color: 'var(--red)' }}>! {ultimo.tareasAtrasadas.length} atrasadas</span>}
        </div>
      )}
      {chips.length > 0 && (
        <div className="chips">
          {chips.map((b, i) => <span key={i} className={`chip ${b.escalado ? 'solid' : ''}`}>{b.titulo}</span>)}
        </div>
      )}
      {historial.length >= 2 && <Sparkline historial={historial} />}
      <div className="card-foot">
        <span style={{ fontSize: 11, color: 'var(--gray-mute)' }}>
          {historial.length} {historial.length === 1 ? 'pulso' : 'pulsos'} · último {ultimo.fechaSemana}
        </span>
        <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>Ver evolución →</span>
      </div>
    </div>
  );
}

function Sparkline({ historial }: { historial: Avance[] }) {
  if (historial.length < 2) return null;
  const w = 280; const h = 36;
  const realVals = historial.map(a => a.pctAvanceGlobal ?? a.real ?? 0);
  const xs = historial.map((_, i) => (i / (historial.length - 1)) * w);
  const realY = realVals.map(v => h - (v / 100) * h);
  const pathReal = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${realY[i]}`).join(' ');
  const tienePlan = historial.some(a => a.planeado != null);
  const planY = historial.map(a => h - ((a.planeado ?? 0) / 100) * h);
  const pathPlan = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${planY[i]}`).join(' ');
  return (
    <div style={{ marginTop: 10, marginBottom: 4 }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        {tienePlan && <path d={pathPlan} stroke="var(--gray-dark)" strokeWidth="1.5" fill="none" strokeDasharray="3 2" />}
        <path d={pathReal} stroke="var(--orange)" strokeWidth="2" fill="none" />
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--gray-mute)', marginTop: 2 }}>
        <span>{historial[0].fechaSemana}</span>
        <span style={{ color: 'var(--orange)' }}>— avance</span>
        <span>{historial[historial.length - 1].fechaSemana}</span>
      </div>
    </div>
  );
}

// ============================================================
// DETALLE DE PROYECTO — gráfica + historial completo de avances
// ============================================================
function ProyectoDetalle({ store, usuario, rol, servicioId, onBack }: {
  store: Store; usuario: string; rol: Rol; servicioId: number; onBack: () => void;
}) {
  const servicio = store.servicios.find(s => s.id === servicioId);
  const historial = useMemo(() => historialAvances(store.avances, servicioId), [store.avances, servicioId]);
  const [editing, setEditing] = useState<Avance | null>(null);

  if (!servicio) {
    return (
      <div>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Volver</button>
        <div className="empty-state" style={{ marginTop: 14 }}>Proyecto no encontrado.</div>
      </div>
    );
  }

  const ultimo = historial[historial.length - 1];
  const stCls = ultimo ? (ultimo.estado === 'ON-TRACK' ? 'on' : ultimo.estado === 'AT-RISK' ? 'at' : 'off') : 'on';

  // Permisos para gestión del proyecto desde acá (workspace del PM).
  const puedeGestionar = rol !== 'Comercial';
  const estaCerradoPM = servicio.estado === 'Cerrado por PM';
  const estaCerradoTotal = servicio.estado === 'Cerrado';

  const cerrarComoPM = () => {
    if (!confirm('¿Marcar el proyecto como "Cerrado por PM"? Quedará pendiente la validación final de Gerencia de Servicios.')) return;
    store.upsertServicio({
      ...servicio,
      estado: 'Cerrado por PM',
      cierrePM: { fecha: ddmmaaaa(HOY), por: usuario },
    });
    showToast('Proyecto marcado como cerrado por PM');
  };
  const reabrirComoPM = () => {
    if (!confirm('¿Reabrir el proyecto? Volverá a estado "En curso".')) return;
    store.upsertServicio({
      ...servicio,
      estado: 'En curso',
      cierrePM: undefined,
    });
    showToast('Proyecto reabierto');
  };

  return (
    <>
      <div className="report-header-bar">
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Volver al dashboard</button>
        <h2>{servicio.cliente} — {servicio.nombre}</h2>
        {ultimo && <span className={`status-badge ${stCls}`}>{ultimo.estado}</span>}
        {estaCerradoPM && <span className="pill pend">▣ Cerrado por PM · esperando Gerencia</span>}
        {estaCerradoTotal && <span className="pill ok">✓ Cerrado definitivo</span>}
        <span style={{ marginLeft: 'auto' }} />
        {puedeGestionar && !estaCerradoPM && !estaCerradoTotal && (
          <button className="btn btn-primary btn-sm" onClick={cerrarComoPM} title="El PM da por concluida la ejecución del proyecto; queda pendiente la validación de Gerencia de Servicios">
            ▣ Cerrar como PM
          </button>
        )}
        {puedeGestionar && estaCerradoPM && (
          <button className="btn btn-secondary btn-sm" onClick={reabrirComoPM} title="Reabrir el proyecto (vuelve a En curso)">
            ↺ Reabrir
          </button>
        )}
      </div>

      {/* Aviso explicativo cuando el proyecto está en transición de cierre */}
      {estaCerradoPM && (
        <div style={{ background: 'var(--orange-soft)', border: '1px solid var(--orange)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--gray-dark)' }}>
          <strong style={{ color: 'var(--orange)' }}>▣ Proyecto cerrado por el PM</strong>
          {servicio.cierrePM && <> el <span className="mono">{servicio.cierrePM.fecha}</span> por <strong>{servicio.cierrePM.por}</strong>.</>}
          <br />
          La validación final (cierre definitivo + balance de horas) la hace Gerencia de Servicios desde la tab <strong>Servicios</strong>.
        </div>
      )}

      {/* ─── Avance y pulso al tope (lo primero que el PM mira al abrir el proyecto) ─── */}
      <NovedadesPanel store={store} servicio={servicio} />

      <PulsoEnVivoPanel store={store} servicio={servicio} usuario={usuario} />

      {/* ─── Datos del proyecto (estructura) ─── */}
      <EquipoPanel store={store} servicio={servicio} />

      <div className="panel">
        <div className="panel-title">Macroplan del proyecto · tildá las tareas a medida que se cierran</div>
        <MacroplanPanel store={store} servicio={servicio} usuario={usuario} />
      </div>

      {servicio.modoCertificacion === 'Hitos' && (
        <div className="panel">
          <div className="panel-title">Hitos del proyecto · marcá el cumplido al certificar</div>
          <HitosPanel store={store} servicio={servicio} />
        </div>
      )}

      <BloqueosPanel store={store} servicio={servicio} />

      <RiesgosPanel store={store} servicio={servicio} />

      <CambiosDelProyectoPanel store={store} servicio={servicio} usuario={usuario} />

      {historial.length > 0 && (
        <>
          <div className="panel">
            <div className="panel-title">Evolución del % avance</div>
            <BigChart historial={historial} />
          </div>

          <div className="panel">
            <div className="panel-title">Historial de avances publicados · {historial.length}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...historial].reverse().map((a, idx) => (
                <AvanceItem key={a.id} avance={a} servicio={servicio} tareas={tareasDe(store.tareas, servicio.id)} ultimo={idx === 0} onEdit={() => setEditing(a)}
                  onDelete={() => { if (confirm('¿Eliminar este avance?')) { store.deleteAvance(a.id); showToast('Avance eliminado'); } }} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* Modal de edición de pulsos publicados (desde el historial). La carga inicial
          ocurre desde el panel "Pulso en vivo" arriba, no requiere este modal. */}
      <CargarAvanceModal
        open={editing != null}
        store={store}
        servicioFijo={servicioId}
        avance={editing}
        onClose={() => setEditing(null)}
        onSave={a => {
          store.upsertAvance(a);
          showToast('Avance actualizado');
          setEditing(null);
        }}
      />
    </>
  );
}

function BigChart({ historial }: { historial: Avance[] }) {
  const w = 800; const h = 220;
  const padL = 36; const padR = 16; const padT = 12; const padB = 36;
  const cw = w - padL - padR; const ch = h - padT - padB;
  const xs = historial.map((_, i) => historial.length === 1 ? padL + cw / 2 : padL + (i / (historial.length - 1)) * cw);
  const yFor = (v: number) => padT + ch - (v / 100) * ch;
  const planVals = historial.map(a => a.planeado ?? 0);
  const realVals = historial.map(a => a.pctAvanceGlobal ?? a.real ?? 0);
  const tienePlan = historial.some(a => a.planeado != null);
  const pathPlan = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${yFor(planVals[i])}`).join(' ');
  const pathReal = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x} ${yFor(realVals[i])}`).join(' ');
  const yTicks = [0, 25, 50, 75, 100];

  return (
    <div style={{ overflow: 'auto' }}>
      <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} style={{ minWidth: 600 }}>
        {/* Grid */}
        {yTicks.map(t => (
          <g key={t}>
            <line x1={padL} y1={yFor(t)} x2={w - padR} y2={yFor(t)} stroke="var(--gray-line)" strokeDasharray="2 3" />
            <text x={padL - 6} y={yFor(t) + 3} textAnchor="end" fontSize="10" fill="var(--gray-mute)" fontFamily="JetBrains Mono">{t}%</text>
          </g>
        ))}
        {/* Lines */}
        {tienePlan && <path d={pathPlan} stroke="var(--gray-dark)" strokeWidth="2" fill="none" strokeDasharray="4 3" />}
        <path d={pathReal} stroke="var(--orange)" strokeWidth="2.5" fill="none" />
        {/* Points */}
        {historial.map((a, i) => (
          <g key={a.id}>
            {tienePlan && <circle cx={xs[i]} cy={yFor(planVals[i])} r="3" fill="var(--gray-dark)" />}
            <circle cx={xs[i]} cy={yFor(realVals[i])} r="4"
              fill={a.estado === 'ON-TRACK' ? 'var(--green)' : a.estado === 'AT-RISK' ? 'var(--orange)' : 'var(--red)'} />
            <text x={xs[i]} y={h - padB + 14} textAnchor="middle" fontSize="9" fill="var(--gray-mute)" fontFamily="JetBrains Mono">
              {a.fechaSemana.slice(0, 5)}
            </text>
          </g>
        ))}
      </svg>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end', fontSize: 11, color: 'var(--gray-mute)' }}>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px dashed var(--gray-dark)', verticalAlign: 'middle' }} /> Planeado</span>
        <span><span style={{ display: 'inline-block', width: 14, borderTop: '2px solid var(--orange)', verticalAlign: 'middle' }} /> Real</span>
        <span><span className="dot" style={{ background: 'var(--green)' }} /> ON</span>
        <span><span className="dot" style={{ background: 'var(--orange)' }} /> AT</span>
        <span><span className="dot" style={{ background: 'var(--red)' }} /> OFF</span>
      </div>
    </div>
  );
}

function AvanceItem({ avance, servicio, tareas, ultimo, onEdit, onDelete }:
  { avance: Avance; servicio: Servicio; tareas: { id: number; nombre: string; fechaFinPlan: string; fechaFinReal?: string }[];
    ultimo: boolean; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(ultimo);
  const cls = avance.estado === 'ON-TRACK' ? 's-on' : avance.estado === 'AT-RISK' ? 's-at' : 's-off';
  const stCls = avance.estado === 'ON-TRACK' ? 'on' : avance.estado === 'AT-RISK' ? 'at' : 'off';
  const chips = ultimo ? (servicio.bloqueos || []).filter(b => b.estado !== 'Cerrado') : [];
  const pctAvance = avance.pctAvanceGlobal ?? avance.real ?? null;
  const pctPlan = avance.planeado ?? null;
  return (
    <div className={`av-card ${cls} ${expanded ? 'expanded' : ''}`}>
      <div className="av-card-head">
        <div className="av-card-name">
          Semana del {avance.fechaSemana}
          {ultimo && <span className="badge llave" style={{ marginLeft: 8 }}>ÚLTIMO</span>}
        </div>
        <span className={`status-badge ${stCls}`}>{avance.estado}</span>
      </div>
      <div className="progress-block">
        {pctPlan != null && (
          <div className="progress-row">
            <span className="progress-label">Planeado</span>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pctPlan}%` }} /></div>
            <span className="progress-val">{pctPlan}%</span>
          </div>
        )}
        {pctAvance != null && (
          <div className="progress-row real">
            <span className="progress-label">Avance</span>
            <div className="progress-bar"><div className="progress-bar-fill" style={{ width: `${pctAvance}%` }} /></div>
            <span className="progress-val">{pctAvance}%</span>
          </div>
        )}
      </div>
      {avance.motivoEstado && (
        <div style={{ fontSize: 11, color: 'var(--gray-text)', fontStyle: 'italic', marginTop: 4 }}>⚠ {avance.motivoEstado}</div>
      )}
      {chips.length > 0 && (
        <div className="chips">
          {chips.map((b, i) => <span key={i} className={`chip ${b.escalado ? 'solid' : ''}`}>{b.titulo}</span>)}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="btn btn-sm btn-secondary" onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲ Ocultar' : '▼ Ver detalle'}
        </button>
        <button className="btn btn-sm btn-secondary" onClick={onEdit}>✏ Editar</button>
        <button className="btn btn-sm btn-danger" onClick={onDelete}>× Eliminar</button>
      </div>
      <div className="expand">
        <div className="expand-inner">
          {(avance.pmExisoft || avance.ltExisoft || avance.pmCliente) && (
            <div className="card-people">
              {avance.pmExisoft && <span><strong>PM Exi:</strong> {avance.pmExisoft}</span>}
              {avance.ltExisoft && <span><strong>LT Exi:</strong> {avance.ltExisoft}</span>}
              {avance.pmCliente && <span><strong>PM Cli:</strong> {avance.pmCliente}</span>}
            </div>
          )}
          {avance.comentario && <div><div className="section-h">Comentario del PM</div><div className="comments-box">{avance.comentario}</div></div>}
          {(avance.tareasCompletadas || avance.tareasAtrasadas) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {avance.tareasCompletadas != null && (
                <div>
                  <div className="section-h">✓ Cerradas en la semana ({avance.tareasCompletadas.length})</div>
                  {avance.tareasCompletadas.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--gray-mute)' }}>Sin cierres.</div>
                    : (
                      <ul className="item-list logros">
                        {avance.tareasCompletadas.map(id => {
                          const t = tareas.find(x => x.id === id);
                          return <li key={id}>{t ? t.nombre : `Tarea #${id} (eliminada)`}{t?.fechaFinReal && <span style={{ color: 'var(--gray-mute)' }}> · {t.fechaFinReal}</span>}</li>;
                        })}
                      </ul>
                    )}
                </div>
              )}
              {avance.tareasAtrasadas != null && (
                <div>
                  <div className="section-h">! Atrasadas al cierre ({avance.tareasAtrasadas.length})</div>
                  {avance.tareasAtrasadas.length === 0
                    ? <div style={{ fontSize: 11, color: 'var(--gray-mute)' }}>Sin atrasos.</div>
                    : (
                      <ul className="item-list" style={{ color: 'var(--red)' }}>
                        {avance.tareasAtrasadas.map(id => {
                          const t = tareas.find(x => x.id === id);
                          return <li key={id} style={{ paddingLeft: 16 }}>{t ? t.nombre : `Tarea #${id} (eliminada)`}{t?.fechaFinPlan && <span style={{ color: 'var(--gray-mute)' }}> · plan: {t.fechaFinPlan}</span>}</li>;
                        })}
                      </ul>
                    )}
                </div>
              )}
            </div>
          )}
          {avance.objetivos && avance.objetivos.length > 0 && <div><div className="section-h">Objetivos (legacy)</div><ul className="item-list objs">{avance.objetivos.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
          {avance.logros && avance.logros.length > 0 && <div><div className="section-h">Logros (legacy)</div><ul className="item-list logros">{avance.logros.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
          {avance.proximo && avance.proximo.length > 0 && <div><div className="section-h">Próximo (legacy)</div><ul className="item-list proximo">{avance.proximo.map((o, i) => <li key={i}>{o}</li>)}</ul></div>}
          {avance.comentarios && <div><div className="section-h">Comentarios (legacy)</div><div className="comments-box">{avance.comentarios}</div></div>}
          {chips.length > 0 && (
            <div>
              <div className="section-h">Bloqueos</div>
              {chips.map((b, i) => (
                <div key={i} className={`block-detail ${b.escalado ? 'escalar' : ''}`}>
                  <div className="block-detail-title">{b.titulo}{b.escalado && <span className="escalar-badge" style={{ marginLeft: 6 }}>ESCALAR</span>}</div>
                  <div className="block-detail-desc">{b.desc}</div>
                  <div className="block-detail-meta"><span><strong>Owner:</strong> {b.owner}</span><span><strong>Estado:</strong> {b.estado}</span></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DONUT (mismo que antes)
// ============================================================
function Donut({ on, at, off, total }: { on: number; at: number; off: number; total: number }) {
  const r = 64; const c = 2 * Math.PI * r;
  const segs = total === 0 ? [] : [
    { value: on, color: 'var(--green)', label: 'On-Track' },
    { value: at, color: 'var(--orange)', label: 'At-Risk' },
    { value: off, color: 'var(--red)', label: 'Off-Track' },
  ];
  let acc = 0;
  return (
    <div className="donut-wrap">
      <div className="donut">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx="85" cy="85" r={r} fill="none" stroke="#f0f0f0" strokeWidth="20" />
          <g transform="rotate(-90 85 85)">
            {segs.map((s, i) => {
              if (s.value === 0) return null;
              const len = (s.value / total) * c;
              const offset = c - acc;
              const dash = `${len} ${c - len}`;
              acc += len;
              return <circle key={i} cx="85" cy="85" r={r} fill="none" stroke={s.color} strokeWidth="20"
                strokeDasharray={dash} strokeDashoffset={-c + offset} />;
            })}
          </g>
        </svg>
        <div className="donut-center"><span className="num">{total}</span><span className="lbl">Proyectos</span></div>
      </div>
      <div className="donut-legend">
        {segs.map((s, i) => (
          <div key={i} className="legend-row">
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-name">{s.label}</span>
            <span className="legend-val">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CARGAR AVANCE (alta o edición)
// ============================================================
interface CmProps {
  open: boolean; store: Store;
  servicioFijo?: number;
  avance?: Avance | null;
  onClose: () => void; onSave: (a: Avance) => void;
}

// ============================================================
// CARGAR AVANCE (Pulso semanal) — versión simplificada
// El sistema autodetecta tareas completadas/atrasadas desde el macroplan.
// El PM sólo elige estado + escribe comentario + ajusta bloqueos.
// ============================================================
function CargarAvanceModal({ open, store, servicioFijo, avance, onClose, onSave }: CmProps) {
  const disponibles = useMemo(() =>
    store.servicios.filter(s => s.seguimientoAvances && s.estado !== 'Cerrado'),
  [store.servicios]);

  // Elige un autor por defecto desde el equipo del servicio: primer PM, sino primer miembro,
  // sino primer recurso del sistema. Garantiza que `autor` siempre venga de la tabla Recursos.
  const elegirAutorPorDefecto = (sid: number): string => {
    const pms = pmsDe(sid, store.recursos);
    if (pms.length > 0) return pms[0].nombre;
    const eq = equipoDe(sid, store.recursos);
    if (eq.length > 0) return eq[0].nombre;
    const r = store.recursos[0];
    return r ? nombreCompleto(r) : '';
  };

  const blank = (): Avance => {
    const sid = servicioFijo || disponibles[0]?.id || 0;
    return {
      id: Date.now(),
      servicioId: sid,
      fechaSemana: ddmmaaaa(lunesDeSemana(HOY)),
      autor: elegirAutorPorDefecto(sid),
      fechaCarga: ddmmaaaa(HOY),
      estado: 'ON-TRACK',
      comentario: '',
    };
  };

  const [f, setF] = useState<Avance>(blank());
  // Bloqueos pertenecen al servicio. Buffer local.
  const [bloqueosBuf, setBloqueosBuf] = useState<Bloqueo[]>([]);

  useEffect(() => {
    if (!open) return;
    const sid = avance?.servicioId ?? (servicioFijo || disponibles[0]?.id || 0);
    const s = store.servicios.find(x => x.id === sid);
    setBloqueosBuf(s ? [...(s.bloqueos || [])] : []);
    if (avance) {
      // Si el autor histórico no matchea ningún recurso vigente, lo reasignamos al default
      // (caso típico: pulso legacy creado con texto libre).
      const autorEsValido = store.recursos.some(r => nombreCompleto(r) === avance.autor);
      setF({ ...avance, autor: autorEsValido ? avance.autor : elegirAutorPorDefecto(sid) });
    } else {
      const ult = ultimoAvance(store.avances, sid);
      setF({ ...blank(), servicioId: sid, estado: ult?.estado ?? 'ON-TRACK' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, avance, servicioFijo, store.avances, store.servicios, store.recursos, disponibles]);

  // ⚠️ Hooks ANTES de cualquier early return (rules-of-hooks de React).
  // Equipo del servicio actual (para el dropdown de Autor, agrupado).
  const equipoServicioActual = useMemo(
    () => equipoDe(f.servicioId, store.recursos, store.servicios, store.clientes),
    [f.servicioId, store.recursos, store.servicios, store.clientes],
  );
  const idsEquipoActual = useMemo(
    () => new Set(equipoServicioActual.map(m => m.recursoId)),
    [equipoServicioActual],
  );
  const recursosOrdenados = useMemo<Recurso[]>(
    () => [...store.recursos].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [store.recursos],
  );

  if (!open) return null;
  const u = (p: Partial<Avance>) => setF(prev => ({ ...prev, ...p }));

  // Snapshot del macroplan al momento del avance.
  // Cuando se edita el ÚNICO pulso (no hay otro previo), tareasCerradasEnRango con desde=null
  // devolvería todas las tareas históricas. Fallback: día anterior al lunes de la semana actual,
  // así el rango cubre exactamente la semana del pulso.
  const semanaActual = parseDate(f.fechaSemana) || HOY;
  const ult = ultimoAvance(store.avances.filter(a => !avance || a.id !== avance.id), f.servicioId);
  const ultDate = ult ? parseDate(ult.fechaSemana) : null;
  const semanaPrev = ultDate ?? new Date(semanaActual.getTime() - 86400000);
  const finSemana = new Date(semanaActual.getTime() + 6 * 86400000);
  const tareasCerradas = tareasCerradasEnRango(store.tareas, f.servicioId, semanaPrev, finSemana);
  const tareasAtrasadas = tareasAtrasadasAt(store.tareas, f.servicioId, finSemana);
  const totalActivas = tareasDe(store.tareas, f.servicioId).filter(t => t.estado !== 'Cancelada').length;
  const pctGlobal = pctAvanceGlobal(store.tareas, f.servicioId);

  const guardar = () => {
    if (!f.servicioId) return;
    // Bloqueos al servicio
    const s = store.servicios.find(x => x.id === f.servicioId);
    if (s) store.upsertServicio({ ...s, bloqueos: bloqueosBuf.filter(b => b.titulo.trim()) });
    // Avance con snapshot
    onSave({
      ...f,
      pctAvanceGlobal: pctGlobal,
      tareasCompletadas: tareasCerradas.map(t => t.id),
      tareasAtrasadas: tareasAtrasadas.map(t => t.id),
    });
  };

  const onChangeServicio = (sid: number) => {
    const s = store.servicios.find(x => x.id === sid);
    setBloqueosBuf(s ? [...(s.bloqueos || [])] : []);
    // Al cambiar de servicio: si el autor actual no pertenece al equipo del nuevo servicio,
    // proponer el PM/primer miembro del equipo. Si pertenece, lo respetamos.
    const equipoNuevo = equipoDe(sid, store.recursos, store.servicios, store.clientes);
    const autorPerteneceAlEquipoNuevo = equipoNuevo.some(m => m.nombre === f.autor);
    const nuevoAutor = autorPerteneceAlEquipoNuevo ? f.autor : elegirAutorPorDefecto(sid);
    setF(prev => ({ ...prev, servicioId: sid, autor: nuevoAutor }));
  };

  const editBloq = (i: number, p: Partial<Bloqueo>) => { const n = [...bloqueosBuf]; n[i] = { ...n[i], ...p }; setBloqueosBuf(n); };
  const addBloq = () => setBloqueosBuf([...bloqueosBuf, { titulo: '', desc: '', owner: '', estado: 'Abierto', escalado: false }]);
  const delBloq = (i: number) => setBloqueosBuf(bloqueosBuf.filter((_, j) => j !== i));

  return (
    <Modal open={open} title={avance ? 'Editar pulso semanal' : 'Cargar pulso semanal'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={!f.servicioId}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-section-title">Proyecto y semana</div>
        <div className="form-group full"><label>Proyecto</label>
          <select value={f.servicioId} onChange={e => onChangeServicio(Number(e.target.value))} disabled={!!servicioFijo}>
            <option value={0}>— Seleccionar —</option>
            {disponibles.map(s => <option key={s.id} value={s.id}>{s.cliente} · {s.nombre}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Semana (lunes)</label>
          <input value={f.fechaSemana} onChange={e => u({ fechaSemana: e.target.value })} placeholder="dd/mm/aaaa" />
        </div>
        <div className="form-group"><label>Autor</label>
          <select value={f.autor} onChange={e => u({ autor: e.target.value })}>
            {!f.autor && <option value="">— Seleccionar —</option>}
            {equipoServicioActual.length > 0 && (
              <optgroup label="Equipo del servicio">
                {equipoServicioActual
                  .slice()
                  .sort((a, b) => a.nombre.localeCompare(b.nombre))
                  .map(m => (
                    <option key={`eq-${m.recursoId}`} value={m.nombre}>
                      {m.nombre}{m.perfil ? ` · ${m.perfil}` : ''}
                    </option>
                  ))}
              </optgroup>
            )}
            <optgroup label="Otros profesionales">
              {recursosOrdenados
                .filter(r => !idsEquipoActual.has(r.id))
                .map(r => (
                  <option key={`ot-${r.id}`} value={nombreCompleto(r)}>{nombreCompleto(r)}</option>
                ))}
            </optgroup>
          </select>
        </div>

        <div className="form-section-title">Estado general</div>
        <div className="form-group"><label>Estado</label>
          <select value={f.estado} onChange={e => u({ estado: e.target.value as EstadoAvance })}>
            <option value="ON-TRACK">ON-TRACK</option>
            <option value="AT-RISK">AT-RISK</option>
            <option value="OFF-TRACK">OFF-TRACK</option>
          </select>
        </div>
        <div className="form-group"><label>% Avance global (calculado)</label>
          <input value={`${pctGlobal}%`} disabled style={{ background: '#f5f5f5' }} />
        </div>
        {(f.estado === 'AT-RISK' || f.estado === 'OFF-TRACK') && (
          <div className="form-group full"><label>Motivo del estado</label>
            <input value={f.motivoEstado || ''} onChange={e => u({ motivoEstado: e.target.value })}
              placeholder="Ej: bloqueo de infra cliente, dependencias externas, recursos insuficientes…" />
          </div>
        )}

        <div className="form-section-title">Snapshot del macroplan (automático)</div>
        <div className="form-group full" style={{ fontSize: 12 }}>
          {totalActivas === 0 ? (
            <div style={{ color: 'var(--gray-mute)', padding: 8, background: '#fafafa', borderRadius: 8 }}>
              Este proyecto no tiene macroplan cargado. Andá a la sección "Macroplan" del detalle para agregar tareas, así el sistema puede armar este resumen automáticamente.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ border: '1px solid var(--green)', borderRadius: 8, padding: 10, background: 'var(--green-soft)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--green)', textTransform: 'uppercase', marginBottom: 6 }}>
                  ✓ Cerradas esta semana ({tareasCerradas.length})
                </div>
                {tareasCerradas.length === 0 ? (
                  <div style={{ color: 'var(--gray-mute)' }}>Sin cierres entre {ultDate ? ddmmaaaa(ultDate) : 'el inicio de la semana'} y {ddmmaaaa(finSemana)}.</div>
                ) : (
                  <ul style={{ listStyle: 'none', fontSize: 12 }}>
                    {tareasCerradas.map(t => <li key={t.id} style={{ padding: '2px 0' }}>· {t.nombre} <span style={{ color: 'var(--gray-mute)' }}>({t.fechaFinReal})</span></li>)}
                  </ul>
                )}
              </div>
              <div style={{ border: '1px solid var(--red)', borderRadius: 8, padding: 10, background: 'var(--red-soft)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 6 }}>
                  ! Atrasadas ({tareasAtrasadas.length})
                </div>
                {tareasAtrasadas.length === 0 ? (
                  <div style={{ color: 'var(--gray-mute)' }}>Sin tareas atrasadas al cierre de la semana.</div>
                ) : (
                  <ul style={{ listStyle: 'none', fontSize: 12 }}>
                    {tareasAtrasadas.map(t => <li key={t.id} style={{ padding: '2px 0' }}>· {t.nombre} <span style={{ color: 'var(--gray-mute)' }}>(plan: {t.fechaFinPlan})</span></li>)}
                  </ul>
                )}
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 8 }}>
            Este resumen queda congelado al guardar el avance. Si querés modificarlo, ajustá las tareas en el macroplan antes de cargar el pulso.
          </div>
        </div>

        <div className="form-section-title">Comentario del PM</div>
        <div className="form-group full">
          <textarea value={f.comentario || ''} onChange={e => u({ comentario: e.target.value })}
            placeholder="Resumen breve: novedades, desvíos relevantes, contexto que la dirección debería conocer." />
        </div>

        <div className="form-section-title">
          Bloqueos del proyecto &nbsp;
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-mute)' }}>
            (pertenecen al servicio · se sincronizan)
          </span>
        </div>
        <div className="form-group full">
          {bloqueosBuf.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>Sin bloqueos activos.</div>}
          {bloqueosBuf.map((b, i) => (
            <div key={i} style={{ border: '1px solid var(--gray-line)', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontSize: 11, color: 'var(--orange)' }}>Bloqueo {i + 1}</strong>
                <button className="btn btn-sm btn-danger" onClick={() => delBloq(i)}>×</button>
              </div>
              <div className="form-grid" style={{ gap: 8 }}>
                <div className="form-group"><label>Título</label><input value={b.titulo} onChange={e => editBloq(i, { titulo: e.target.value })} /></div>
                <div className="form-group"><label>Categoría</label>
                  <select value={b.categoria || ''} onChange={e => editBloq(i, { categoria: e.target.value || undefined })}>
                    <option value="">— Sin clasificar —</option>
                    {store.categoriasBloqueo.filter(c => c.activo || c.nombre === b.categoria).map(c =>
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                </div>
                <div className="form-group full"><label>Descripción</label><input value={b.desc} onChange={e => editBloq(i, { desc: e.target.value })} /></div>
                <div className="form-group"><label>Owner</label><input value={b.owner} onChange={e => editBloq(i, { owner: e.target.value })} /></div>
                <div className="form-group"><label>Estado</label>
                  <select value={b.estado} onChange={e => editBloq(i, { estado: e.target.value as Bloqueo['estado'] })}>
                    <option>Abierto</option><option>En curso</option><option>Cerrado</option>
                  </select>
                </div>
                <div className="form-group"><label>Escalado</label>
                  <select value={b.escalado ? 'true' : 'false'} onChange={e => editBloq(i, { escalado: e.target.value === 'true' })}>
                    <option value="false">No</option><option value="true">Sí</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addBloq}>+ Agregar bloqueo</button>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Panel "Pulso en vivo" — el pulso de la semana actual auto-generado.
// Se calcula al momento desde la data del proyecto. El PM puede comentar y
// optionalmente sobreescribir el estado inferido. Al "Publicar" se persiste
// como un Avance histórico.
// ============================================================
function PulsoEnVivoPanel({ store, servicio, usuario }: { store: Store; servicio: Servicio; usuario: string }) {
  const lunes = lunesDeSemana(HOY);
  const domingo = new Date(lunes.getTime() + 6 * 86400000);

  // Si ya hay un Avance publicado para esta misma semana, lo mostramos como "publicado".
  const avancePublicadoEstaSemana = useMemo(() => {
    return store.avances.find(a => {
      if (a.servicioId !== servicio.id) return false;
      const f = parseDate(a.fechaSemana);
      return f && f.getTime() === lunes.getTime();
    });
  }, [store.avances, servicio.id, lunes]);

  // Datos derivados del período (lunes a HOY)
  const tareasCerradas = useMemo(
    () => tareasCerradasEnRango(store.tareas, servicio.id, new Date(lunes.getTime() - 86400000), HOY),
    [store.tareas, servicio.id, lunes],
  );
  const tareasAtras = useMemo(
    () => tareasAtrasadasAt(store.tareas, servicio.id, HOY),
    [store.tareas, servicio.id],
  );
  const cambiosSemana = useMemo(
    () => (servicio.cambios || []).filter(c => {
      const f = parseDate(c.fechaRegistro);
      return f && f >= lunes && f <= HOY;
    }),
    [servicio.cambios, lunes],
  );
  const hitosCumplidosSemana = useMemo(
    () => (servicio.hitos || []).filter(h => {
      if (!h.cumplido || !h.fechaCertReal) return false;
      const f = parseDate(h.fechaCertReal);
      return f && f >= lunes && f <= HOY;
    }),
    [servicio.hitos, lunes],
  );
  const bloqueosAbiertos = useMemo(
    () => (servicio.bloqueos || []).filter(b => b.estado !== 'Cerrado'),
    [servicio.bloqueos],
  );

  // Inferencia automática del estado + resumen
  const inferido = useMemo(
    () => inferirEstadoAvance(store.tareas, servicio.id, servicio.bloqueos || [], servicio.hitos || [], HOY),
    [store.tareas, servicio.id, servicio.bloqueos, servicio.hitos],
  );
  const pctGlobal = useMemo(() => pctAvanceGlobal(store.tareas, servicio.id), [store.tareas, servicio.id]);
  const resumen = useMemo(() => resumenAutoPulso({
    tareasCerradas: tareasCerradas.length,
    tareasAtrasadas: tareasAtras.length,
    hitosCumplidos: hitosCumplidosSemana.length,
    cambiosRegistrados: cambiosSemana.length,
    bloqueosAbiertos: bloqueosAbiertos.length,
  }), [tareasCerradas, tareasAtras, hitosCumplidosSemana, cambiosSemana, bloqueosAbiertos]);

  // ── Local state: comentario opcional y override de estado (antes de publicar) ──
  // Si ya está publicado, partimos del avance existente.
  const [comentario, setComentario] = useState(avancePublicadoEstaSemana?.comentario || '');
  const [estadoOverride, setEstadoOverride] = useState<EstadoAvance | ''>(
    avancePublicadoEstaSemana && avancePublicadoEstaSemana.estado !== avancePublicadoEstaSemana.estadoAuto
      ? avancePublicadoEstaSemana.estado
      : ''
  );

  // Sincronizamos si cambia el avance publicado (otro usuario, etc.)
  useEffect(() => {
    setComentario(avancePublicadoEstaSemana?.comentario || '');
    setEstadoOverride(
      avancePublicadoEstaSemana && avancePublicadoEstaSemana.estado !== avancePublicadoEstaSemana.estadoAuto
        ? avancePublicadoEstaSemana.estado
        : ''
    );
  }, [avancePublicadoEstaSemana?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const estadoEfectivo: EstadoAvance = estadoOverride || inferido.estado;
  const cls = estadoEfectivo === 'ON-TRACK' ? 'on' : estadoEfectivo === 'AT-RISK' ? 'at' : 'off';

  const publicar = () => {
    const nuevoAvance: Avance = {
      id: avancePublicadoEstaSemana?.id ?? Date.now(),
      servicioId: servicio.id,
      fechaSemana: ddmmaaaa(lunes),
      fechaCarga: ddmmaaaa(HOY),
      autor: usuario,
      estado: estadoEfectivo,
      estadoAuto: inferido.estado,
      motivoEstado: estadoOverride ? `Override del PM (auto era ${inferido.estado}: ${inferido.motivo})` : inferido.motivo,
      motivoEstadoAuto: inferido.motivo,
      pctAvanceGlobal: pctGlobal,
      tareasCompletadas: tareasCerradas.map(t => t.id),
      tareasAtrasadas: tareasAtras.map(t => t.id),
      comentario: comentario.trim() || undefined,
      autoGenerado: true,
      resumenAuto: resumen,
    };
    store.upsertAvance(nuevoAvance);
    showToast(avancePublicadoEstaSemana ? 'Pulso de la semana actualizado' : 'Pulso de la semana publicado');
  };

  const diasParaCerrar = Math.max(0, Math.ceil((domingo.getTime() - HOY.getTime()) / 86400000));

  return (
    <div className="panel pulso-vivo-panel">
      <div className="pulso-vivo-head">
        <div>
          <div className="pulso-vivo-eyebrow">
            {avancePublicadoEstaSemana ? '✓ Pulso publicado' : '⌚ Pulso en vivo'} · semana del{' '}
            <span className="mono">{ddmmaaaa(lunes)}</span> al <span className="mono">{ddmmaaaa(domingo)}</span>
          </div>
          {!avancePublicadoEstaSemana && (
            <div className="pulso-vivo-sub">
              {diasParaCerrar === 0 ? 'Cierra hoy.' : diasParaCerrar === 1 ? 'Cierra mañana.' : `Cierra en ${diasParaCerrar} días.`}
              {' '}Mientras tanto, el pulso refleja la foto al día.
            </div>
          )}
        </div>
        <div className="pulso-vivo-estado">
          <span className={`status-badge ${cls}`} style={{ fontSize: 13 }}>{estadoEfectivo}</span>
          <span className="mono pulso-vivo-pct">{pctGlobal}%</span>
        </div>
      </div>

      <div className="pulso-vivo-grid">
        <div className="pulso-vivo-metric"><div className="pulso-vivo-metric-num" style={{ color: 'var(--green)' }}>{tareasCerradas.length}</div><div className="pulso-vivo-metric-lbl">Tareas cerradas</div></div>
        <div className="pulso-vivo-metric"><div className="pulso-vivo-metric-num" style={{ color: 'var(--orange)' }}>{tareasAtras.length}</div><div className="pulso-vivo-metric-lbl">Atrasadas</div></div>
        <div className="pulso-vivo-metric"><div className="pulso-vivo-metric-num" style={{ color: 'var(--green)' }}>{hitosCumplidosSemana.length}</div><div className="pulso-vivo-metric-lbl">Hitos cumplidos</div></div>
        <div className="pulso-vivo-metric"><div className="pulso-vivo-metric-num" style={{ color: 'var(--orange)' }}>{cambiosSemana.length}</div><div className="pulso-vivo-metric-lbl">Cambios</div></div>
        <div className="pulso-vivo-metric"><div className="pulso-vivo-metric-num" style={{ color: 'var(--red)' }}>{bloqueosAbiertos.length}</div><div className="pulso-vivo-metric-lbl">Bloqueos</div></div>
      </div>

      <div className="pulso-vivo-resumen">
        <div className="pulso-vivo-resumen-lbl">📝 Resumen automático</div>
        <div className="pulso-vivo-resumen-txt">{resumen}</div>
        <div className="pulso-vivo-resumen-motivo">
          <strong style={{ color: cls === 'on' ? 'var(--green)' : cls === 'at' ? 'var(--orange)' : 'var(--red)' }}>{inferido.estado}</strong>
          <span style={{ color: 'var(--gray-mute)' }}> · {inferido.motivo}</span>
        </div>
      </div>

      <div className="pulso-vivo-pm">
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 180 }}>
            <label className="pulso-vivo-pm-lbl">Override del estado (opcional)</label>
            <select value={estadoOverride} onChange={e => setEstadoOverride(e.target.value as EstadoAvance | '')}>
              <option value="">Mantener auto ({inferido.estado})</option>
              <option value="ON-TRACK">ON-TRACK</option>
              <option value="AT-RISK">AT-RISK</option>
              <option value="OFF-TRACK">OFF-TRACK</option>
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 280 }}>
            <label className="pulso-vivo-pm-lbl">Comentario del PM (opcional)</label>
            <input value={comentario} onChange={e => setComentario(e.target.value)}
              placeholder="Contexto que no captura la auto-inferencia: decisión cliente, riesgo emergente, etc." />
          </div>
          <button className="btn btn-primary" onClick={publicar}>
            {avancePublicadoEstaSemana ? 'Actualizar pulso publicado' : '📤 Publicar pulso de la semana'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Panel "Novedades de la semana" — agrega TODO lo que pasó en la última ventana
// (7 o 14 días) en un solo lugar. Esto es lo que el PM mira ni bien abre el proyecto.
// ============================================================
function NovedadesPanel({ store, servicio }: { store: Store; servicio: Servicio }) {
  const ventana = servicio.ventanaPulsoDias === 14 ? 14 : 7;
  const desde = new Date(HOY.getTime() - ventana * 86400000);

  const cambiarVentana = (dias: 7 | 14) => {
    store.upsertServicio({ ...servicio, ventanaPulsoDias: dias });
  };

  const tareasServ = useMemo(() => tareasDe(store.tareas, servicio.id), [store.tareas, servicio.id]);

  // ── Cómputo de eventos en la ventana ──
  // Tareas cerradas en la ventana (fechaFinReal cae dentro)
  const tareasCerradas = tareasServ.filter(t => {
    if (t.estado !== 'Completada' || !t.fechaFinReal) return false;
    const f = parseDate(t.fechaFinReal);
    return f && f >= desde && f <= HOY;
  });

  // Tareas que están atrasadas a HOY (no completadas con fin plan < HOY)
  const tareasAtrasadasHoy = tareasAtrasadasAt(store.tareas, servicio.id, HOY);

  // Cambios registrados en la ventana
  const cambiosEnVentana = (servicio.cambios || []).filter(c => {
    const f = parseDate(c.fechaRegistro);
    return f && f >= desde && f <= HOY;
  });

  // Hitos cumplidos en la ventana (fechaCertReal cae dentro)
  const hitosCumplidosVentana = (servicio.hitos || []).filter(h => {
    if (!h.cumplido || !h.fechaCertReal) return false;
    const f = parseDate(h.fechaCertReal);
    return f && f >= desde && f <= HOY;
  });

  // Bloqueos abiertos a HOY (no tienen fecha de apertura, mostramos los activos)
  const bloqueosAbiertos = (servicio.bloqueos || []).filter(b => b.estado !== 'Cerrado');
  const bloqueosEscalados = bloqueosAbiertos.filter(b => b.escalado);

  const totalEventos = tareasCerradas.length + cambiosEnVentana.length + hitosCumplidosVentana.length + tareasAtrasadasHoy.length + bloqueosAbiertos.length;

  return (
    <div className="panel" style={{ borderTop: '3px solid var(--orange)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div className="panel-title" style={{ margin: 0 }}>📅 Novedades del proyecto</div>
          <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 4 }}>
            Desde el <span className="mono">{ddmmaaaa(desde)}</span> hasta hoy ({ddmmaaaa(HOY)}) · <strong>{totalEventos}</strong> evento{totalEventos === 1 ? '' : 's'}
          </div>
        </div>
        <div className="cert-year-pills">
          <button className={`cert-year-pill ${ventana === 7 ? 'active' : ''}`} onClick={() => cambiarVentana(7)}>7d</button>
          <button className={`cert-year-pill ${ventana === 14 ? 'active' : ''}`} onClick={() => cambiarVentana(14)}>14d</button>
        </div>
      </div>

      {totalEventos === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--gray-mute)', fontSize: 13 }}>
          Sin novedades en esta ventana. El proyecto avanzó sin cambios registrados.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>

          {/* Tareas cerradas */}
          {tareasCerradas.length > 0 && (
            <BloqueNovedad icono="✓" color="var(--green)" titulo="Tareas cerradas" count={tareasCerradas.length}>
              {tareasCerradas.slice(0, 5).map(t => (
                <li key={t.id}>
                  <span>{t.nombre}</span>
                  <span className="nov-meta">{t.fechaFinReal}</span>
                </li>
              ))}
              {tareasCerradas.length > 5 && <li className="nov-mas">+ {tareasCerradas.length - 5} más</li>}
            </BloqueNovedad>
          )}

          {/* Cambios registrados */}
          {cambiosEnVentana.length > 0 && (
            <BloqueNovedad icono="📋" color="var(--orange)" titulo="Cambios registrados" count={cambiosEnVentana.length}>
              {cambiosEnVentana.slice(0, 5).map(c => (
                <li key={c.id}>
                  <span><strong>{TIPO_CAMBIO_LABEL[c.tipo]}:</strong> {
                    c.tipo === 'Alcance' ? (c.descripcion || '—')
                      : <>{c.valorAnterior} → {c.valorNuevo}</>
                  }</span>
                  <span className="nov-meta">
                    {c.fechaRegistro}
                    {c.elevarComercial && <span className="pill pend" style={{ fontSize: 9, padding: '1px 6px', marginLeft: 4 }}>↑</span>}
                  </span>
                </li>
              ))}
            </BloqueNovedad>
          )}

          {/* Hitos cumplidos */}
          {hitosCumplidosVentana.length > 0 && (
            <BloqueNovedad icono="🎯" color="var(--green)" titulo="Hitos cumplidos" count={hitosCumplidosVentana.length}>
              {hitosCumplidosVentana.map(h => (
                <li key={h.id}>
                  <span>{h.nombre}</span>
                  <span className="nov-meta">{h.fechaCertReal}</span>
                </li>
              ))}
            </BloqueNovedad>
          )}

          {/* Tareas atrasadas HOY (no es de la ventana, pero es la foto al día) */}
          {tareasAtrasadasHoy.length > 0 && (
            <BloqueNovedad icono="⚠" color="var(--orange)" titulo="Tareas atrasadas a hoy" count={tareasAtrasadasHoy.length}>
              {tareasAtrasadasHoy.slice(0, 5).map(t => (
                <li key={t.id}>
                  <span>{t.nombre}</span>
                  <span className="nov-meta" style={{ color: 'var(--red)' }}>vencía {t.fechaFinPlan}</span>
                </li>
              ))}
              {tareasAtrasadasHoy.length > 5 && <li className="nov-mas">+ {tareasAtrasadasHoy.length - 5} más</li>}
            </BloqueNovedad>
          )}

          {/* Bloqueos abiertos */}
          {bloqueosAbiertos.length > 0 && (
            <BloqueNovedad icono="⚑" color="var(--red)"
              titulo={`Bloqueos abiertos${bloqueosEscalados.length > 0 ? ` (${bloqueosEscalados.length} escalado${bloqueosEscalados.length === 1 ? '' : 's'})` : ''}`}
              count={bloqueosAbiertos.length}>
              {bloqueosAbiertos.slice(0, 5).map((b, i) => (
                <li key={i}>
                  <span>{b.titulo} {b.escalado && <span className="escalar-badge" style={{ fontSize: 9, marginLeft: 4 }}>ESC</span>}</span>
                  <span className="nov-meta">{b.owner}</span>
                </li>
              ))}
            </BloqueNovedad>
          )}

        </div>
      )}
    </div>
  );
}

function BloqueNovedad({
  icono, color, titulo, count, children,
}: { icono: string; color: string; titulo: string; count: number; children: React.ReactNode }) {
  return (
    <div className="nov-bloque" style={{ borderLeftColor: color }}>
      <div className="nov-bloque-head" style={{ color }}>
        <span style={{ fontSize: 14 }}>{icono}</span>
        <span>{titulo}</span>
        <span className="nov-bloque-count" style={{ background: color }}>{count}</span>
      </div>
      <ul className="nov-bloque-list">
        {children}
      </ul>
    </div>
  );
}

// ============================================================
// Panel "Bloqueos del proyecto" — el PM agrega, edita y cierra bloqueos
// desde su workspace, sin tener que abrir el modal del servicio ni el del pulso.
// ============================================================
function BloqueosPanel({ store, servicio }: { store: Store; servicio: Servicio }) {
  const bloqueos = servicio.bloqueos || [];
  const [editando, setEditando] = useState<{ idx: number | null; bloqueo: Bloqueo } | null>(null);

  const guardarBloqueo = (idx: number | null, b: Bloqueo) => {
    const next = [...(servicio.bloqueos || [])];
    if (idx == null) next.push(b);
    else next[idx] = b;
    store.upsertServicio({ ...servicio, bloqueos: next });
    showToast(idx == null ? 'Bloqueo agregado' : 'Bloqueo actualizado');
    setEditando(null);
  };
  const eliminarBloqueo = (idx: number) => {
    if (!confirm('¿Eliminar este bloqueo?')) return;
    const next = (servicio.bloqueos || []).filter((_, i) => i !== idx);
    store.upsertServicio({ ...servicio, bloqueos: next });
    showToast('Bloqueo eliminado');
  };
  const cerrarBloqueo = (idx: number) => {
    const next = [...(servicio.bloqueos || [])];
    next[idx] = { ...next[idx], estado: 'Cerrado', escalado: false };
    store.upsertServicio({ ...servicio, bloqueos: next });
    showToast('Bloqueo cerrado');
  };

  const abiertos = bloqueos.filter(b => b.estado !== 'Cerrado');
  const escalados = abiertos.filter(b => b.escalado);

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="panel-title" style={{ margin: 0 }}>
          ⚑ Bloqueos del proyecto
          {abiertos.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--red)', fontWeight: 700 }}>· {abiertos.length} abierto{abiertos.length === 1 ? '' : 's'}{escalados.length > 0 ? `, ${escalados.length} escalado${escalados.length === 1 ? '' : 's'}` : ''}</span>}
        </div>
        <button className="btn btn-sm btn-primary"
          onClick={() => setEditando({ idx: null, bloqueo: { titulo: '', desc: '', owner: '', estado: 'Abierto', escalado: false } })}>
          + Nuevo bloqueo
        </button>
      </div>

      {bloqueos.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--gray-mute)', fontSize: 13 }}>
          Sin bloqueos cargados. Si surge un impedimento, agregalo para que quede registrado.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {bloqueos.map((b, i) => {
            const cerrado = b.estado === 'Cerrado';
            return (
              <div key={i} className={`block-detail ${b.escalado ? 'escalar' : ''}`}
                style={cerrado ? { opacity: .55, background: '#fafafa' } : undefined}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <div className="block-detail-title" style={{ flex: 1, minWidth: 200 }}>
                    {b.titulo || <span style={{ color: 'var(--gray-mute)' }}>— Sin título —</span>}
                    {b.categoria && <span className="badge llave" style={{ marginLeft: 8, fontSize: 10 }}>{b.categoria}</span>}
                    {b.escalado && !cerrado && <span className="escalar-badge" style={{ marginLeft: 6 }}>ESCALAR</span>}
                    {cerrado && <span className="pill ok" style={{ marginLeft: 6, fontSize: 10 }}>✓ Cerrado</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {!cerrado && <button className="btn btn-sm btn-secondary" onClick={() => cerrarBloqueo(i)} title="Marcar como resuelto">✓</button>}
                    <button className="btn btn-sm btn-secondary" onClick={() => setEditando({ idx: i, bloqueo: { ...b } })} title="Editar">✏</button>
                    <button className="btn btn-sm btn-danger" onClick={() => eliminarBloqueo(i)} title="Eliminar">×</button>
                  </div>
                </div>
                {b.desc && <div className="block-detail-desc" style={{ marginTop: 4 }}>{b.desc}</div>}
                <div className="block-detail-meta" style={{ marginTop: 4 }}>
                  <span><strong>Owner:</strong> {b.owner || '—'}</span>
                  <span><strong>Estado:</strong> {b.estado}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <BloqueoEditModal
          bloqueo={editando.bloqueo}
          categorias={store.categoriasBloqueo}
          onClose={() => setEditando(null)}
          onSave={b => guardarBloqueo(editando.idx, b)}
        />
      )}
    </div>
  );
}

// (BloqueoEditModal y RiesgoEditModal viven en BloqueoRiesgoModals.tsx para
// poder ser usados también desde Servicios — única fuente de verdad del form.)

// ============================================================
// Panel "Riesgos del proyecto" — distinto de Bloqueos: cosas que PODRÍAN
// ocurrir y afectar al proyecto. Probabilidad × Impacto = severidad.
// Cuando un riesgo se materializa, se puede convertir directamente en Bloqueo.
// ============================================================
function RiesgosPanel({ store, servicio }: { store: Store; servicio: Servicio }) {
  const riesgos = servicio.riesgos || [];
  const [editando, setEditando] = useState<{ idx: number | null; riesgo: Riesgo } | null>(null);

  const guardar = (idx: number | null, r: Riesgo) => {
    const next = [...(servicio.riesgos || [])];
    if (idx == null) next.push(r);
    else next[idx] = r;
    store.upsertServicio({ ...servicio, riesgos: next });
    showToast(idx == null ? 'Riesgo agregado' : 'Riesgo actualizado');
    setEditando(null);
  };
  const eliminar = (idx: number) => {
    if (!confirm('¿Eliminar este riesgo?')) return;
    const next = (servicio.riesgos || []).filter((_, i) => i !== idx);
    store.upsertServicio({ ...servicio, riesgos: next });
    showToast('Riesgo eliminado');
  };
  // Materializar: el riesgo pasa a 'Materializado' y se crea un Bloqueo activo a partir de él.
  const materializar = (idx: number) => {
    const r = (servicio.riesgos || [])[idx];
    if (!r) return;
    if (!confirm(`¿Materializar el riesgo "${r.titulo}"? Se crea un bloqueo activo con sus datos y el riesgo queda como "Materializado".`)) return;
    const nuevosRiesgos = [...(servicio.riesgos || [])];
    nuevosRiesgos[idx] = { ...r, estado: 'Materializado', fechaCierre: ddmmaaaa(HOY) };
    const nuevoBloqueo: Bloqueo = {
      titulo: r.titulo,
      desc: r.descripcion || (r.mitigacion ? `Mitigación intentada: ${r.mitigacion}` : ''),
      owner: r.owner,
      estado: 'Abierto',
      escalado: false,
      categoria: r.categoria,
    };
    store.upsertServicio({
      ...servicio,
      riesgos: nuevosRiesgos,
      bloqueos: [...(servicio.bloqueos || []), nuevoBloqueo],
    });
    showToast('Riesgo materializado → bloqueo activo creado');
  };

  const activos = riesgos.filter(r => r.estado === 'Identificado' || r.estado === 'Mitigado');
  const criticos = activos.filter(r => severidadRiesgo(r).nivel === 'Crítico').length;

  const blank: Riesgo = {
    id: Date.now(), titulo: '', probabilidad: 'Media' as NivelProbabilidad, impacto: 'Medio' as NivelImpacto,
    owner: '', estado: 'Identificado', fechaIdentificacion: ddmmaaaa(HOY),
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="panel-title" style={{ margin: 0 }}>
          ⚠ Riesgos del proyecto
          {activos.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--orange)', fontWeight: 700 }}>· {activos.length} activo{activos.length === 1 ? '' : 's'}{criticos > 0 ? `, ${criticos} crítico${criticos === 1 ? '' : 's'}` : ''}</span>}
        </div>
        <button className="btn btn-sm btn-primary"
          onClick={() => setEditando({ idx: null, riesgo: blank })}>
          + Identificar riesgo
        </button>
      </div>

      {riesgos.length === 0 ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--gray-mute)', fontSize: 13 }}>
          Sin riesgos identificados. Anticipá problemas potenciales para tener planes de mitigación.
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Riesgo</th>
              <th style={{ width: '10%' }}>Severidad</th>
              <th style={{ width: '10%' }}>Prob × Imp</th>
              <th style={{ width: '12%' }}>Estado</th>
              <th style={{ width: '14%' }}>Owner</th>
              <th>Mitigación</th>
              <th style={{ width: '14%' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[...riesgos].sort((a, b) => severidadRiesgo(b).valor - severidadRiesgo(a).valor).map((r, _ord) => {
              const idx = riesgos.indexOf(r);
              const sev = severidadRiesgo(r);
              const sevColor = sev.nivel === 'Crítico' ? 'var(--red)' : sev.nivel === 'Alto' ? 'var(--orange)' : sev.nivel === 'Medio' ? '#f5a623' : 'var(--green)';
              const sevBg = sev.nivel === 'Crítico' ? 'var(--red-soft)' : sev.nivel === 'Alto' ? 'var(--orange-soft)' : sev.nivel === 'Medio' ? '#fff7e6' : 'var(--green-soft)';
              const cerrado = r.estado === 'Cerrado' || r.estado === 'Materializado';
              return (
                <tr key={r.id} style={cerrado ? { opacity: .6 } : undefined}>
                  <td>
                    <strong>{r.titulo}</strong>
                    {r.categoria && <span className="badge llave" style={{ marginLeft: 6, fontSize: 9 }}>{r.categoria}</span>}
                    {r.descripcion && <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 2 }}>{r.descripcion}</div>}
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 999, background: sevBg, color: sevColor, fontWeight: 700, fontSize: 11, border: `1px solid ${sevColor}` }}>
                      {sev.nivel}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 11 }}>{r.probabilidad[0]} × {r.impacto[0]} = {sev.valor}</td>
                  <td><span className={`pill ${r.estado === 'Identificado' ? 'pend' : r.estado === 'Mitigado' ? 'ok' : r.estado === 'Materializado' ? 'venc' : ''}`}>{r.estado}</span></td>
                  <td style={{ fontSize: 12 }}>{r.owner || <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                  <td style={{ fontSize: 12 }}>{r.mitigacion || <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {!cerrado && <button className="btn btn-sm btn-secondary" onClick={() => materializar(idx)} title="El riesgo se concretó: convertir en bloqueo activo">→⚑</button>}
                      <button className="btn btn-sm btn-secondary" onClick={() => setEditando({ idx, riesgo: { ...r } })} title="Editar">✏</button>
                      <button className="btn btn-sm btn-danger" onClick={() => eliminar(idx)} title="Eliminar">×</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {editando && (
        <RiesgoEditModal
          riesgo={editando.riesgo}
          categorias={store.categoriasBloqueo}
          onClose={() => setEditando(null)}
          onSave={r => guardar(editando.idx, r)}
        />
      )}
    </div>
  );
}

// ============================================================
// Panel "Cambios del proyecto" — el PM registra cambios de alcance y fecha
// desde su workspace, sin tener que ir a Servicios. Muestra historial reciente.
// ============================================================
function CambiosDelProyectoPanel({
  store, servicio, usuario,
}: { store: Store; servicio: Servicio; usuario: string }) {
  const [openAlcance, setOpenAlcance] = useState(false);
  const [openFecha, setOpenFecha] = useState(false);

  const cambios = servicio.cambios || [];
  const cambiosOrden = [...cambios].sort((a, b) => b.id - a.id);
  const ultimosCambios = cambiosOrden.slice(0, 5);

  const guardarAlcance = (c: CambioServicio) => {
    store.upsertServicio({ ...servicio, cambios: [...(servicio.cambios || []), c] });
    showToast('Cambio de alcance registrado');
    setOpenAlcance(false);
  };

  const guardarFecha = (r: { cambio: CambioServicio; campo: 'inicio' | 'fin'; nuevaFecha: string }) => {
    store.upsertServicio({
      ...servicio,
      [r.campo]: r.nuevaFecha,
      cambios: [...(servicio.cambios || []), r.cambio],
    });
    showToast('Cambio de fecha registrado');
    setOpenFecha(false);
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div className="panel-title" style={{ margin: 0 }}>
          Cambios del proyecto {cambios.length > 0 && <span style={{ color: 'var(--gray-mute)', marginLeft: 4 }}>({cambios.length})</span>}
        </div>
        {servicio.estado !== 'Cerrado' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setOpenFecha(true)}>📅 Registrar cambio de fecha</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setOpenAlcance(true)}>📋 Registrar cambio de alcance</button>
          </div>
        )}
      </div>

      {cambios.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin cambios registrados todavía.</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th style={{ width: '11%' }}>Fecha</th>
                <th style={{ width: '14%' }}>Tipo</th>
                <th style={{ width: '24%' }}>De → A</th>
                <th>Motivo / Descripción</th>
                <th style={{ width: '12%' }}>Autor</th>
                <th style={{ width: '14%' }}>Elevación</th>
              </tr>
            </thead>
            <tbody>
              {ultimosCambios.map(c => (
                <tr key={c.id}>
                  <td className="mono">{c.fechaRegistro}</td>
                  <td><span className="badge cons">{TIPO_CAMBIO_LABEL[c.tipo]}</span></td>
                  <td style={{ fontSize: 11 }}>
                    {c.tipo === 'Alcance' ? (
                      <span style={{ color: 'var(--gray-mute)' }}>—</span>
                    ) : (
                      <>
                        <span className="mono" style={{ color: 'var(--gray-mute)', textDecoration: 'line-through' }}>{c.valorAnterior}</span>
                        <span style={{ margin: '0 4px' }}>→</span>
                        <span className="mono" style={{ fontWeight: 700 }}>{c.valorNuevo}</span>
                      </>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {c.descripcion && <div>{c.descripcion}</div>}
                    {c.motivo && <div style={{ color: 'var(--gray-mute)', fontStyle: c.descripcion ? 'italic' : 'normal' }}>{c.motivo}</div>}
                    {!c.descripcion && !c.motivo && <span style={{ color: 'var(--gray-mute)' }}>—</span>}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.autor}</td>
                  <td>
                    {c.elevarComercial ? (
                      <span className="pill pend" title={c.estadoElevacion}>↑ Comercial{c.estadoElevacion ? ` · ${c.estadoElevacion}` : ''}</span>
                    ) : (
                      <span style={{ color: 'var(--gray-mute)', fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {cambios.length > 5 && (
            <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 8, textAlign: 'center' }}>
              Mostrando los 5 más recientes — ver la ficha del servicio para el historial completo
            </div>
          )}
        </>
      )}

      {openAlcance && <RegistrarAlcanceModal autor={usuario} onClose={() => setOpenAlcance(false)} onConfirm={guardarAlcance} />}
      {openFecha && <RegistrarCambioFechaModal autor={usuario}
        fechaInicioActual={servicio.inicio} fechaFinActual={servicio.fin}
        onClose={() => setOpenFecha(false)} onConfirm={guardarFecha} />}
    </div>
  );
}

// ============================================================
// Panel de Equipo dentro del detalle del proyecto (Avances)
// Lectura derivada de PROFESIONAL_SERVICIO (vía equipoDe). El PM lo ve sin tener
// que ir a Servicios o Recursos. Para editar, va al modal del servicio.
// ============================================================
function EquipoPanel({ store, servicio }: { store: Store; servicio: Servicio }) {
  const equipo = useMemo(
    () => equipoDe(servicio.id, store.recursos, store.servicios, store.clientes),
    [servicio.id, store.recursos, store.servicios, store.clientes],
  );
  // Orden por importancia: PM, LT/Arquitecto, resto
  const rank = (perfil: string): number => {
    if (/PM/i.test(perfil)) return 0;
    if (/LT|Arquitect/i.test(perfil)) return 1;
    return 2;
  };
  const ordenado = useMemo(
    () => [...equipo].sort((a, b) => rank(a.perfil) - rank(b.perfil) || a.nombre.localeCompare(b.nombre)),
    [equipo],
  );

  if (equipo.length === 0) {
    return (
      <div className="panel">
        <div className="panel-title">Equipo del servicio</div>
        <div className="empty-state" style={{ padding: '10px 0', fontSize: 13 }}>
          Aún no hay miembros asignados. Editá el servicio (Servicios → ficha → Editar) para asignar profesionales.
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-title">Equipo del servicio · {equipo.length} {equipo.length === 1 ? 'miembro' : 'miembros'}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {ordenado.map(m => {
          const esPM = /PM/i.test(m.perfil);
          const esLT = /LT|Arquitect/i.test(m.perfil);
          const accent = esPM ? 'var(--orange)' : esLT ? 'var(--gray-dark)' : 'var(--gray-line)';
          return (
            <div key={m.recursoId}
              title={`${m.nombre} · ${m.perfil} ${m.seniority} · ${m.porcentaje}%${m.fechaDesde ? ` · desde ${m.fechaDesde}` : ''}${m.fechaHasta ? ` hasta ${m.fechaHasta}` : ''}`}
              style={{
                background: 'var(--card)', border: `1.5px solid ${accent}`, borderRadius: 8,
                padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
              }}>
              <span style={{ fontWeight: 700, color: 'var(--gray-dark)' }}>{m.nombre}</span>
              <span style={{ color: accent, fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{m.perfil}</span>
              {m.seniority && <span style={{ color: 'var(--gray-mute)', fontSize: 11 }}>· {m.seniority}</span>}
              <span className="mono" style={{ color: 'var(--gray-mute)', fontSize: 11 }}>{m.porcentaje}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Panel de Hitos dentro del detalle del proyecto (Avances)
// El PM puede certificar el hito desde acá.
// ============================================================
function HitosPanel({ store, servicio }: { store: Store; servicio: Servicio }) {
  const [editing, setEditing] = useState<HitoServicio | null>(null);

  const toggle = (h: HitoServicio) => {
    const cumplido = !h.cumplido;
    const nuevos = servicio.hitos.map(x => x.id === h.id
      ? { ...x, cumplido, fechaCertReal: cumplido ? (x.fechaCertReal || HOY.toLocaleDateString('es-AR')) : undefined }
      : x);
    store.upsertServicio({ ...servicio, hitos: nuevos });
    showToast(cumplido ? `Hito certificado: ${h.nombre}` : `Hito marcado pendiente: ${h.nombre}`);
  };

  const guardarEdicion = (h: HitoServicio) => {
    const nuevos = servicio.hitos.map(x => x.id === h.id ? h : x);
    store.upsertServicio({ ...servicio, hitos: nuevos });
    setEditing(null);
    showToast('Hito actualizado');
  };

  if (servicio.hitos.length === 0) {
    return <div className="empty-state">Este proyecto no tiene hitos cargados. Editalo desde Servicios para agregarlos.</div>;
  }

  return (
    <>
      <table>
        <thead>
          <tr>
            <th>Hito</th>
            <th style={{ width: '13%' }}>Responsable</th>
            <th style={{ width: '6%' }}>% Fact</th>
            <th style={{ width: '10%' }}>Fecha esperada</th>
            <th style={{ width: '10%' }}>Fecha real</th>
            <th style={{ width: '8%' }}>Estado</th>
            <th style={{ width: '14%' }}>Certificación</th>
            <th style={{ width: '8%' }}>Editar</th>
          </tr>
        </thead>
        <tbody>
          {servicio.hitos.map(h => {
            const f = parseDate(h.fechaCert);
            const vencido = f && f < HOY && !h.cumplido;
            const pillCls = h.cumplido ? 'ok' : vencido ? 'venc' : 'pend';
            const estado = h.cumplido ? 'Cumplido' : vencido ? 'Vencido' : 'Pendiente';
            const resp = h.responsableId ? store.recursos.find(x => x.id === h.responsableId) : undefined;
            return (
              <tr key={h.id}>
                <td><strong>{h.nombre}</strong>{h.comentarioCert && <small style={{ display: 'block' }}>{h.comentarioCert}</small>}</td>
                <td>{resp ? nombreCompleto(resp) : <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                <td className="mono">{h.porcentaje}%</td>
                <td className="mono">{h.fechaCert || '—'}</td>
                <td className="mono">{h.fechaCertReal || '—'}</td>
                <td><span className={`pill ${pillCls}`}>{estado}</span></td>
                <td>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!h.cumplido} onChange={() => toggle(h)} style={{ width: 16, height: 16 }} />
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{h.cumplido ? 'Certificado' : 'Marcar'}</span>
                  </label>
                </td>
                <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing(h)}>✏</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <HitoEditModal
        open={editing != null}
        hito={editing}
        onClose={() => setEditing(null)}
        onSave={guardarEdicion}
      />
    </>
  );
}

function HitoEditModal({ open, hito, onClose, onSave }: {
  open: boolean; hito: HitoServicio | null;
  onClose: () => void; onSave: (h: HitoServicio) => void;
}) {
  const [f, setF] = useState<HitoServicio | null>(hito);
  useEffect(() => { setF(hito); }, [hito]);
  if (!open || !f) return null;
  const u = (p: Partial<HitoServicio>) => setF(prev => prev ? { ...prev, ...p } : prev);
  return (
    <Modal open={open} title={`Editar hito — ${f.nombre || ''}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(f)}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-group"><label>Nombre</label><input value={f.nombre} onChange={e => u({ nombre: e.target.value })} /></div>
        <div className="form-group"><label>% Facturación</label><input type="number" min={0} max={100} value={f.porcentaje || ''} onChange={e => u({ porcentaje: e.target.value === '' ? 0 : Number(e.target.value) })} /></div>
        <div className="form-group"><label>Fecha esperada</label><input value={f.fechaCert} onChange={e => u({ fechaCert: e.target.value })} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Fecha real cert.</label><input value={f.fechaCertReal || ''} onChange={e => u({ fechaCertReal: e.target.value })} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Horas</label><input type="number" step="0.1" value={f.horas ?? ''} onChange={e => u({ horas: e.target.value === '' ? null : Number(e.target.value) })} /></div>
        <div className="form-group"><label>Cumplido</label>
          <select value={f.cumplido ? 'true' : 'false'} onChange={e => u({ cumplido: e.target.value === 'true' })}>
            <option value="false">No</option><option value="true">Sí</option>
          </select>
        </div>
        <div className="form-group full"><label>Comentario de certificación</label>
          <textarea value={f.comentarioCert || ''} onChange={e => u({ comentarioCert: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

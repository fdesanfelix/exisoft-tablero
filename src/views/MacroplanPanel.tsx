import { useEffect, useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { SortableTh, useSort } from '../components/Sort';
import {
  ddmmaaaa, equipoDe, ESTADOS_TAREA, HOY, nombreCompleto, parseDate, responsableDe, tareasDe,
  type CambioServicio, type EstadoTarea, type HitoServicio, type Recurso, type Servicio, type Tarea,
} from '../types';

type Store = ReturnType<typeof useStore>;

const ESTADO_CLS: Record<EstadoTarea, string> = {
  'Pendiente': 'pend',
  'En curso': 'proy',
  'Completada': 'ok',
  'Bloqueada': 'venc',
  'Cancelada': 'na',
};

interface Props { store: Store; servicio: Servicio; usuario: string; }

export function MacroplanPanel({ store, servicio, usuario }: Props) {
  const [editing, setEditing] = useState<Tarea | null>(null);
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [filtro, setFiltro] = useState<EstadoTarea | 'all' | 'activas'>('activas');
  // Cuando se detecta que la tarea recién guardada empuja más allá de la fecha fin
  // del servicio, abrimos este modal pidiendo confirmación para extender.
  const [extendiendo, setExtendiendo] = useState<{ tarea: Tarea; nuevaFechaFin: string } | null>(null);

  const tareas = useMemo(() => tareasDe(store.tareas, servicio.id), [store.tareas, servicio.id]);
  const filtradas = useMemo(() => tareas.filter(t => {
    if (filtro === 'all') return true;
    if (filtro === 'activas') return t.estado !== 'Completada' && t.estado !== 'Cancelada';
    return t.estado === filtro;
  }), [tareas, filtro]);

  const k = useMemo(() => {
    const activas = tareas.filter(t => t.estado !== 'Cancelada');
    const compl = activas.filter(t => t.estado === 'Completada').length;
    const enc = activas.filter(t => t.estado === 'En curso').length;
    const pend = activas.filter(t => t.estado === 'Pendiente').length;
    const bloq = activas.filter(t => t.estado === 'Bloqueada').length;
    const atrasadas = activas.filter(t => {
      if (t.estado === 'Completada') return false;
      const ff = parseDate(t.fechaFinPlan);
      return !!ff && ff < HOY;
    }).length;
    const pct = activas.length === 0 ? 0 : Math.round((compl / activas.length) * 100);
    return { total: activas.length, compl, enc, pend, bloq, atrasadas, pct };
  }, [tareas]);

  type SK = 'nombre' | 'responsable' | 'fechaInicioPlan' | 'fechaFinPlan' | 'estado';
  const { sorted, sort } = useSort<Tarea, SK>(filtradas, (t, k) => {
    if (k === 'responsable') return responsableDe(t, store.recursos);
    if (k === 'fechaInicioPlan') return parseDate(t.fechaInicioPlan)?.getTime() ?? 0;
    if (k === 'fechaFinPlan') return parseDate(t.fechaFinPlan)?.getTime() ?? 0;
    return t[k] as string | number;
  }, 'fechaInicioPlan');

  const toggleCompleta = (t: Tarea) => {
    const completa = t.estado !== 'Completada';
    store.upsertTarea({
      ...t,
      estado: completa ? 'Completada' : 'En curso',
      fechaFinReal: completa ? ddmmaaaa(HOY) : undefined,
    });
    showToast(completa ? `✓ Completada: ${t.nombre}` : `Reabierta: ${t.nombre}`);
  };

  // ── Coherencia de fechas: la fecha fin del proyecto debe igualar la última fechaFinPlan del macroplan ──
  const ultimaTareaFin = useMemo(() => {
    let max: Date | null = null;
    let maxStr = '';
    tareas.forEach(t => {
      if (t.estado === 'Cancelada') return;
      const f = parseDate(t.fechaFinPlan);
      if (f && (!max || f > max)) { max = f; maxStr = t.fechaFinPlan; }
    });
    return { fecha: max as Date | null, str: maxStr };
  }, [tareas]);
  const fechaServFin = parseDate(servicio.fin);
  const mismatch = ultimaTareaFin.fecha && fechaServFin && ultimaTareaFin.fecha.getTime() !== fechaServFin.getTime();
  const ultimaExcede = ultimaTareaFin.fecha && fechaServFin && ultimaTareaFin.fecha > fechaServFin;

  const extenderServicio = (nuevaFecha: string, motivoExtra?: string) => {
    const fechaAnterior = servicio.fin;
    const cambio: CambioServicio = {
      id: Date.now(),
      tipo: 'FechaFin',
      fechaRegistro: ddmmaaaa(HOY),
      valorAnterior: fechaAnterior,
      valorNuevo: nuevaFecha,
      motivo: motivoExtra || 'Ajuste por cambio en el macroplan del proyecto',
      elevarComercial: false,
      autor: usuario,
    };
    store.upsertServicio({
      ...servicio,
      fin: nuevaFecha,
      cambios: [...(servicio.cambios || []), cambio],
    });
    showToast(`Fecha fin del proyecto extendida a ${nuevaFecha}`);
  };

  return (
    <>
      {/* Banner permanente cuando la última tarea no coincide con la fecha del proyecto */}
      {mismatch && (
        <div style={{ background: ultimaExcede ? 'var(--red-soft)' : 'var(--orange-soft)', border: `1px solid ${ultimaExcede ? 'var(--red)' : 'var(--orange)'}`, borderRadius: 8, padding: '8px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: ultimaExcede ? 'var(--red)' : 'var(--orange)', fontWeight: 600 }}>
            ⚠ Última tarea termina el <span className="mono">{ultimaTareaFin.str}</span> · proyecto cierra el <span className="mono">{servicio.fin || '—'}</span>
            {ultimaExcede ? ' (tareas exceden el proyecto)' : ' (proyecto queda más largo que el macroplan)'}
          </span>
          {ultimaExcede && (
            <button className="btn btn-sm btn-primary" style={{ marginLeft: 'auto' }}
              onClick={() => extenderServicio(ultimaTareaFin.str)}>
              Extender proyecto a {ultimaTareaFin.str}
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', fontSize: 12 }}>
          <span><strong>Avance global:</strong> <span className="mono" style={{ color: 'var(--orange)', fontWeight: 700 }}>{k.pct}%</span></span>
          <span style={{ color: 'var(--gray-mute)' }}>·</span>
          <span>{k.compl}/{k.total} completadas</span>
          {k.atrasadas > 0 && <span className="chip" style={{ color: 'var(--red)', borderColor: 'var(--red)' }}>{k.atrasadas} atrasadas</span>}
          {k.bloq > 0 && <span className="chip warn">{k.bloq} bloqueadas</span>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => setOpenImport(true)}>📋 Importar Excel/CSV</button>
          <button className="btn btn-sm btn-primary" onClick={() => setOpenNew(true)}>+ Nueva tarea</button>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 12 }}>
        <div className="filter-group">
          <span className="filter-group-label">Filtro</span>
          <button className={`filter-btn ${filtro === 'activas' ? 'active' : ''}`} onClick={() => setFiltro('activas')}>Activas <span className="mono">{tareas.filter(t => t.estado !== 'Completada' && t.estado !== 'Cancelada').length}</span></button>
          <button className={`filter-btn ${filtro === 'all' ? 'active' : ''}`} onClick={() => setFiltro('all')}>Todas <span className="mono">{tareas.length}</span></button>
          {ESTADOS_TAREA.map(e => (
            <button key={e} className={`filter-btn ${filtro === e ? 'active' : ''}`} onClick={() => setFiltro(e)}>{e}</button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="empty-state">Sin tareas. Agregá una o importá un CSV.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: '4%' }}></th>
              <SortableTh field="nombre" sort={sort}>Tarea</SortableTh>
              <SortableTh field="responsable" sort={sort} style={{ width: '15%' }}>Responsable</SortableTh>
              <SortableTh field="fechaInicioPlan" sort={sort} style={{ width: '10%' }}>Inicio plan</SortableTh>
              <SortableTh field="fechaFinPlan" sort={sort} style={{ width: '10%' }}>Fin plan</SortableTh>
              <th style={{ width: '10%' }}>Fin real</th>
              <SortableTh field="estado" sort={sort} style={{ width: '10%' }}>Estado</SortableTh>
              <th style={{ width: '8%' }}>Editar</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(t => {
              const ff = parseDate(t.fechaFinPlan);
              const atrasada = ff && ff < HOY && t.estado !== 'Completada' && t.estado !== 'Cancelada';
              return (
                <tr key={t.id} className={atrasada ? 'warn-row' : ''}>
                  <td>
                    <input type="checkbox" checked={t.estado === 'Completada'}
                      onChange={() => toggleCompleta(t)} style={{ width: 16, height: 16 }} />
                  </td>
                  <td>
                    <strong>{t.nombre}</strong>
                    {atrasada && <span className="chip" style={{ marginLeft: 6 }}>Atrasada</span>}
                    {t.hitoId && (
                      <span className="chip info" style={{ marginLeft: 6 }}>
                        Hito: {servicio.hitos.find(h => h.id === t.hitoId)?.nombre || '—'}
                      </span>
                    )}
                  </td>
                  <td>{responsableDe(t, store.recursos) || <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                  <td className="mono">{t.fechaInicioPlan}</td>
                  <td className="mono">{t.fechaFinPlan}</td>
                  <td className="mono">{t.fechaFinReal || '—'}</td>
                  <td><span className={`pill ${ESTADO_CLS[t.estado]}`}>{t.estado}</span></td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => setEditing(t)}>✏</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <TareaModal
        open={openNew || editing != null}
        tarea={editing}
        servicio={servicio}
        recursos={store.recursos}
        nextOrden={tareas.reduce((m, t) => Math.max(m, t.orden ?? 0), 0) + 1}
        onClose={() => { setEditing(null); setOpenNew(false); }}
        onSave={t => {
          store.upsertTarea(t);
          showToast(editing ? 'Tarea actualizada' : 'Tarea creada');
          setEditing(null); setOpenNew(false);
          // Si la tarea recién guardada empuja más allá de la fecha fin del proyecto,
          // ofrecemos extender el proyecto + registrar el cambio en el historial.
          const fechaTareaFin = parseDate(t.fechaFinPlan);
          const fechaServFin = parseDate(servicio.fin);
          if (fechaTareaFin && fechaServFin && fechaTareaFin > fechaServFin) {
            setExtendiendo({ tarea: t, nuevaFechaFin: t.fechaFinPlan });
          }
        }}
        onDelete={id => {
          if (!confirm('¿Eliminar la tarea?')) return;
          store.deleteTarea(id);
          showToast('Tarea eliminada');
          setEditing(null);
        }}
      />

      <ImportTareasModal
        open={openImport}
        servicio={servicio}
        recursos={store.recursos}
        onClose={() => setOpenImport(false)}
        onImport={items => { store.bulkUpsertTareas(items); showToast(`${items.length} tareas importadas`); setOpenImport(false); }}
      />

      {extendiendo && (
        <ExtenderProyectoModal
          tarea={extendiendo.tarea}
          fechaProyecto={servicio.fin}
          fechaNueva={extendiendo.nuevaFechaFin}
          onCancelar={() => setExtendiendo(null)}
          onConfirmar={motivo => {
            extenderServicio(extendiendo.nuevaFechaFin, motivo);
            setExtendiendo(null);
          }}
        />
      )}
    </>
  );
}

// ============================================================
// Modal: confirmar extensión de fecha fin del proyecto cuando una tarea
// del macroplan se extiende más allá de la fecha fin actual del servicio.
// ============================================================
function ExtenderProyectoModal({
  tarea, fechaProyecto, fechaNueva, onCancelar, onConfirmar,
}: {
  tarea: Tarea; fechaProyecto: string; fechaNueva: string;
  onCancelar: () => void;
  onConfirmar: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  return (
    <Modal open title="¿Extender la fecha del proyecto?" onClose={onCancelar}
      footer={<>
        <button className="btn btn-secondary" onClick={onCancelar}>Mantener fecha actual</button>
        <button className="btn btn-primary" onClick={() => onConfirmar(motivo.trim() || 'Ajuste por cambio en el macroplan del proyecto')}>
          Extender a {fechaNueva}
        </button>
      </>}>
      <div style={{ fontSize: 13, color: 'var(--gray-text)', marginBottom: 12, lineHeight: 1.5 }}>
        La tarea <strong>"{tarea.nombre}"</strong> termina el <span className="mono">{fechaNueva}</span>, posterior a la fecha fin actual del proyecto (<span className="mono">{fechaProyecto || '—'}</span>).
      </div>
      <div style={{ fontSize: 12, color: 'var(--gray-text)', marginBottom: 12 }}>
        Si confirmás, la fecha fin del proyecto pasa a <strong>{fechaNueva}</strong> y queda registrado en el historial de cambios del servicio.
      </div>
      <div className="form-grid">
        <div className="form-group full">
          <label>Motivo del cambio (opcional)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Replanificación de tareas por cambio de alcance"
            autoFocus />
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL alta/edición de tarea
// ============================================================
const blankTarea = (servicioId: number, orden: number): Tarea => ({
  id: Date.now(),
  servicioId,
  orden,
  nombre: '',
  responsableId: undefined,
  responsableNombre: undefined,
  fechaInicioPlan: ddmmaaaa(HOY),
  fechaFinPlan: ddmmaaaa(new Date(HOY.getTime() + 7 * 86400000)),
  estado: 'Pendiente',
});

function TareaModal({
  open, tarea, servicio, recursos, nextOrden, onClose, onSave, onDelete,
}: {
  open: boolean; tarea: Tarea | null; servicio: Servicio; recursos: Recurso[]; nextOrden: number;
  onClose: () => void; onSave: (t: Tarea) => void; onDelete: (id: number) => void;
}) {
  const [f, setF] = useState<Tarea>(blankTarea(servicio.id, nextOrden));
  useEffect(() => {
    if (!open) return;
    setF(tarea ? { ...tarea } : blankTarea(servicio.id, nextOrden));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tarea?.id, servicio.id]);

  // Equipo del servicio: lo priorizamos en el dropdown de responsable.
  // El resto de los recursos queda como "Otros profesionales" (a veces se asignan
  // tareas puntuales a especialistas fuera del equipo formal).
  const equipoIds = useMemo(
    () => new Set(equipoDe(servicio.id, recursos).map(m => m.recursoId)),
    [servicio.id, recursos],
  );
  const recursosEquipo = useMemo(
    () => recursos.filter(r => equipoIds.has(r.id)).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [recursos, equipoIds],
  );
  const recursosOtros = useMemo(
    () => recursos.filter(r => !equipoIds.has(r.id)).sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [recursos, equipoIds],
  );

  if (!open) return null;
  const u = (p: Partial<Tarea>) => setF(prev => ({ ...prev, ...p }));

  const guardar = () => {
    if (!f.nombre.trim()) return;
    let t = { ...f };
    // Denormalizar nombre del responsable
    if (t.responsableId) {
      const r = recursos.find(x => x.id === t.responsableId);
      t.responsableNombre = r ? nombreCompleto(r) : t.responsableNombre;
    } else { t.responsableNombre = undefined; }
    // Si pasa a Completada y no tiene fechaFinReal, setear hoy
    if (t.estado === 'Completada' && !t.fechaFinReal) t.fechaFinReal = ddmmaaaa(HOY);
    if (t.estado !== 'Completada') t.fechaFinReal = undefined;
    onSave(t);
  };

  return (
    <Modal open={open} title={tarea ? 'Editar tarea' : 'Nueva tarea'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        {tarea && <button className="btn btn-danger" onClick={() => onDelete(tarea.id)}>Eliminar</button>}
        <button className="btn btn-primary" onClick={guardar}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-group full"><label>Nombre de la tarea</label>
          <input value={f.nombre} onChange={e => u({ nombre: e.target.value })} placeholder="Ej: Definir arquitectura" autoFocus />
        </div>
        <div className="form-group"><label>Responsable</label>
          <select value={f.responsableId ?? 0} onChange={e => u({ responsableId: Number(e.target.value) || undefined })}>
            <option value={0}>— Sin asignar —</option>
            {recursosEquipo.length > 0 && (
              <optgroup label="Equipo del servicio">
                {recursosEquipo.map(r => <option key={r.id} value={r.id}>{nombreCompleto(r)}</option>)}
              </optgroup>
            )}
            {recursosOtros.length > 0 && (
              <optgroup label="Otros profesionales">
                {recursosOtros.map(r => <option key={r.id} value={r.id}>{nombreCompleto(r)}</option>)}
              </optgroup>
            )}
          </select>
        </div>
        <div className="form-group"><label>Estado</label>
          <select value={f.estado} onChange={e => u({ estado: e.target.value as EstadoTarea })}>
            {ESTADOS_TAREA.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Inicio plan</label>
          <input value={f.fechaInicioPlan} onChange={e => u({ fechaInicioPlan: e.target.value })} placeholder="dd/mm/aaaa" />
        </div>
        <div className="form-group"><label>Fin plan</label>
          <input value={f.fechaFinPlan} onChange={e => u({ fechaFinPlan: e.target.value })} placeholder="dd/mm/aaaa" />
        </div>
        {f.estado === 'Completada' && (
          <div className="form-group"><label>Fin real</label>
            <input value={f.fechaFinReal || ''} onChange={e => u({ fechaFinReal: e.target.value })} placeholder="dd/mm/aaaa" />
          </div>
        )}
        <div className="form-group">
          <label>Vincular a hito</label>
          <select value={f.hitoId ?? 0} onChange={e => u({ hitoId: Number(e.target.value) || undefined })}>
            <option value={0}>— Ninguno —</option>
            {servicio.hitos.map((h: HitoServicio) => <option key={h.id} value={h.id}>{h.nombre}</option>)}
          </select>
        </div>
        <div className="form-group full"><label>Comentario</label>
          <textarea value={f.comentario || ''} onChange={e => u({ comentario: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// MODAL importar tareas desde Excel/CSV (pegar)
// Formato esperado: Nombre, Responsable, Inicio (dd/mm/aaaa), Fin, Estado
// Separador: tab o coma
// ============================================================
// Fila enriquecida del preview: trackea si el responsable matcheó la tabla de Recursos.
type PreviewRow = Tarea & { _respRaw: string; _respOk: boolean };

function ImportTareasModal({
  open, servicio, recursos, onClose, onImport,
}: {
  open: boolean; servicio: Servicio; recursos: Recurso[];
  onClose: () => void; onImport: (items: Tarea[]) => void;
}) {
  const [texto, setTexto] = useState('');
  const [preview, setPreview] = useState<PreviewRow[]>([]);

  if (!open) return null;

  const parsear = (raw: string): PreviewRow[] => {
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];
    // Detectar si la primera fila es header (heurística: contiene "Nombre" o "Tarea")
    const first = lines[0];
    const hasHeader = /nombre|tarea|task/i.test(first.split(/[\t,]/)[0] || '');
    const data = hasHeader ? lines.slice(1) : lines;
    const items: PreviewRow[] = data.map((line, i) => {
      const cols = line.split(/\t|,(?![^"]*"(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
      const [nombre = '', resp = '', inicio = '', fin = '', estadoRaw = ''] = cols;
      const respClean = resp.trim();
      // Match estricto: solo nombre completo, o apellido único, o nombre único. No "se parece a".
      let r: Recurso | undefined;
      if (respClean) {
        const lower = respClean.toLowerCase();
        r = recursos.find(x => nombreCompleto(x).toLowerCase() === lower);
        if (!r) {
          const porApellido = recursos.filter(x => x.apellido.toLowerCase() === lower);
          if (porApellido.length === 1) r = porApellido[0];
        }
        if (!r) {
          const porNombre = recursos.filter(x => x.nombre.toLowerCase() === lower);
          if (porNombre.length === 1) r = porNombre[0];
        }
      }
      const estado: EstadoTarea = (ESTADOS_TAREA as string[]).includes(estadoRaw) ? (estadoRaw as EstadoTarea) : 'Pendiente';
      return {
        id: Date.now() + i,
        servicioId: servicio.id,
        orden: 1000 + i,
        nombre: nombre || `Tarea ${i + 1}`,
        responsableId: r?.id,
        responsableNombre: r ? nombreCompleto(r) : undefined,
        fechaInicioPlan: inicio || ddmmaaaa(HOY),
        fechaFinPlan: fin || ddmmaaaa(new Date(HOY.getTime() + 7 * 86400000)),
        estado,
        _respRaw: respClean,
        _respOk: respClean === '' || !!r,
      };
    }).filter(t => t.nombre.trim());
    return items;
  };

  const onChangeTexto = (t: string) => { setTexto(t); setPreview(parsear(t)); };

  const filasMalas = preview.filter(p => !p._respOk);
  const puedeImportar = preview.length > 0 && filasMalas.length === 0;
  const doImport = () => {
    // Limpiamos los campos auxiliares antes de mandar al store.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const items: Tarea[] = preview.map(({ _respRaw, _respOk, ...t }) => t);
    onImport(items);
  };

  return (
    <Modal open={open} title="Importar tareas desde Excel/CSV" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" disabled={!puedeImportar} onClick={doImport}>
          Importar {preview.length} tareas
        </button>
      </>}>
      <p style={{ fontSize: 13, color: 'var(--gray-text)', marginBottom: 10 }}>
        Copiá de Excel y pegá acá. Columnas esperadas: <strong>Nombre, Responsable, Inicio (dd/mm/aaaa), Fin (dd/mm/aaaa), Estado</strong>.
        Tab o coma sirven como separador. La primera fila puede ser encabezado.
        El <strong>Responsable</strong> debe coincidir con un profesional cargado (nombre completo, apellido o nombre si son únicos). Si no matchea, esa fila bloquea la importación.
      </p>
      <textarea
        value={texto}
        onChange={e => onChangeTexto(e.target.value)}
        placeholder={`Nombre\tResponsable\tInicio\tFin\tEstado\nDefinir arquitectura\tDamián Faccini\t02/06/2026\t06/06/2026\tEn curso\nIntegración SAP\tJavier Gomes\t09/06/2026\t20/06/2026\tPendiente`}
        style={{ width: '100%', minHeight: 140, fontFamily: 'JetBrains Mono, monospace', fontSize: 12, border: '1.5px solid var(--gray-line)', borderRadius: 8, padding: 10, outline: 'none' }}
      />
      {preview.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="panel-title">Preview ({preview.length} filas)</div>
          {filasMalas.length > 0 && (
            <div style={{ background: 'var(--red-soft, #fdecec)', border: '1px solid var(--red)', borderRadius: 8, padding: 8, marginBottom: 10, fontSize: 12, color: 'var(--red)' }}>
              <strong>{filasMalas.length} fila{filasMalas.length === 1 ? '' : 's'} con responsable no reconocido.</strong>
              {' '}Corregí el texto en la planilla para que coincida con un profesional cargado, o dejá el campo vacío.
            </div>
          )}
          <table>
            <thead><tr><th>Tarea</th><th>Responsable</th><th>Inicio</th><th>Fin</th><th>Estado</th></tr></thead>
            <tbody>
              {preview.slice(0, 10).map((t, i) => (
                <tr key={i} style={!t._respOk ? { background: 'var(--red-soft, #fdecec)' } : undefined}>
                  <td><strong>{t.nombre}</strong></td>
                  <td>
                    {t._respOk
                      ? (t.responsableNombre || <span style={{ color: 'var(--gray-mute)' }}>— sin asignar —</span>)
                      : <span style={{ color: 'var(--red)' }}>✕ "{t._respRaw}" no matchea</span>}
                  </td>
                  <td className="mono">{t.fechaInicioPlan}</td>
                  <td className="mono">{t.fechaFinPlan}</td>
                  <td><span className={`pill ${ESTADO_CLS[t.estado]}`}>{t.estado}</span></td>
                </tr>
              ))}
              {preview.length > 10 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--gray-mute)' }}>… y {preview.length - 10} más</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

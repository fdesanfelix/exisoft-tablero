import { useEffect, useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { KPI } from '../components/KPI';
import { Modal } from '../components/Modal';
import { RecursoDetail } from './RecursoDetail';
import { showToast } from '../components/Toast';
import {
  asignacionTotal, nombreCompleto, type AsignacionServicio, type Pais, type Recurso, type Rol,
} from '../types';

type Store = ReturnType<typeof useStore>;

export function RecursosView({ store, rol }: { store: Store; rol: Rol }) {
  const [filtro, setFiltro] = useState<'all' | 'full' | 'partial' | 'free' | 'sub'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recurso | null>(null);
  const [viewing, setViewing] = useState<Recurso | null>(null);
  const [openNew, setOpenNew] = useState(false);
  // Recursos = ABM de profesionales, propiedad de Gerencia de Servicios.
  // El PM puede mirar (para ver datos de su equipo) pero no edita.
  const puedeEditar = rol === 'GerenciaServicios' || rol === 'DirectorServicios';

  const filtrados = useMemo(() => store.recursos.filter(r => {
    const total = asignacionTotal(r);
    if (q && !`${r.nombre} ${r.apellido}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filtro === 'full') return total >= 95;
    if (filtro === 'partial') return total > 0 && total < 95;
    if (filtro === 'free') return total === 0;
    if (filtro === 'sub') return r.subcontratado;
    return true;
  }), [store.recursos, filtro, q]);

  const kpis = useMemo(() => {
    const totals = store.recursos.map(asignacionTotal);
    return {
      total: store.recursos.length,
      full: totals.filter(t => t >= 95).length,
      part: totals.filter(t => t > 0 && t < 95).length,
      free: totals.filter(t => t === 0).length,
      sub: store.recursos.filter(r => r.subcontratado).length,
      sobre: totals.filter(t => t > 100).length,
    };
  }, [store.recursos]);

  return (
    <>
      <div className="view-hero">
        <h1>Asignación de <span className="accent">Recursos</span></h1>
        <p>Profesionales — datos personales, contratación y asignación a servicios. % calculado por el sistema.</p>
      </div>

      <div className="kpi-grid">
        <KPI label="Profesionales" value={kpis.total} variant="total" />
        <KPI label="Asignados 100%" value={kpis.full} variant="on" />
        <KPI label="Asignados Parcial" value={kpis.part} variant="at" />
        <KPI label="Bench / Disponibles" value={kpis.free} variant="off" />
        <KPI label="Subcontratados" value={kpis.sub} variant="alert" />
        <KPI label="Sobreasignados" value={kpis.sobre} variant="alert" />
      </div>

      <div className="action-bar">
        <div className="filter-bar" style={{ margin: 0, flex: 1 }}>
          <div className="filter-group">
            <span className="filter-group-label">Disponibilidad</span>
            <button className={`filter-btn ${filtro === 'all' ? 'active' : ''}`} onClick={() => setFiltro('all')}>Todos</button>
            <button className={`filter-btn ${filtro === 'full' ? 'active' : ''}`} onClick={() => setFiltro('full')}>100%</button>
            <button className={`filter-btn ${filtro === 'partial' ? 'active' : ''}`} onClick={() => setFiltro('partial')}>Parcial</button>
            <button className={`filter-btn ${filtro === 'free' ? 'active' : ''}`} onClick={() => setFiltro('free')}>Bench</button>
            <button className={`filter-btn ${filtro === 'sub' ? 'active' : ''}`} onClick={() => setFiltro('sub')}>Subcontratados</button>
          </div>
          <div className="search"><input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar profesional…" /></div>
        </div>
        {puedeEditar && <button className="btn btn-primary" onClick={() => setOpenNew(true)}>+ Nuevo recurso</button>}
      </div>

      {filtrados.length === 0 ? (
        <div className="empty-state">Sin resultados</div>
      ) : (
        <div className="grid-3">
          {filtrados.map(r => {
            const total = asignacionTotal(r);
            const color = total >= 95 ? 'var(--green)' : total > 0 ? 'var(--orange)' : 'var(--red)';
            const cls = total >= 95 ? 's-on' : total > 0 ? 's-at' : 's-off';
            const stCls = total >= 95 ? 'on' : total > 0 ? 'at' : 'off';
            const servicios = r.asignaciones.map(asn => {
              const s = store.servicios.find(x => x.id === asn.servicioId);
              return s ? `${s.nombre} (${asn.porcentaje}%)` : null;
            }).filter(Boolean).join(' · ');
            return (
              <div key={r.id} className={`card ${cls}`}>
                <div className="card-head">
                  <div className="card-name">{nombreCompleto(r)}</div>
                  <span className={`status-badge ${stCls}`}>{total}%</span>
                </div>
                <div className="card-meta">
                  <strong>Legajo:</strong> {r.legajo} · <strong>{r.perfilPrincipal}</strong> · <strong>{r.seniorityPrincipal}</strong>
                </div>
                <div className="card-meta">
                  <strong>Contratación:</strong> {r.tipoContratacion} · <strong>País:</strong> {r.dirPais}
                </div>
                <div style={{ margin: '8px 0' }}>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${Math.min(total, 100)}%`, background: color }} />
                  </div>
                </div>
                <div className="card-meta"><strong>Servicios:</strong> {servicios || '—'}</div>
                <div className="chips">
                  {total > 100 && <span className="chip solid">Sobreasignado</span>}
                  {total === 0 && !r.subcontratado && <span className="chip warn">Bench</span>}
                  {r.subcontratado && <span className="chip info">Subcontratado</span>}
                  {r.alerta && <span className="chip warn">{r.alerta}</span>}
                </div>
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => setViewing(r)}>👁 Ver detalle</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <RecursoDetail
        open={viewing != null}
        recurso={viewing}
        servicios={store.servicios}
        rol={rol}
        onClose={() => setViewing(null)}
        onEdit={() => { if (viewing) { setEditing(viewing); setViewing(null); } }}
        onDelete={() => {
          if (!viewing) return;
          if (!confirm('¿Eliminar este recurso?')) return;
          store.deleteRecurso(viewing.id);
          showToast('Recurso eliminado');
          setViewing(null);
        }}
      />

      <RecursoModal
        open={openNew || editing != null}
        recurso={editing}
        servicios={store.servicios}
        perfiles={store.perfiles}
        seniorities={store.seniorities}
        tiposContratacion={store.tiposContratacion}
        onClose={() => { setEditing(null); setOpenNew(false); }}
        onSave={r => { store.upsertRecurso(r); showToast(editing ? 'Recurso actualizado' : 'Recurso creado'); setEditing(null); setOpenNew(false); }}
        onDelete={id => { if (!confirm('¿Eliminar este recurso?')) return; store.deleteRecurso(id); showToast('Recurso eliminado'); setEditing(null); }}
      />
    </>
  );
}

// ============================================================
// MODAL — datos personales completos del SQL + selector de servicios
// ============================================================
interface RmProps {
  open: boolean; recurso: Recurso | null; servicios: Store['servicios'];
  perfiles: Store['perfiles'];
  seniorities: Store['seniorities'];
  tiposContratacion: Store['tiposContratacion'];
  onClose: () => void; onSave: (r: Recurso) => void; onDelete: (id: number) => void;
}

const blankRecurso = (): Recurso => ({
  id: Date.now(), legajo: '', nombre: '', apellido: '',
  fechaIngreso: '', fechaNacimiento: '', dni: '', cuit: '',
  mail: '', mailPersonal: '', telefono: '',
  tipoContratacion: 'Relación de Dependencia', estadoLaboral: 'Activo',
  dirCalle: '', dirNumero: '', dirCiudad: '', dirProvincia: '', dirPais: 'AR',
  perfilPrincipal: '', seniorityPrincipal: 'Semi-Sr', subcontratado: false,
  asignaciones: [],
});

function RecursoModal({ open, recurso, servicios, perfiles, seniorities, tiposContratacion, onClose, onSave, onDelete }: RmProps) {
  const [f, setF] = useState<Recurso>(blankRecurso());
  useEffect(() => {
    if (!open) return;
    setF(recurso ? { ...recurso, asignaciones: [...recurso.asignaciones] } : blankRecurso());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recurso?.id, open]);
  if (!open) return null;

  const u = (p: Partial<Recurso>) => setF(prev => ({ ...prev, ...p }));
  const editAsn = (i: number, patch: Partial<AsignacionServicio>) => {
    const next = [...f.asignaciones]; next[i] = { ...next[i], ...patch }; u({ asignaciones: next });
  };
  const addAsn = () => u({ asignaciones: [...f.asignaciones, { servicioId: 0, porcentaje: 0, perfil: f.perfilPrincipal || 'Dev', seniority: f.seniorityPrincipal || 'Semi-Sr', fechaDesde: '', fechaHasta: '' }] });
  const delAsn = (i: number) => u({ asignaciones: f.asignaciones.filter((_, j) => j !== i) });

  const total = asignacionTotal(f);
  const guardar = () => {
    if (!f.nombre.trim() || !f.apellido.trim()) return;
    onSave({ ...f, asignaciones: f.asignaciones.filter(a => a.servicioId > 0) });
  };

  // servicios ya usados por este recurso → para evitar dropdowns duplicados
  const idsYaUsados = new Set(f.asignaciones.map(a => a.servicioId).filter(Boolean));

  return (
    <Modal open={open} title={recurso ? 'Editar Recurso' : 'Nuevo Recurso'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        {recurso && <button className="btn btn-danger" onClick={() => onDelete(recurso.id)}>Eliminar</button>}
        <button className="btn btn-primary" onClick={guardar}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-section-title">Datos personales</div>
        <div className="form-group"><label>Legajo</label><input value={f.legajo} onChange={e => u({ legajo: e.target.value })} placeholder="EXI-0001" /></div>
        <div className="form-group"><label>Estado laboral</label>
          <select value={f.estadoLaboral} onChange={e => u({ estadoLaboral: e.target.value as Recurso['estadoLaboral'] })}>
            <option>Activo</option><option>Licencia</option><option>Renunció</option><option>Despedido</option>
          </select>
        </div>
        <div className="form-group"><label>Nombre</label><input value={f.nombre} onChange={e => u({ nombre: e.target.value })} /></div>
        <div className="form-group"><label>Apellido</label><input value={f.apellido} onChange={e => u({ apellido: e.target.value })} /></div>
        <div className="form-group"><label>Fecha nacimiento</label><input value={f.fechaNacimiento} onChange={e => u({ fechaNacimiento: e.target.value })} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>DNI</label><input value={f.dni} onChange={e => u({ dni: e.target.value })} /></div>
        <div className="form-group"><label>CUIT</label><input value={f.cuit} onChange={e => u({ cuit: e.target.value })} /></div>
        <div className="form-group"><label>Teléfono</label><input value={f.telefono} onChange={e => u({ telefono: e.target.value })} /></div>
        <div className="form-group"><label>Mail laboral</label><input value={f.mail} onChange={e => u({ mail: e.target.value })} /></div>
        <div className="form-group"><label>Mail personal</label><input value={f.mailPersonal} onChange={e => u({ mailPersonal: e.target.value })} /></div>

        <div className="form-section-title">Contratación</div>
        <div className="form-group"><label>Tipo de contratación</label>
          <select value={f.tipoContratacion} onChange={e => u({ tipoContratacion: e.target.value })}>
            {tiposContratacion.filter(t => t.activo || t.nombre === f.tipoContratacion).map(t =>
              <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
            {/* Compatibilidad con valores legacy que no estén en la tabla */}
            {f.tipoContratacion && !tiposContratacion.some(t => t.nombre === f.tipoContratacion) && (
              <option value={f.tipoContratacion}>{f.tipoContratacion}</option>
            )}
          </select>
        </div>
        <div className="form-group"><label>Fecha de ingreso</label><input value={f.fechaIngreso} onChange={e => u({ fechaIngreso: e.target.value })} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Fecha de renuncia</label><input value={f.fechaRenuncia || ''} onChange={e => u({ fechaRenuncia: e.target.value })} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Subcontratado</label>
          <select value={f.subcontratado ? 'true' : 'false'} onChange={e => u({ subcontratado: e.target.value === 'true' })}>
            <option value="false">No</option><option value="true">Sí</option>
          </select>
        </div>
        <div className="form-group"><label>Perfil principal</label>
          <select value={f.perfilPrincipal} onChange={e => u({ perfilPrincipal: e.target.value })}>
            <option value="">— Seleccionar —</option>
            {perfiles.filter(p => p.activo || p.nombre === f.perfilPrincipal).map(p =>
              <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            {f.perfilPrincipal && !perfiles.some(p => p.nombre === f.perfilPrincipal) && (
              <option value={f.perfilPrincipal}>{f.perfilPrincipal}</option>
            )}
          </select>
        </div>
        <div className="form-group"><label>Seniority</label>
          <select value={f.seniorityPrincipal} onChange={e => u({ seniorityPrincipal: e.target.value })}>
            {seniorities.filter(s => s.activo || s.nombre === f.seniorityPrincipal).map(s =>
              <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
            {f.seniorityPrincipal && !seniorities.some(s => s.nombre === f.seniorityPrincipal) && (
              <option value={f.seniorityPrincipal}>{f.seniorityPrincipal}</option>
            )}
          </select>
        </div>

        <div className="form-section-title">Dirección</div>
        <div className="form-group"><label>Calle</label><input value={f.dirCalle} onChange={e => u({ dirCalle: e.target.value })} /></div>
        <div className="form-group"><label>Número</label><input value={f.dirNumero} onChange={e => u({ dirNumero: e.target.value })} /></div>
        <div className="form-group"><label>Piso / Dto</label><input value={f.dirPisoDto || ''} onChange={e => u({ dirPisoDto: e.target.value })} /></div>
        <div className="form-group"><label>Ciudad</label><input value={f.dirCiudad} onChange={e => u({ dirCiudad: e.target.value })} /></div>
        <div className="form-group"><label>Provincia</label><input value={f.dirProvincia} onChange={e => u({ dirProvincia: e.target.value })} /></div>
        <div className="form-group"><label>País</label>
          <select value={f.dirPais} onChange={e => u({ dirPais: e.target.value as Pais })}>
            <option>AR</option><option>PE</option><option>CH</option><option>MX</option>
          </select>
        </div>

        <div className="form-section-title">Contacto de emergencia</div>
        <div className="form-group"><label>Persona</label><input value={f.personaContacto || ''} onChange={e => u({ personaContacto: e.target.value })} /></div>
        <div className="form-group"><label>Teléfono</label><input value={f.telContacto || ''} onChange={e => u({ telContacto: e.target.value })} /></div>
        <div className="form-group full"><label>Observaciones</label><textarea value={f.observaciones || ''} onChange={e => u({ observaciones: e.target.value })} /></div>

        <div className="form-section-title">
          Asignación a servicios &nbsp;
          <span style={{ fontSize: 11, fontWeight: 600, color: total === 100 ? 'var(--green)' : total > 100 ? 'var(--red)' : total > 0 ? 'var(--orange)' : 'var(--gray-mute)' }}>
            (Total calculado: {total}% {total > 100 ? '⚠ sobreasignado' : ''})
          </span>
        </div>
        <div className="form-group full">
          {f.asignaciones.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>Sin asignaciones. Agregá una.</div>
          )}
          {f.asignaciones.map((asn, i) => (
            <div key={i} style={{ border: '1px solid var(--gray-line)', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontSize: 11, color: 'var(--orange)' }}>Asignación {i + 1}</strong>
                <button className="btn btn-sm btn-danger" onClick={() => delAsn(i)}>×</button>
              </div>
              <div className="form-grid" style={{ gap: 8 }}>
                <div className="form-group full"><label>Servicio</label>
                  <select value={asn.servicioId} onChange={e => editAsn(i, { servicioId: Number(e.target.value) })}>
                    <option value={0}>— Seleccionar servicio —</option>
                    {servicios.map(s => (
                      <option key={s.id} value={s.id} disabled={s.id !== asn.servicioId && idsYaUsados.has(s.id)}>
                        {s.cliente} · {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>% Asignación (override)</label>
                  <input type="number" min={0} max={200} value={asn.porcentaje || ''}
                    onChange={e => editAsn(i, { porcentaje: e.target.value === '' ? undefined : Number(e.target.value) })}
                    placeholder="(auto si vacío)" />
                </div>
                <div className="form-group"><label>Perfil</label>
                  <select value={asn.perfil} onChange={e => editAsn(i, { perfil: e.target.value })}>
                    {perfiles.filter(p => p.activo || p.nombre === asn.perfil).map(p =>
                      <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                    {asn.perfil && !perfiles.some(p => p.nombre === asn.perfil) && (
                      <option value={asn.perfil}>{asn.perfil}</option>
                    )}
                  </select>
                </div>
                <div className="form-group"><label>Seniority</label>
                  <select value={asn.seniority} onChange={e => editAsn(i, { seniority: e.target.value })}>
                    {seniorities.filter(s => s.activo || s.nombre === asn.seniority).map(s =>
                      <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                    {asn.seniority && !seniorities.some(s => s.nombre === asn.seniority) && (
                      <option value={asn.seniority}>{asn.seniority}</option>
                    )}
                  </select>
                </div>
                <div className="form-group"><label>Desde</label><input value={asn.fechaDesde} onChange={e => editAsn(i, { fechaDesde: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                <div className="form-group"><label>Hasta</label><input value={asn.fechaHasta} onChange={e => editAsn(i, { fechaHasta: e.target.value })} placeholder="dd/mm/aaaa" /></div>
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addAsn}>+ Agregar asignación a servicio</button>
        </div>
      </div>
    </Modal>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import {
  ddmmaaaa, equipoDe, HOY, nombreCompleto, porcentajeAuto, TIPO_CAMBIO_LABEL, TIPOS_SERVICIO, MODOS_CERT_LABEL,
  type Bloqueo, type CambioServicio, type CategoriaBloqueo, type Cliente, type EstadoServicio, type HitoServicio,
  type HorasPorPerfil, type MiembroEquipo, type ModoCertificacion, type Pais, type Perfil,
  type Recurso, type Riesgo, type Seniority, type Servicio, type TipoCambio, type TipoServicio,
} from '../types';
import { RiesgoEditModal } from './BloqueoRiesgoModals';

interface Props {
  open: boolean;
  servicio: Servicio | null;
  recursos: Recurso[];
  servicios: Servicio[];
  clientes: Cliente[];
  perfiles: Perfil[];
  seniorities: Seniority[];
  categoriasBloqueo: CategoriaBloqueo[];
  usuario: string;          // para el campo autor de cambios
  onClose: () => void;
  onSave: (s: Servicio, equipo: MiembroEquipo[]) => void;
  onDelete: (id: number) => void;
}

// ── Detector de cambios sensibles entre el servicio anterior y el nuevo ──
// Solo se considera cambio si el valor anterior NO estaba vacío (al completar por primera
// vez no hay nada que historiar).
type DetectedChange = { tipo: TipoCambio; valorAnterior: string; valorNuevo: string };
function detectarCambiosSensibles(prev: Servicio, next: Servicio): DetectedChange[] {
  const out: DetectedChange[] = [];
  const fechaCambio = (a: string, b: string) => {
    const va = (a || '').trim(); const vb = (b || '').trim();
    return va && va !== '—' && va !== 'TBD' && va !== vb;
  };
  if (fechaCambio(prev.inicio, next.inicio)) out.push({ tipo: 'FechaInicio', valorAnterior: prev.inicio, valorNuevo: next.inicio });
  if (fechaCambio(prev.fin, next.fin)) out.push({ tipo: 'FechaFin', valorAnterior: prev.fin, valorNuevo: next.fin });
  if (prev.horasCont != null && next.horasCont != null && prev.horasCont !== next.horasCont) {
    out.push({ tipo: 'HorasContratadas', valorAnterior: String(prev.horasCont), valorNuevo: String(next.horasCont) });
  }
  return out;
}

const blank = (): Servicio => ({
  id: Date.now(), cliente: '', nombre: '', pais: 'AR', tipo: 'Soporte', estado: 'En curso',
  inicio: '', fin: '', horasCont: null, horasCons: null, horasRest: null,
  certif: '', alertas: [], bloqueos: [],
  modoCertificacion: 'NoCertifica', seguimientoAvances: false, hitos: [],
});

export function ServicioModal({ open, servicio, recursos, servicios, clientes, perfiles, seniorities, categoriasBloqueo, usuario, onClose, onSave, onDelete }: Props) {
  const [f, setF] = useState<Servicio>(blank());
  const [equipo, setEquipo] = useState<MiembroEquipo[]>([]);
  // Modal de confirmación de cambios sensibles
  const [confirmandoCambios, setConfirmandoCambios] = useState<{
    cambios: DetectedChange[];
    srvNuevo: Servicio;
    equipo: MiembroEquipo[];
  } | null>(null);
  // Modal de reemplazo de miembro
  const [reemplazando, setReemplazando] = useState<{ index: number; miembro: MiembroEquipo } | null>(null);
  // Modal de edición de riesgo (mismo form que en Proyectos)
  const [editandoRiesgo, setEditandoRiesgo] = useState<{ idx: number | null; riesgo: Riesgo } | null>(null);

  // Solo re-inicializamos cuando se abre/cierra el modal o cambia el servicio editado.
  // No depende de `recursos` para no pisar el estado durante el save (que actualiza recursos).
  useEffect(() => {
    if (!open) return;
    if (servicio) {
      setF({
        ...servicio,
        bloqueos: [...(servicio.bloqueos || [])],
        alertas: [...(servicio.alertas || [])],
        hitos: [...(servicio.hitos || [])],
        modoCertificacion: servicio.modoCertificacion || 'NoCertifica',
        seguimientoAvances: !!servicio.seguimientoAvances,
      });
      setEquipo(equipoDe(servicio.id, recursos, servicios, clientes));
    } else {
      setF(blank()); setEquipo([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio?.id, open]);

  // ⚠️ Todos los hooks ANTES de cualquier early return
  const idsEnEquipo = useMemo(
    () => new Set(equipo.map(m => m.recursoId).filter(Boolean)),
    [equipo],
  );

  // Clientes existentes derivados del portafolio. Si el PM tipea uno nuevo, se acepta;
  // si elige uno existente, autocompletamos el país (regla: cliente → país son consistentes).
  const clientesExistentes = useMemo(() => {
    const map = new Map<string, Pais>();
    servicios.forEach(s => { if (s.cliente && !map.has(s.cliente)) map.set(s.cliente, s.pais); });
    return Array.from(map.entries())
      .map(([nombre, pais]) => ({ nombre, pais }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [servicios]);

  const onChangeCliente = (val: string) => {
    const match = clientesExistentes.find(c => c.nombre.toLowerCase() === val.trim().toLowerCase());
    if (match) {
      u({ cliente: match.nombre, pais: match.pais });
    } else {
      u({ cliente: val });
    }
  };
  const esClienteNuevo = !!f.cliente.trim() &&
    !clientesExistentes.some(c => c.nombre.toLowerCase() === f.cliente.trim().toLowerCase());

  if (!open) return null;
  const u = (patch: Partial<Servicio>) => setF(p => ({ ...p, ...patch }));
  const set = (k: keyof Servicio) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    u({ [k]: e.target.value } as Partial<Servicio>);
  const setNum = (k: keyof Servicio) => (e: React.ChangeEvent<HTMLInputElement>) =>
    u({ [k]: e.target.value === '' ? null : Number(e.target.value) } as Partial<Servicio>);

  // ── Bloqueos ──
  const editBloq = (i: number, p: Partial<Bloqueo>) => { const n = [...f.bloqueos]; n[i] = { ...n[i], ...p }; u({ bloqueos: n }); };
  const addBloq = () => u({ bloqueos: [...f.bloqueos, { titulo: '', desc: '', owner: '', estado: 'Abierto', escalado: false }] });
  const delBloq = (i: number) => u({ bloqueos: f.bloqueos.filter((_, j) => j !== i) });

  // ── Hitos ──
  const editHito = (i: number, p: Partial<HitoServicio>) => { const n = [...f.hitos]; n[i] = { ...n[i], ...p }; u({ hitos: n }); };
  const addHito = () => u({ hitos: [...f.hitos, { id: Date.now() + f.hitos.length, nombre: '', porcentaje: 0, fechaCert: '', horas: null, valor: null, cumplido: false }] });
  const delHito = (i: number) => u({ hitos: f.hitos.filter((_, j) => j !== i) });
  const totalHitos = f.hitos.reduce((a, h) => a + (h.porcentaje || 0), 0);

  // ── Equipo ──
  const editMiembro = (i: number, p: Partial<MiembroEquipo>) => {
    const n = [...equipo]; n[i] = { ...n[i], ...p };
    if (p.recursoId !== undefined) {
      const r = recursos.find(x => x.id === p.recursoId);
      if (r) { n[i].nombre = nombreCompleto(r); if (!n[i].seniority) n[i].seniority = r.seniorityPrincipal; }
    }
    setEquipo(n);
  };
  const addMiembro = () => setEquipo([...equipo, { recursoId: 0, nombre: '', perfil: 'Dev', seniority: 'Senior', porcentaje: 0, porcentajeAuto: 0, esOverride: false, fechaDesde: '', fechaHasta: '' }]);
  const delMiembro = (i: number) => setEquipo(equipo.filter((_, j) => j !== i));

  // ── Servicios derivados: heredar horas sobrantes ──
  // Para un servicio cerrado, las horas "favorables disponibles" son las sobrantes
  // que NO se hayan trasladado ya a otro servicio derivado.
  function saldoFavorable(s: Servicio): number {
    if (s.estado !== 'Cerrado') return 0;
    if (s.horasCont == null) return 0;
    const balance = s.horasCont - (s.horasCons || 0);
    if (balance <= 0) return 0;
    // Si ya trasladó, descontar lo trasladado
    if (s.horasTrasladadasCant) return Math.max(0, balance - s.horasTrasladadasCant);
    // Si está marcado como vencidas, no disponibles
    if (s.saldoCierre === 'Vencidas' || s.saldoCierre === 'Trasladadas') return 0;
    return balance;
  }

  const onChangeDerivaDe = (newDerivaDe: number | undefined) => {
    // Si se elige un padre cerrado con sobrantes, ofrecer heredar las horas.
    if (newDerivaDe) {
      const padre = servicios.find(x => x.id === newDerivaDe);
      const sobrantes = padre ? saldoFavorable(padre) : 0;
      if (padre && sobrantes > 0) {
        const ok = confirm(
          `"${padre.nombre}" cerró con ${sobrantes} hs sin consumir.\n\n¿Trasladar esas horas a este servicio?\n\nSi confirmás, se suman a las horas contratadas del nuevo y queda registrado en ambos servicios.`
        );
        if (ok) {
          u({
            derivaDe: newDerivaDe,
            horasHeredadas: sobrantes,
            horasHeredadasDeId: newDerivaDe,
            horasCont: (f.horasCont || 0) + sobrantes,
          });
          return;
        }
      }
    } else {
      // Limpiar herencia si quitan la relación
      if (f.horasHeredadas) {
        u({
          derivaDe: undefined,
          horasHeredadas: undefined,
          horasHeredadasDeId: undefined,
          horasCont: Math.max(0, (f.horasCont || 0) - (f.horasHeredadas || 0)),
        });
        return;
      }
    }
    u({ derivaDe: newDerivaDe });
  };

  // ── Validaciones de consistencia (errores bloquean, warnings se muestran) ──
  type Validacion = { nivel: 'error' | 'warning'; msg: string };
  const equipoConRecurso = equipo.filter(m => m.recursoId > 0);
  const hitosConNombre = f.hitos.filter(h => h.nombre.trim());
  const sumaHitos = hitosConNombre.reduce((a, h) => a + (h.porcentaje || 0), 0);
  const hayPMEnEquipo = equipoConRecurso.some(m => /PM/i.test(m.perfil));

  // Sobreasignación: para cada miembro nuevo/editado, sumar lo que tiene en OTROS servicios + lo de este.
  const sobreasignados = equipoConRecurso
    .map(m => {
      const r = recursos.find(x => x.id === m.recursoId);
      if (!r) return null;
      const totalOtros = (r.asignaciones || [])
        .filter(a => a.servicioId !== f.id)
        .reduce((acc, a) => acc + (a.porcentaje || 0), 0);
      const total = totalOtros + (m.porcentaje || 0);
      return total > 100 ? { nombre: m.nombre || nombreCompleto(r), total } : null;
    })
    .filter((x): x is { nombre: string; total: number } => x != null);

  const validaciones: Validacion[] = [];
  if (!f.cliente.trim()) validaciones.push({ nivel: 'error', msg: 'Falta el cliente.' });
  if (!f.nombre.trim()) validaciones.push({ nivel: 'error', msg: 'Falta el nombre del servicio.' });
  if (f.modoCertificacion === 'Hitos' && hitosConNombre.length === 0) {
    validaciones.push({ nivel: 'error', msg: 'Modo de certificación "Por hitos" requiere al menos un hito cargado.' });
  }
  if (f.modoCertificacion === 'Hitos' && sumaHitos > 100) {
    validaciones.push({ nivel: 'error', msg: `La suma de % de hitos excede 100% (${sumaHitos}%).` });
  }
  if (f.modoCertificacion === 'Hitos' && sumaHitos > 0 && sumaHitos < 100) {
    validaciones.push({ nivel: 'warning', msg: `La suma de % de hitos es ${sumaHitos}% (falta ${100 - sumaHitos}% para cubrir el 100% del contrato).` });
  }
  if (f.seguimientoAvances && !hayPMEnEquipo) {
    validaciones.push({ nivel: 'error', msg: 'Este servicio es elegible para Gestión de Proyectos: necesita al menos un PM en el equipo.' });
  }
  if (f.seguimientoAvances && equipoConRecurso.length === 0) {
    validaciones.push({ nivel: 'error', msg: 'Este servicio es elegible para Gestión de Proyectos: cargá al menos un miembro al equipo.' });
  }
  sobreasignados.forEach(s => {
    validaciones.push({ nivel: 'warning', msg: `${s.nombre} quedaría con ${s.total}% de asignación total (suma con otros servicios).` });
  });

  const errores = validaciones.filter(v => v.nivel === 'error');
  const warnings = validaciones.filter(v => v.nivel === 'warning');

  const guardar = () => {
    if (errores.length > 0) return;
    const restantes = f.horasCont != null ? (f.horasCont - (f.horasCons || 0)) : null;
    const srvNuevo: Servicio = {
      ...f,
      horasRest: restantes,
      alertas: f.alertas.map(a => a.trim()).filter(Boolean),
      bloqueos: f.bloqueos.filter(b => b.titulo.trim()),
      hitos: hitosConNombre,
    };

    // Si estamos editando, detectar cambios sensibles para abrir el modal de confirmación.
    if (servicio) {
      const cambios = detectarCambiosSensibles(servicio, srvNuevo);
      if (cambios.length > 0) {
        setConfirmandoCambios({ cambios, srvNuevo, equipo: equipoConRecurso });
        return;
      }
    }

    onSave(srvNuevo, equipoConRecurso);
  };

  // Confirma los cambios sensibles: agrega los registros al historial y guarda.
  const confirmarCambios = (cambiosConMeta: { tipo: TipoCambio; valorAnterior: string; valorNuevo: string; motivo: string; elevarComercial: boolean }[]) => {
    if (!confirmandoCambios) return;
    const nuevoHistorial: CambioServicio[] = cambiosConMeta.map((c, i) => ({
      id: Date.now() + i,
      tipo: c.tipo,
      fechaRegistro: ddmmaaaa(HOY),
      valorAnterior: c.valorAnterior,
      valorNuevo: c.valorNuevo,
      motivo: c.motivo.trim() || undefined,
      elevarComercial: c.elevarComercial,
      estadoElevacion: c.elevarComercial ? 'Pendiente' : undefined,
      autor: usuario,
    }));
    onSave(
      { ...confirmandoCambios.srvNuevo, cambios: [...(servicio?.cambios || []), ...nuevoHistorial] },
      confirmandoCambios.equipo,
    );
    setConfirmandoCambios(null);
  };

  return (
    <Modal open={open} title={servicio ? 'Editar Servicio' : 'Nuevo Servicio'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        {servicio && <button className="btn btn-danger" onClick={() => onDelete(servicio.id)}>Eliminar</button>}
        <button className="btn btn-primary" onClick={guardar} disabled={errores.length > 0}
          title={errores.length > 0 ? 'Resolvé los errores marcados arriba' : ''}>
          Guardar
        </button>
      </>}>
      {(errores.length > 0 || warnings.length > 0) && (
        <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {errores.length > 0 && (
            <div style={{ background: 'var(--red-soft, #fdecec)', border: '1px solid var(--red)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', marginBottom: 6 }}>
                ⚠ {errores.length} {errores.length === 1 ? 'error' : 'errores'} a resolver antes de guardar
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--red)' }}>
                {errores.map((e, i) => <li key={i}>{e.msg}</li>)}
              </ul>
            </div>
          )}
          {warnings.length > 0 && (
            <div style={{ background: 'var(--orange-soft, #fff3e6)', border: '1px solid var(--orange)', borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 6 }}>
                ℹ {warnings.length} {warnings.length === 1 ? 'advertencia' : 'advertencias'}
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gray-dark)' }}>
                {warnings.map((w, i) => <li key={i}>{w.msg}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
      <div className="form-grid">
        <div className="form-section-title">Información general</div>
        <div className="form-group">
          <label>Cliente {esClienteNuevo && <span style={{ color: 'var(--orange)', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>· nuevo</span>}</label>
          <input
            list="clientes-existentes"
            value={f.cliente}
            onChange={e => onChangeCliente(e.target.value)}
            placeholder="Elegí uno existente o escribí uno nuevo"
            autoComplete="off"
          />
          <datalist id="clientes-existentes">
            {clientesExistentes.map(c => <option key={c.nombre} value={c.nombre}>{c.pais}</option>)}
          </datalist>
        </div>
        <div className="form-group"><label>Nombre del servicio</label><input value={f.nombre} onChange={set('nombre')} /></div>
        <div className="form-group"><label>País</label>
          <select value={f.pais} onChange={e => u({ pais: e.target.value as Pais })}>
            <option>PE</option><option>AR</option><option>CH</option><option>MX</option><option>OTROS</option>
          </select>
        </div>
        <div className="form-group"><label>Tipo</label>
          <select value={f.tipo} onChange={e => u({ tipo: e.target.value as TipoServicio })}>
            {TIPOS_SERVICIO.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Estado</label>
          <select value={f.estado} onChange={e => u({ estado: e.target.value as EstadoServicio })}>
            <option>No iniciado</option>
            <option>En curso</option>
            <option>En pausa</option>
            <option>Cerrado por PM</option>
            <option>Cerrado</option>
          </select>
        </div>
        <div className="form-group"><label>Tiene OC</label>
          <select value={f.tieneOC ? 'true' : 'false'} onChange={e => u({ tieneOC: e.target.value === 'true' })}>
            <option value="true">Sí</option><option value="false">No</option>
          </select>
        </div>
        <div className="form-group full"><label>Deriva de otro servicio (opcional)</label>
          <select value={f.derivaDe ?? 0} onChange={e => onChangeDerivaDe(Number(e.target.value) || undefined)}>
            <option value={0}>— Servicio independiente —</option>
            {servicios
              .filter(s => s.id !== f.id)  // no se puede derivar de sí mismo
              .sort((a, b) => `${a.cliente} ${a.nombre}`.localeCompare(`${b.cliente} ${b.nombre}`))
              .map(s => <option key={s.id} value={s.id}>{s.cliente} · {s.nombre}{(s.estado === 'Cerrado' && saldoFavorable(s)) ? ` · ⓘ ${saldoFavorable(s)} hs disponibles` : ''}</option>)}
          </select>
          {f.horasHeredadas && f.horasHeredadasDeId && (
            <div style={{ marginTop: 6, fontSize: 11, padding: '4px 8px', background: 'var(--green-soft)', borderRadius: 6, color: 'var(--green)', fontWeight: 600 }}>
              ↻ {f.horasHeredadas} hs heredadas de servicio anterior · ya sumadas a las contratadas
            </div>
          )}
        </div>

        <div className="form-section-title">Fechas y horas</div>
        <div className="form-group"><label>Fecha inicio</label><input value={f.inicio} onChange={set('inicio')} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Fecha fin estimada</label><input value={f.fin} onChange={set('fin')} placeholder="dd/mm/aaaa" /></div>
        <div className="form-group"><label>Horas contratadas</label><input type="number" step="0.1" value={f.horasCont ?? ''} onChange={setNum('horasCont')} /></div>
        <div className="form-group"><label>Horas consumidas</label><input type="number" step="0.1" value={f.horasCons ?? ''} onChange={setNum('horasCons')} /></div>
        <div className="form-section-title">Certificación</div>
        <div className="form-group"><label>Modo de certificación</label>
          <select value={f.modoCertificacion} onChange={e => {
            const modo = e.target.value as ModoCertificacion;
            // Si cambia a Mensual o NoCertifica, los hitos no aplican
            u({ modoCertificacion: modo, hitos: modo === 'Hitos' ? f.hitos : [] });
          }}>
            <option value="NoCertifica">{MODOS_CERT_LABEL.NoCertifica}</option>
            <option value="Mensual">{MODOS_CERT_LABEL.Mensual}</option>
            <option value="Hitos">{MODOS_CERT_LABEL.Hitos}</option>
          </select>
        </div>
        <div className="form-group"><label>Etiqueta (opcional)</label>
          <input value={f.certif} onChange={set('certif')} placeholder="Ej: Fact en Dic 2025, Mensual Gustavo" />
        </div>
        <label className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }}
            checked={f.seguimientoAvances}
            onChange={e => u({ seguimientoAvances: e.target.checked })} />
          <span style={{ fontSize: 12 }}>Elegible para Gestión de Proyectos</span>
        </label>

        <div className="form-section-title">
          Equipo del servicio &nbsp;
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-mute)' }}>
            (los profesionales seleccionados se vinculan en su ficha de Recurso)
          </span>
        </div>
        <div className="form-group full">
          {equipo.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>Sin miembros asignados.</div>}
          {equipo.map((m, i) => (
            <div key={i} style={{ border: '1px solid var(--gray-line)', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 11, color: 'var(--orange)' }}>Miembro {i + 1}</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  {m.recursoId > 0 && (
                    <button className="btn btn-sm btn-secondary"
                      title="Reemplazar este profesional por otro (queda registrado el cambio)"
                      onClick={() => setReemplazando({ index: i, miembro: m })}>
                      🔄 Reemplazar
                    </button>
                  )}
                  <button className="btn btn-sm btn-danger" onClick={() => delMiembro(i)}>×</button>
                </div>
              </div>
              <div className="form-grid" style={{ gap: 8 }}>
                <div className="form-group full"><label>Profesional</label>
                  <select value={m.recursoId} onChange={e => editMiembro(i, { recursoId: Number(e.target.value) })}>
                    <option value={0}>— Seleccionar profesional —</option>
                    {recursos.map(r => (
                      <option key={r.id} value={r.id} disabled={r.id !== m.recursoId && idsEnEquipo.has(r.id)}>
                        {nombreCompleto(r)} ({r.perfilPrincipal})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Perfil en el proyecto</label>
                  <select value={m.perfil} onChange={e => editMiembro(i, { perfil: e.target.value })}>
                    {perfiles.filter(p => p.activo || p.nombre === m.perfil).map(p => (
                      <option key={p.id} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Seniority</label>
                  <select value={m.seniority} onChange={e => editMiembro(i, { seniority: e.target.value })}>
                    {seniorities.filter(s => s.activo || s.nombre === m.seniority).map(s => (
                      <option key={s.id} value={s.nombre}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><label>Desde</label><input value={m.fechaDesde} onChange={e => editMiembro(i, { fechaDesde: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                <div className="form-group"><label>Hasta</label><input value={m.fechaHasta} onChange={e => editMiembro(i, { fechaHasta: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                <PctAsignacionRow miembro={m} miembros={equipo} servicio={f} clientes={clientes}
                  onOverride={pct => editMiembro(i, { porcentaje: pct })} />
              </div>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addMiembro}>+ Agregar miembro al equipo</button>
        </div>

        {f.modoCertificacion === 'Hitos' && <>
          <div className="form-section-title">
            Hitos de certificación &nbsp;
            <span style={{ fontSize: 11, fontWeight: 600, color: totalHitos === 100 ? 'var(--green)' : totalHitos > 0 ? 'var(--orange)' : 'var(--gray-mute)' }}>
              (Total: {totalHitos}% {totalHitos === 100 ? '✓' : totalHitos > 100 ? '⚠ excede 100%' : ''})
            </span>
          </div>
          <div className="form-group full">
            <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginBottom: 6 }}>
              Cargá los hitos esperados con fecha estimada de certificación. El PM marcará cada hito como cumplido desde el detalle de Avances.
            </div>
            {f.hitos.length === 0 && <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>Sin hitos cargados.</div>}
            {f.hitos.map((h, i) => (
              <div key={i} style={{ border: '1px solid var(--gray-line)', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong style={{ fontSize: 11, color: 'var(--orange)' }}>Hito {i + 1}</strong>
                  <button className="btn btn-sm btn-danger" onClick={() => delHito(i)}>×</button>
                </div>
                <div className="form-grid" style={{ gap: 8 }}>
                  <div className="form-group"><label>Nombre</label><input value={h.nombre} onChange={e => editHito(i, { nombre: e.target.value })} placeholder="Kick-off, Avance 1..." /></div>
                  <div className="form-group"><label>% Facturación</label><input type="number" min={0} max={100} value={h.porcentaje || ''} onChange={e => editHito(i, { porcentaje: e.target.value === '' ? 0 : Number(e.target.value) })} /></div>
                  <div className="form-group"><label>Fecha estimada de cert.</label><input value={h.fechaCert} onChange={e => editHito(i, { fechaCert: e.target.value })} placeholder="dd/mm/aaaa" /></div>
                  <div className="form-group"><label>Horas (opcional)</label><input type="number" step="0.1" value={h.horas ?? ''} onChange={e => editHito(i, { horas: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                  <div className="form-group"><label>Monto (opcional)</label><input type="number" step="0.01" value={h.valor ?? ''} onChange={e => editHito(i, { valor: e.target.value === '' ? null : Number(e.target.value) })} /></div>
                  <div className="form-group"><label>Cumplido</label>
                    <select value={h.cumplido ? 'true' : 'false'} onChange={e => editHito(i, { cumplido: e.target.value === 'true' })}>
                      <option value="false">No</option><option value="true">Sí</option>
                    </select>
                  </div>
                  <div className="form-group full"><label>Responsable del hito</label>
                    <select value={h.responsableId ?? 0} onChange={e => editHito(i, { responsableId: Number(e.target.value) || undefined })}>
                      <option value={0}>— Sin asignar —</option>
                      {equipo.filter(m => m.recursoId > 0).length > 0 && (
                        <optgroup label="Equipo del servicio">
                          {equipo.filter(m => m.recursoId > 0).map(m => (
                            <option key={`eq-${m.recursoId}`} value={m.recursoId}>{m.nombre} · {m.perfil}</option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Otros profesionales">
                        {recursos
                          .filter(r => !equipo.some(m => m.recursoId === r.id))
                          .sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b)))
                          .map(r => (
                            <option key={`ot-${r.id}`} value={r.id}>{nombreCompleto(r)}</option>
                          ))}
                      </optgroup>
                    </select>
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addHito}>+ Agregar hito</button>
          </div>
        </>}

        <HorasPorPerfilSection
          servicio={f}
          perfiles={perfiles}
          seniorities={seniorities}
          onChange={list => u({ horasPorPerfil: list })}
        />

        <div className="form-section-title">Alertas (una por línea)</div>
        <div className="form-group full">
          <textarea value={f.alertas.join('\n')} onChange={e => u({ alertas: e.target.value.split('\n') })}
            placeholder="Fecha fin próxima&#10;Sin OC" />
        </div>

        <div className="form-section-title">Bloqueos</div>
        <div className="form-group full">
          {f.bloqueos.map((b, i) => (
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
                    {categoriasBloqueo.filter(c => c.activo || c.nombre === b.categoria).map(c =>
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

        <div className="form-section-title">Riesgos
          {(f.riesgos?.length ?? 0) > 0 && (
            <span style={{ fontSize: 11, color: 'var(--gray-mute)', fontWeight: 600, marginLeft: 6 }}>
              ({f.riesgos!.length} identificado{f.riesgos!.length === 1 ? '' : 's'})
            </span>
          )}
        </div>
        <div className="form-group full">
          {(f.riesgos?.length ?? 0) === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>
              Sin riesgos identificados.
            </div>
          )}
          {(f.riesgos || []).map((r, i) => (
            <div key={i} style={{ border: '1px solid var(--gray-line)', borderRadius: 8, padding: 10, marginBottom: 8, background: '#fafafa', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <strong style={{ fontSize: 13 }}>{r.titulo || <span style={{ color: 'var(--gray-mute)' }}>— Sin título —</span>}</strong>
                <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 2 }}>
                  Prob {r.probabilidad} · Imp {r.impacto} · {r.estado}{r.owner ? ` · ${r.owner}` : ''}
                </div>
              </div>
              <button className="btn btn-sm btn-secondary"
                onClick={() => setEditandoRiesgo({ idx: i, riesgo: { ...r } })}>✏</button>
              <button className="btn btn-sm btn-danger"
                onClick={() => {
                  if (!confirm('¿Eliminar este riesgo?')) return;
                  u({ riesgos: (f.riesgos || []).filter((_, j) => j !== i) });
                }}>×</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={() => setEditandoRiesgo({
            idx: null,
            riesgo: {
              id: Date.now(), titulo: '', probabilidad: 'Media', impacto: 'Medio',
              owner: '', estado: 'Identificado', fechaIdentificacion: ddmmaaaa(HOY),
            },
          })}>+ Identificar riesgo</button>
        </div>
      </div>
      {confirmandoCambios && (
        <ConfirmarCambiosModal
          cambios={confirmandoCambios.cambios}
          onCancel={() => setConfirmandoCambios(null)}
          onConfirm={confirmarCambios}
        />
      )}
      {reemplazando && (
        <ReemplazoMiembroModal
          miembroAReemplazar={reemplazando.miembro}
          recursos={recursos}
          idsEnEquipo={idsEnEquipo}
          onClose={() => setReemplazando(null)}
          onConfirm={({ nuevoRecursoId, fecha, motivo, mantenerPerfil }) => {
            const r = recursos.find(x => x.id === nuevoRecursoId);
            if (!r) return;
            // El saliente queda "cerrado" con fechaHasta = día anterior a la fecha del cambio.
            // En el modelo de equipo del modal local solo trabajamos con los miembros visibles —
            // marcamos el saliente como "removido" del equipo (delete) y agregamos al nuevo.
            // La denormalización a Recurso.asignaciones la hace saveServicio.
            const nuevoMiembro: MiembroEquipo = {
              recursoId: r.id,
              nombre: nombreCompleto(r),
              perfil: mantenerPerfil ? reemplazando.miembro.perfil : (r.perfilPrincipal || 'Dev'),
              seniority: mantenerPerfil ? reemplazando.miembro.seniority : (r.seniorityPrincipal || 'Semi-Sr'),
              porcentaje: reemplazando.miembro.porcentaje,
              porcentajeAuto: reemplazando.miembro.porcentajeAuto,
              esOverride: reemplazando.miembro.esOverride,
              fechaDesde: fecha,
              fechaHasta: reemplazando.miembro.fechaHasta,
            };
            const nuevo = [...equipo];
            nuevo[reemplazando.index] = nuevoMiembro;
            setEquipo(nuevo);
            // Anotamos el cambio en el servicio para que quede como historial.
            const cambio: CambioServicio = {
              id: Date.now(),
              tipo: 'Alcance',  // los reemplazos los anotamos como cambio de equipo (categoría Alcance)
              fechaRegistro: ddmmaaaa(HOY),
              descripcion: `Reemplazo de equipo: ${reemplazando.miembro.nombre} → ${nombreCompleto(r)} (${reemplazando.miembro.perfil}). Vigencia desde ${fecha}.`,
              motivo,
              elevarComercial: false,
              autor: usuario,
            };
            setF(prev => ({ ...prev, cambios: [...(prev.cambios || []), cambio] }));
            setReemplazando(null);
          }}
        />
      )}
      {editandoRiesgo && (
        <RiesgoEditModal
          riesgo={editandoRiesgo.riesgo}
          categorias={categoriasBloqueo}
          onClose={() => setEditandoRiesgo(null)}
          onSave={r => {
            const next = [...(f.riesgos || [])];
            if (editandoRiesgo.idx == null) next.push(r);
            else next[editandoRiesgo.idx] = r;
            u({ riesgos: next });
            setEditandoRiesgo(null);
          }}
        />
      )}
    </Modal>
  );
}

// ============================================================
// Mini-modal: confirma cambios sensibles. Pide motivo + ¿elevar a Comercial?
// para cada cambio detectado.
// ============================================================
function ConfirmarCambiosModal({
  cambios, onCancel, onConfirm,
}: {
  cambios: DetectedChange[];
  onCancel: () => void;
  onConfirm: (con: { tipo: TipoCambio; valorAnterior: string; valorNuevo: string; motivo: string; elevarComercial: boolean }[]) => void;
}) {
  const [filas, setFilas] = useState(() => cambios.map(c => ({ ...c, motivo: '', elevarComercial: false })));
  const edit = (i: number, p: Partial<typeof filas[number]>) => {
    const n = [...filas]; n[i] = { ...n[i], ...p }; setFilas(n);
  };
  return (
    <Modal open title="Cambios detectados" onClose={onCancel}
      footer={<>
        <button className="btn btn-secondary" onClick={onCancel}>Volver al formulario</button>
        <button className="btn btn-primary" onClick={() => onConfirm(filas)}>Confirmar y guardar</button>
      </>}>
      <div style={{ fontSize: 13, color: 'var(--gray-text)', marginBottom: 12 }}>
        Estás por modificar datos sensibles del servicio. Cada cambio queda registrado en el historial.
        Indicá el motivo y marcá si requiere notificación a Comercial.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filas.map((c, i) => (
          <div key={i} style={{ border: '1.5px solid var(--orange)', borderRadius: 8, padding: 12, background: 'var(--orange-soft)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 6 }}>
              {TIPO_CAMBIO_LABEL[c.tipo]}
            </div>
            <div style={{ fontSize: 12, marginBottom: 10 }}>
              <span className="mono" style={{ color: 'var(--gray-mute)', textDecoration: 'line-through' }}>{c.valorAnterior}</span>
              <span style={{ margin: '0 8px', color: 'var(--orange)' }}>→</span>
              <span className="mono" style={{ fontWeight: 700, color: 'var(--gray-dark)' }}>{c.valorNuevo}</span>
            </div>
            <div className="form-group" style={{ marginBottom: 6 }}>
              <label style={{ fontSize: 11 }}>Motivo del cambio</label>
              <input value={c.motivo} onChange={e => edit(i, { motivo: e.target.value })}
                placeholder="Ej: Reprogramación por bloqueo cliente / Ampliación scope aprobada" />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" style={{ width: 16, height: 16 }} checked={c.elevarComercial}
                onChange={e => edit(i, { elevarComercial: e.target.checked })} />
              <span><strong>Elevar a Comercial</strong> · requiere su revisión/aprobación</span>
            </label>
          </div>
        ))}
      </div>
    </Modal>
  );
}

// ============================================================
// Fila de % asignación: muestra el % auto + permite override manual.
// Recibe `miembros` para que el cálculo del split parejo sea correcto.
// ============================================================
function PctAsignacionRow({
  miembro, miembros, servicio, clientes, onOverride,
}: {
  miembro: MiembroEquipo;
  miembros: MiembroEquipo[];
  servicio: Servicio;
  clientes: Cliente[];
  onOverride: (pct: number) => void;
}) {
  const slots = miembros.filter(m => m.recursoId > 0).map(m => ({ perfil: m.perfil, seniority: m.seniority }));
  const auto = porcentajeAuto(servicio, miembro.perfil, miembro.seniority, slots, clientes);
  const esOverride = miembro.porcentaje != null && miembro.porcentaje > 0 && miembro.porcentaje !== auto;
  const efectivo = esOverride ? miembro.porcentaje : auto;
  const [editing, setEditing] = useState(esOverride);

  const color = efectivo > 100 ? 'var(--red)' : efectivo >= 50 ? 'var(--green)' : efectivo > 0 ? 'var(--orange)' : 'var(--gray-mute)';

  return (
    <div className="form-group">
      <label>% Asignación {esOverride && <span style={{ color: 'var(--orange)', fontSize: 10, marginLeft: 4 }}>· override</span>}</label>
      {editing ? (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <input type="number" min={0} max={300} value={miembro.porcentaje || ''}
            onChange={e => onOverride(e.target.value === '' ? 0 : Number(e.target.value))}
            style={{ flex: 1 }} />
          <button className="btn btn-sm btn-secondary"
            title="Limpiar override y volver al cálculo automático"
            onClick={() => { onOverride(0); setEditing(false); }}>↺</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', height: 36 }}>
          <span className="mono" style={{ fontWeight: 700, color, fontSize: 14 }}>{efectivo}%</span>
          <span style={{ fontSize: 10, color: 'var(--gray-mute)' }}>auto</span>
          <button className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto' }}
            title="Sobreescribir manualmente"
            onClick={() => setEditing(true)}>✏</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sección plegable: Horas contratadas desglosadas por perfil/seniority.
// Si el PM la carga, el % auto del equipo sale de acá. Si no, fallback
// al split parejo de horasCont entre miembros.
// ============================================================
// ============================================================
// Modal de reemplazo de un profesional en un slot de equipo.
// Pide quién entra, desde qué fecha, motivo y si mantiene perfil/seniority.
// ============================================================
function ReemplazoMiembroModal({
  miembroAReemplazar, recursos, idsEnEquipo, onClose, onConfirm,
}: {
  miembroAReemplazar: MiembroEquipo;
  recursos: Recurso[];
  idsEnEquipo: Set<number>;
  onClose: () => void;
  onConfirm: (d: { nuevoRecursoId: number; fecha: string; motivo: string; mantenerPerfil: boolean }) => void;
}) {
  const [nuevoRecursoId, setNuevoRecursoId] = useState<number>(0);
  const [fecha, setFecha] = useState(ddmmaaaa(HOY));
  const [motivo, setMotivo] = useState('');
  const [mantenerPerfil, setMantenerPerfil] = useState(true);

  const recursosOrden = useMemo(
    () => [...recursos].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [recursos],
  );

  const confirmar = () => {
    if (!nuevoRecursoId) return;
    if (!fecha.trim()) return;
    onConfirm({ nuevoRecursoId, fecha: fecha.trim(), motivo: motivo.trim(), mantenerPerfil });
  };

  return (
    <Modal open title={`Reemplazar a ${miembroAReemplazar.nombre}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar} disabled={!nuevoRecursoId || !fecha.trim()}>
          Confirmar reemplazo
        </button>
      </>}>
      <div style={{ fontSize: 12, color: 'var(--gray-text)', marginBottom: 12 }}>
        El profesional saliente queda como histórico en el equipo. El reemplazo toma el mismo slot
        (perfil, seniority, %) si así lo elegís, o usa los datos del nuevo recurso si no.
      </div>
      <div className="form-grid">
        <div className="form-group full"><label>Slot a reemplazar (read-only)</label>
          <div style={{ fontSize: 12, padding: '8px 10px', background: 'var(--gray-soft)', borderRadius: 6 }}>
            <strong>{miembroAReemplazar.nombre}</strong> · {miembroAReemplazar.perfil} · {miembroAReemplazar.seniority} · {miembroAReemplazar.porcentaje}%
          </div>
        </div>
        <div className="form-group full"><label>Nuevo profesional *</label>
          <select value={nuevoRecursoId} onChange={e => setNuevoRecursoId(Number(e.target.value))}>
            <option value={0}>— Seleccionar profesional —</option>
            {recursosOrden.filter(r => r.id !== miembroAReemplazar.recursoId && !idsEnEquipo.has(r.id)).map(r => (
              <option key={r.id} value={r.id}>{nombreCompleto(r)} ({r.perfilPrincipal})</option>
            ))}
          </select>
        </div>
        <div className="form-group"><label>Fecha del reemplazo</label>
          <input value={fecha} onChange={e => setFecha(e.target.value)} placeholder="dd/mm/aaaa" />
        </div>
        <div className="form-group full"><label>Motivo de la baja del anterior</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: renuncia, rotación interna, finalización de contrato" />
        </div>
        <label className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={mantenerPerfil}
            onChange={e => setMantenerPerfil(e.target.checked)} />
          <span style={{ fontSize: 12 }}>Mantener mismo perfil, seniority y % del slot anterior</span>
        </label>
      </div>
    </Modal>
  );
}

function HorasPorPerfilSection({
  servicio, perfiles, seniorities, onChange,
}: { servicio: Servicio; perfiles: Perfil[]; seniorities: Seniority[]; onChange: (list: HorasPorPerfil[]) => void }) {
  const list = servicio.horasPorPerfil || [];
  const [abierto, setAbierto] = useState(list.length > 0);
  const suma = list.reduce((a, h) => a + (h.horas || 0), 0);
  const horasCont = servicio.horasCont ?? 0;

  const edit = (i: number, p: Partial<HorasPorPerfil>) => {
    const n = [...list]; n[i] = { ...n[i], ...p }; onChange(n);
  };
  const add = () => onChange([...list, { perfil: 'Dev', seniority: 'Semi-Sr', horas: 0 }]);
  const del = (i: number) => onChange(list.filter((_, j) => j !== i));

  const sumaOk = horasCont > 0 && Math.abs(suma - horasCont) < 0.5;

  return (
    <>
      <div className="form-section-title" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setAbierto(!abierto)}>
        {abierto ? '▼' : '▶'} Horas contratadas por perfil &nbsp;
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-mute)' }}>
          (opcional · si lo cargás, el % de cada miembro sale de acá)
        </span>
        {list.length > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: sumaOk ? 'var(--green)' : 'var(--orange)', marginLeft: 8 }}>
            {suma} / {horasCont || '?'} hs {sumaOk ? '✓' : suma > 0 ? '⚠' : ''}
          </span>
        )}
      </div>
      {abierto && (
        <div className="form-group full">
          {list.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--gray-mute)', padding: '4px 0 8px' }}>
              Sin desglose. El cálculo automático va a repartir las horas contratadas en partes iguales entre el equipo.
            </div>
          )}
          {list.map((h, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'end' }}>
              <div className="form-group" style={{ flex: 2 }}>
                <label>Perfil</label>
                <select value={h.perfil} onChange={e => edit(i, { perfil: e.target.value })}>
                  {perfiles.filter(p => p.activo || p.nombre === h.perfil).map(p =>
                    <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Seniority</label>
                <select value={h.seniority} onChange={e => edit(i, { seniority: e.target.value })}>
                  {seniorities.filter(s => s.activo || s.nombre === h.seniority).map(s =>
                    <option key={s.id} value={s.nombre}>{s.nombre}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Horas</label>
                <input type="number" step="1" value={h.horas || ''}
                  onChange={e => edit(i, { horas: e.target.value === '' ? 0 : Number(e.target.value) })} />
              </div>
              <button className="btn btn-sm btn-danger" style={{ marginBottom: 4 }} onClick={() => del(i)}>×</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={add}>+ Agregar slot</button>
        </div>
      )}
    </>
  );
}

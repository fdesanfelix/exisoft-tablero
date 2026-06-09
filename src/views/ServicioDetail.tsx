import { useState } from 'react';
import { Modal } from '../components/Modal';
import { EstadoBadge, PaisBadge, TipoBadge } from '../components/Badges';
import { equipoDe, HOY, MODOS_CERT_LABEL, TIPO_CAMBIO_LABEL, ultimoAvance, type Avance, type CambioServicio, type Cliente, type MiembroEquipo, type Recurso, type Rol, type Servicio } from '../types';
import { RegistrarAlcanceModal, RegistrarCambioFechaModal } from './CambioModals';

// ============================================================
// Banner de datos faltantes / inconsistencias para la ficha del servicio.
// El objetivo es guiar al PM/Gerencia a completar lo que falta sin tener
// que descubrirlo recorriendo cada vista.
// ============================================================
// ============================================================
// Panel destacado: balance final de horas para servicios cerrados.
// Muestra contratadas / consumidas / diferencia con color según sobrante o exceso.
// ============================================================
// ============================================================
// Relaciones del proyecto: padre del que deriva + hijos que derivan de él.
// ============================================================
// ============================================================
// Modal: pregunta qué hacer con las horas sobrantes al cerrar.
// ============================================================
function SaldoCierreModal({
  horasSobrantes, cliente, onCancelar, onConfirmar,
}: {
  horasSobrantes: number; cliente: string;
  onCancelar: () => void;
  onConfirmar: (destino: 'AFavorCliente' | 'Vencidas') => void;
}) {
  return (
    <Modal open title="¿Qué pasa con las horas sobrantes?" onClose={onCancelar}
      footer={<button className="btn btn-secondary" onClick={onCancelar}>Cancelar</button>}>
      <div style={{ fontSize: 13, color: 'var(--gray-text)', marginBottom: 14, lineHeight: 1.5 }}>
        Al servicio le quedan <strong className="mono" style={{ color: 'var(--orange)' }}>{horasSobrantes.toLocaleString()} hs</strong> sin consumir.
        Antes de cerrarlo definitivamente, indicá qué pasa con ese saldo según el contrato con <strong>{cliente}</strong>.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <button
          onClick={() => onConfirmar('AFavorCliente')}
          style={{
            padding: 14, borderRadius: 10, border: '2px solid var(--green)',
            background: 'var(--green-soft)', cursor: 'pointer', textAlign: 'left',
          }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green)', marginBottom: 4 }}>✓ A favor del cliente</div>
          <div style={{ fontSize: 11, color: 'var(--gray-text)', lineHeight: 1.4 }}>
            Las horas quedan reservadas para futuro uso del cliente. Si más adelante deriva un nuevo servicio, vas a poder trasladar este saldo.
          </div>
        </button>
        <button
          onClick={() => onConfirmar('Vencidas')}
          style={{
            padding: 14, borderRadius: 10, border: '2px solid var(--red)',
            background: 'var(--red-soft)', cursor: 'pointer', textAlign: 'left',
          }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 4 }}>✕ Vencidas / se pierden</div>
          <div style={{ fontSize: 11, color: 'var(--gray-text)', lineHeight: 1.4 }}>
            Por contrato las horas no usadas se pierden en este período. No se podrán recuperar para servicios futuros.
          </div>
        </button>
      </div>
    </Modal>
  );
}

function RelacionesProyecto({ s, servicios }: { s: Servicio; servicios: Servicio[] }) {
  const padre = s.derivaDe ? servicios.find(x => x.id === s.derivaDe) : null;
  const hijos = servicios.filter(x => x.derivaDe === s.id);
  if (!padre && hijos.length === 0) return null;
  return (
    <>
      <SectionTitle>Relación con otros proyectos</SectionTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {padre && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, background: 'var(--gray-soft)', borderRadius: 6, fontSize: 13, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-mute)', textTransform: 'uppercase', minWidth: 90 }}>↑ Deriva de</span>
            <strong>{padre.cliente}</strong>
            <span>·</span>
            <span>{padre.nombre}</span>
            {s.horasHeredadas && (
              <span className="pill ok" title={`Heredó ${s.horasHeredadas} hs del servicio anterior`}>↻ {s.horasHeredadas} hs heredadas</span>
            )}
            <span style={{ marginLeft: 'auto' }}><EstadoBadge estado={padre.estado} /></span>
          </div>
        )}
        {hijos.length > 0 && (
          <div style={{ padding: 8, background: 'var(--orange-soft)', borderRadius: 6, fontSize: 13 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 6 }}>
              ↓ Servicios derivados ({hijos.length})
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {hijos.map(h => (
                <li key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong>{h.cliente}</strong>
                  <span>·</span>
                  <span>{h.nombre}</span>
                  {h.horasHeredadasDeId === s.id && h.horasHeredadas && (
                    <span className="pill ok">↻ {h.horasHeredadas} hs</span>
                  )}
                  <span style={{ marginLeft: 'auto' }}><EstadoBadge estado={h.estado} /></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

function BalanceCierre({ s }: { s: Servicio }) {
  // Solo se muestra para servicios cerrados (definitivos o por PM).
  if (s.estado !== 'Cerrado' && s.estado !== 'Cerrado por PM') return null;
  if (s.horasCont == null) return null;

  const consumidas = s.horasCons || 0;
  const balance = s.horasCont - consumidas;
  const sobraron = balance > 0;
  const empate = Math.abs(balance) < 0.5;
  const exceso = balance < 0;
  const pct = s.horasCont > 0 ? Math.round((consumidas / s.horasCont) * 100) : 0;

  const color = empate ? 'var(--green)' : exceso ? 'var(--red)' : sobraron ? 'var(--orange)' : 'var(--gray-dark)';
  const fondo = empate ? 'var(--green-soft)' : exceso ? 'var(--red-soft)' : 'var(--orange-soft)';
  const titulo = empate ? 'Cierre balanceado' : exceso ? 'Cerró con exceso de horas' : 'Cerró con horas sin consumir';
  const subtitulo = empate
    ? 'Las horas contratadas y consumidas coincidieron al cierre.'
    : exceso
      ? `Se consumieron ${Math.abs(balance).toLocaleString()} hs más de lo contratado.`
      : `Quedaron ${balance.toLocaleString()} hs sin consumir al cierre.`;

  return (
    <div style={{
      background: fondo, border: `1.5px solid ${color}`, borderRadius: 10,
      padding: 14, marginBottom: 16,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
        ▣ {titulo}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-dark)', marginBottom: 10 }}>{subtitulo}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Contratadas</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-dark)' }}>{s.horasCont.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Consumidas ({pct}%)</div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-dark)' }}>{consumidas.toLocaleString()}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: .4 }}>
            {sobraron ? 'Sobraron' : exceso ? 'Excedió' : 'Balance'}
          </div>
          <div className="mono" style={{ fontSize: 22, fontWeight: 800, color }}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Destino del saldo cuando hay sobrantes */}
      {sobraron && s.saldoCierre && (
        <div style={{ marginTop: 12, padding: '8px 12px', background: '#fff', border: '1px solid var(--gray-line)', borderRadius: 8, fontSize: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-mute)', textTransform: 'uppercase', letterSpacing: .4 }}>Destino del saldo:</span>
          {s.saldoCierre === 'AFavorCliente' && (
            <span className="pill ok">✓ A favor del cliente · {balance.toLocaleString()} hs disponibles para futuro servicio</span>
          )}
          {s.saldoCierre === 'Vencidas' && (
            <span className="pill venc">✕ Vencidas · se pierden por contrato</span>
          )}
          {s.saldoCierre === 'Trasladadas' && (
            <span className="pill ok">↻ Trasladadas · {(s.horasTrasladadasCant || 0).toLocaleString()} hs reasignadas a otro servicio</span>
          )}
        </div>
      )}
    </div>
  );
}

function DatosFaltantesBanner({
  s, equipo, totalHitos, onEdit,
}: { s: Servicio; equipo: MiembroEquipo[]; totalHitos: number; onEdit?: () => void }) {
  // No mostramos nada en servicios cerrados (ya no es accionable).
  if (s.estado === 'Cerrado') return null;

  const hayPM = equipo.some(m => /PM/i.test(m.perfil));
  const items: string[] = [];

  if (s.modoCertificacion === 'Hitos' && s.hitos.length === 0) {
    items.push('Modo de certificación "Por hitos": sin hitos cargados.');
  }
  if (s.modoCertificacion === 'Hitos' && s.hitos.length > 0 && totalHitos !== 100) {
    items.push(`Hitos cubren ${totalHitos}% del contrato (deben sumar 100%).`);
  }
  if (s.seguimientoAvances && equipo.length === 0) {
    items.push('Marcado para Gestión de Proyectos pero sin equipo asignado.');
  }
  if (s.seguimientoAvances && equipo.length > 0 && !hayPM) {
    items.push('Marcado para Gestión de Proyectos pero sin PM en el equipo.');
  }
  if (s.estado === 'En curso' && !s.inicio.trim()) {
    items.push('Servicio en curso sin fecha de inicio cargada.');
  }
  if (s.estado === 'En curso' && !s.fin.trim()) {
    items.push('Servicio en curso sin fecha estimada de fin.');
  }
  if (s.tieneOC === false) {
    items.push('Servicio sin OC registrada.');
  }

  if (items.length === 0) return null;

  return (
    <div style={{
      background: 'var(--orange-soft, #fff3e6)',
      border: '1px solid var(--orange)',
      borderRadius: 8,
      padding: 10,
      marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--orange)', textTransform: 'uppercase', marginBottom: 6 }}>
            ⚠ {items.length} dato{items.length === 1 ? '' : 's'} faltante{items.length === 1 ? '' : 's'} o inconsistente{items.length === 1 ? '' : 's'}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gray-dark)' }}>
            {items.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
        {onEdit && (
          <button className="btn btn-sm btn-primary" onClick={onEdit} style={{ flexShrink: 0 }}>✏ Completar</button>
        )}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  servicio: Servicio | null;
  recursos: Recurso[];
  servicios: Servicio[];
  clientes: Cliente[];
  avances: Avance[];
  rol: Rol;
  usuario: string;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCierre: (s: Servicio) => void;
  onGoToAvances?: (servicioId: number) => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-line)', fontSize: 12 }}>
    <span style={{ color: 'var(--gray-mute)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: .4 }}>{label}</span>
    <span style={{ color: 'var(--gray-dark)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, color: 'var(--orange)', margin: '14px 0 8px', borderTop: '1px solid var(--gray-line)', paddingTop: 12 }}>{children}</div>
);

export function ServicioDetail({ open, servicio, recursos, servicios, clientes, avances, rol, usuario, onClose, onEdit, onDelete, onCierre, onGoToAvances }: Props) {
  if (!open || !servicio) return null;
  const s = servicio;
  const equipo = equipoDe(s.id, recursos, servicios, clientes);
  const ultimo = ultimoAvance(avances, s.id);
  const pct = s.horasCont ? Math.round(((s.horasCons || 0) / s.horasCont) * 100) : null;
  const totalHitos = s.hitos.reduce((a, h) => a + (h.porcentaje || 0), 0);
  const puedeEditar = rol !== 'Comercial';
  // (esPM ya no se usa — el cierre como PM se hace desde Gestión de Proyectos.)
  const esGerenciaServ = rol === 'GerenciaServicios' || rol === 'DirectorServicios';

  // Cierre PM: pasa a "Cerrado por PM"
  // Cierre Servicios: pasa a "Cerrado". Si hay horas sobrantes pide saldo.
  // (El cierre como PM se hace desde el workspace del proyecto en Gestión de Proyectos.)
  const [saldoModalOpen, setSaldoModalOpen] = useState(false);
  const cerrarServicios = () => {
    const horasSobrantes = (s.horasCont || 0) - (s.horasCons || 0);
    if (s.horasCont != null && horasSobrantes > 0) {
      // Hay sobrantes — abrir modal de saldo
      setSaldoModalOpen(true);
      return;
    }
    if (!confirm('¿Cerrar definitivamente el servicio?')) return;
    onCierre({
      ...s, estado: 'Cerrado',
      cierreServicios: { fecha: HOY.toLocaleDateString('es-AR'), por: usuario },
    });
  };
  const cerrarConSaldo = (destino: 'AFavorCliente' | 'Vencidas') => {
    onCierre({
      ...s, estado: 'Cerrado',
      cierreServicios: { fecha: HOY.toLocaleDateString('es-AR'), por: usuario },
      saldoCierre: destino,
    });
    setSaldoModalOpen(false);
  };
  const reabrir = () => {
    if (!confirm('¿Reabrir el servicio?')) return;
    onCierre({ ...s, estado: 'En curso', cierrePM: undefined, cierreServicios: undefined });
  };

  return (
    <Modal open={open} title={`${s.cliente} — ${s.nombre}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        {s.seguimientoAvances && onGoToAvances && s.estado !== 'Cerrado' && (
          <button className="btn btn-secondary" onClick={() => onGoToAvances(s.id)} title="Ver avances de este proyecto">
            📊 Ver avances
          </button>
        )}
        {/* El cierre como PM se hace desde el workspace del proyecto (tab Gestión de Proyectos).
            Acá solo el cierre definitivo y la reapertura, ambas reservadas a Gerencia/Director. */}
        {puedeEditar && s.estado === 'Cerrado por PM' && esGerenciaServ && (
          <button className="btn btn-primary" onClick={cerrarServicios} title="Validación final + balance de horas">✓ Cerrar definitivo</button>
        )}
        {puedeEditar && (s.estado === 'Cerrado' || s.estado === 'Cerrado por PM') && esGerenciaServ && (
          <button className="btn btn-secondary" onClick={reabrir}>↺ Reabrir</button>
        )}
        {puedeEditar && (
          <>
            <button className="btn btn-danger" onClick={onDelete}>Eliminar</button>
            <button className="btn btn-primary" onClick={onEdit}>✏ Editar</button>
          </>
        )}
      </>}>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <PaisBadge pais={s.pais} />
        <TipoBadge tipo={s.tipo} />
        <EstadoBadge estado={s.estado} />
        {s.tieneOC && <span className="pill ok">Con OC</span>}
        {s.tieneOC === false && <span className="pill venc">Sin OC</span>}
        {s.subcontratado && <span className="badge llave">Subcontratado</span>}
        {s.modoCertificacion !== 'NoCertifica' && <span className="badge cons">Cert: {MODOS_CERT_LABEL[s.modoCertificacion]}</span>}
        {s.seguimientoAvances && <span className="badge soporte">En Gestión de Proyectos</span>}
      </div>

      <DatosFaltantesBanner s={s} equipo={equipo} totalHitos={totalHitos} onEdit={puedeEditar ? onEdit : undefined} />

      <BalanceCierre s={s} />

      <RelacionesProyecto s={s} servicios={servicios} />

      <SectionTitle>Fechas y horas</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Row label="Fecha inicio" value={<span className="mono">{s.inicio || '—'}</span>} />
        <Row label="Fecha fin estimada" value={<span className="mono">{s.fin || '—'}</span>} />
        <Row label="Horas contratadas" value={<span className="mono">{s.horasCont ?? '—'}</span>} />
        <Row label="Horas consumidas" value={<span className="mono">{s.horasCons ?? '—'}</span>} />
        <Row label="Horas restantes" value={<span className="mono">{s.horasRest ?? '—'}</span>} />
        <Row label="% Consumido" value={pct == null ? '—' : <span className="mono" style={{ color: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--green)' }}>{pct}%</span>} />
        <Row label="Tipo de certificación" value={s.certif || '—'} />
        {s.cierrePM && <Row label="Cerrado por PM" value={<><span className="mono">{s.cierrePM.fecha}</span> · {s.cierrePM.por}</>} />}
        {s.cierreServicios && <Row label="Cerrado por Servicios" value={<><span className="mono">{s.cierreServicios.fecha}</span> · {s.cierreServicios.por}</>} />}
      </div>

      {pct != null && (
        <div className="progress-track" style={{ marginTop: 10 }}>
          <div className="progress-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--green)' }} />
        </div>
      )}

      <SectionTitle>Hitos de certificación ({totalHitos}%)</SectionTitle>
      {s.hitos.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Este servicio no declara hitos.</div>
      ) : (
        <table>
          <thead><tr><th>Hito</th><th>% Fact.</th><th>Fecha cert.</th><th>Horas</th><th>Estado</th></tr></thead>
          <tbody>
            {s.hitos.map(h => (
              <tr key={h.id}>
                <td><strong>{h.nombre}</strong></td>
                <td className="mono">{h.porcentaje}%</td>
                <td className="mono">{h.fechaCert || '—'}</td>
                <td className="mono">{h.horas ?? '—'}</td>
                <td>{h.cumplido ? <span className="pill ok">Cumplido</span> : <span className="pill pend">Pendiente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <SectionTitle>Equipo asignado</SectionTitle>
      {equipo.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin equipo asignado todavía.</div>
      ) : (
        <table>
          <thead><tr><th>Profesional</th><th>Perfil</th><th>Seniority</th><th>%</th><th>Desde</th><th>Hasta</th></tr></thead>
          <tbody>
            {equipo.map((m, i) => {
              const color = m.porcentaje > 100 ? 'var(--red)' : m.porcentaje >= 50 ? 'var(--green)' : m.porcentaje > 0 ? 'var(--orange)' : 'var(--gray-mute)';
              return (
                <tr key={i}>
                  <td><strong>{m.nombre}</strong></td>
                  <td>{m.perfil}</td>
                  <td>{m.seniority}</td>
                  <td>
                    <span className="mono" style={{ color, fontWeight: 700 }}>{m.porcentaje}%</span>
                    <small style={{ marginLeft: 6, fontSize: 10, color: m.esOverride ? 'var(--orange)' : 'var(--gray-mute)', fontWeight: 600 }}>
                      {m.esOverride ? 'override' : 'auto'}
                    </small>
                  </td>
                  <td className="mono">{m.fechaDesde || '—'}</td>
                  <td className="mono">{m.fechaHasta || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {ultimo && (
        <>
          <SectionTitle>Último avance ({ultimo.fechaSemana})</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Row label="Estado" value={<span className={`status-badge ${ultimo.estado === 'ON-TRACK' ? 'on' : ultimo.estado === 'AT-RISK' ? 'at' : 'off'}`}>{ultimo.estado}</span>} />
            <Row label="% Real" value={<span className="mono">{ultimo.real}%</span>} />
            <Row label="% Planeado" value={<span className="mono">{ultimo.planeado}%</span>} />
            <Row label="PM Cliente" value={ultimo.pmCliente || '—'} />
          </div>
          {ultimo.comentarios && (
            <div className="comments-box" style={{ marginTop: 10 }}>{ultimo.comentarios}</div>
          )}
        </>
      )}

      <SectionTitle>Bloqueos del servicio</SectionTitle>
      {s.bloqueos.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin bloqueos cargados.</div>
      ) : (
        s.bloqueos.map((b, i) => (
          <div key={i} className={`block-detail ${b.escalado ? 'escalar' : ''}`}>
            <div className="block-detail-title">
              {b.titulo}
              {b.categoria && <span className="badge llave" style={{ marginLeft: 8, fontSize: 10 }}>{b.categoria}</span>}
              {b.escalado && <span className="escalar-badge" style={{ marginLeft: 6 }}>ESCALAR</span>}
            </div>
            <div className="block-detail-desc">{b.desc}</div>
            <div className="block-detail-meta">
              <span><strong>Owner:</strong> {b.owner}</span>
              <span><strong>Estado:</strong> {b.estado}</span>
            </div>
          </div>
        ))
      )}

      {s.alertas.length > 0 && (
        <>
          <SectionTitle>Alertas</SectionTitle>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {s.alertas.map((a, i) => <span key={i} className="chip">{a}</span>)}
          </div>
        </>
      )}

      <HistorialCambios s={s} puedeEditar={puedeEditar} usuario={usuario}
        onRegistrarAlcance={cambio => onCierre({ ...s, cambios: [...(s.cambios || []), cambio] })}
        onRegistrarCambioFecha={r => onCierre({
          ...s,
          [r.campo]: r.nuevaFecha,
          cambios: [...(s.cambios || []), r.cambio],
        })} />

      {saldoModalOpen && (
        <SaldoCierreModal
          horasSobrantes={(s.horasCont || 0) - (s.horasCons || 0)}
          cliente={s.cliente}
          onCancelar={() => setSaldoModalOpen(false)}
          onConfirmar={cerrarConSaldo}
        />
      )}
    </Modal>
  );
}

// ============================================================
// Historial de cambios del servicio (fechas, alcance, horas).
// Lista cronológica + botón para registrar cambio de alcance.
// ============================================================
function HistorialCambios({
  s, puedeEditar, usuario, onRegistrarAlcance, onRegistrarCambioFecha,
}: {
  s: Servicio; puedeEditar: boolean; usuario: string;
  onRegistrarAlcance: (c: CambioServicio) => void;
  onRegistrarCambioFecha: (r: { cambio: CambioServicio; campo: 'inicio' | 'fin'; nuevaFecha: string }) => void;
}) {
  const [openAlcance, setOpenAlcance] = useState(false);
  const [openFecha, setOpenFecha] = useState(false);
  const cambios = s.cambios || [];
  const cambiosOrden = [...cambios].sort((a, b) => b.id - a.id); // más reciente arriba

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px', borderTop: '1px solid var(--gray-line)', paddingTop: 12, gap: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, color: 'var(--orange)' }}>
          Historial de cambios {cambios.length > 0 && <span style={{ color: 'var(--gray-mute)', marginLeft: 4 }}>({cambios.length})</span>}
        </div>
        {puedeEditar && s.estado !== 'Cerrado' && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setOpenFecha(true)}>📅 Cambio de fecha</button>
            <button className="btn btn-sm btn-secondary" onClick={() => setOpenAlcance(true)}>📋 Cambio de alcance</button>
          </div>
        )}
      </div>

      {cambios.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin cambios registrados.</div>
      ) : (
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
            {cambiosOrden.map(c => (
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
      )}

      {openAlcance && (
        <RegistrarAlcanceModal
          autor={usuario}
          onClose={() => setOpenAlcance(false)}
          onConfirm={c => { onRegistrarAlcance(c); setOpenAlcance(false); }}
        />
      )}
      {openFecha && (
        <RegistrarCambioFechaModal
          autor={usuario}
          fechaInicioActual={s.inicio}
          fechaFinActual={s.fin}
          onClose={() => setOpenFecha(false)}
          onConfirm={r => { onRegistrarCambioFecha(r); setOpenFecha(false); }}
        />
      )}
    </>
  );
}


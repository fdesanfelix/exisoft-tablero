import { Modal } from '../components/Modal';
import { asignacionTotal, nombreCompleto, type Recurso, type Rol, type Servicio } from '../types';

interface Props {
  open: boolean;
  recurso: Recurso | null;
  servicios: Servicio[];
  rol: Rol;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--gray-line)', fontSize: 12 }}>
    <span style={{ color: 'var(--gray-mute)', fontWeight: 600, textTransform: 'uppercase', fontSize: 10, letterSpacing: .4 }}>{label}</span>
    <span style={{ color: 'var(--gray-dark)', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</span>
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6, color: 'var(--orange)', margin: '14px 0 8px', borderTop: '1px solid var(--gray-line)', paddingTop: 12 }}>{children}</div>
);

export function RecursoDetail({ open, recurso, servicios, rol, onClose, onEdit, onDelete }: Props) {
  if (!open || !recurso) return null;
  const r = recurso;
  const total = asignacionTotal(r);
  const color = total >= 95 ? 'var(--green)' : total > 0 ? 'var(--orange)' : 'var(--red)';
  const stCls = total >= 95 ? 'on' : total > 0 ? 'at' : 'off';
  const puedeEditar = rol !== 'Comercial';

  return (
    <Modal open={open} title={nombreCompleto(r)} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cerrar</button>
        {puedeEditar && (
          <>
            <button className="btn btn-danger" onClick={onDelete}>Eliminar</button>
            <button className="btn btn-primary" onClick={onEdit}>✏ Editar</button>
          </>
        )}
      </>}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <span className={`status-badge ${stCls}`}>{total}% asignado</span>
        <span className="badge arg">{r.legajo || 'Sin legajo'}</span>
        <span className="badge cons">{r.perfilPrincipal}</span>
        <span className="badge soporte">{r.seniorityPrincipal}</span>
        {r.subcontratado && <span className="badge llave">Subcontratado</span>}
        {r.estadoLaboral !== 'Activo' && <span className="badge off">{r.estadoLaboral}</span>}
        {r.alerta && <span className="chip warn">{r.alerta}</span>}
      </div>

      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${Math.min(total, 100)}%`, background: color }} />
      </div>

      <SectionTitle>Datos personales</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Row label="Nombre" value={r.nombre} />
        <Row label="Apellido" value={r.apellido} />
        <Row label="DNI" value={<span className="mono">{r.dni}</span>} />
        <Row label="CUIT" value={<span className="mono">{r.cuit}</span>} />
        <Row label="Fecha de nacimiento" value={<span className="mono">{r.fechaNacimiento}</span>} />
        <Row label="Mail laboral" value={r.mail} />
        <Row label="Mail personal" value={r.mailPersonal} />
        <Row label="Teléfono" value={<span className="mono">{r.telefono}</span>} />
      </div>

      <SectionTitle>Contratación</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Row label="Legajo" value={r.legajo} />
        <Row label="Tipo de contratación" value={r.tipoContratacion} />
        <Row label="Fecha de ingreso" value={<span className="mono">{r.fechaIngreso}</span>} />
        <Row label="Fecha de renuncia" value={r.fechaRenuncia ? <span className="mono">{r.fechaRenuncia}</span> : '—'} />
        <Row label="Estado laboral" value={r.estadoLaboral} />
        <Row label="Perfil principal" value={r.perfilPrincipal} />
        <Row label="Seniority" value={r.seniorityPrincipal} />
        <Row label="Subcontratado" value={r.subcontratado ? 'Sí' : 'No'} />
      </div>

      <SectionTitle>Dirección</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
        <Row label="Calle y número" value={`${r.dirCalle} ${r.dirNumero}${r.dirPisoDto ? ' — ' + r.dirPisoDto : ''}`} />
        <Row label="Ciudad" value={r.dirCiudad} />
        <Row label="Provincia" value={r.dirProvincia} />
        <Row label="País" value={r.dirPais} />
      </div>

      {(r.personaContacto || r.telContacto) && (
        <>
          <SectionTitle>Contacto de emergencia</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Row label="Persona" value={r.personaContacto} />
            <Row label="Teléfono" value={<span className="mono">{r.telContacto}</span>} />
          </div>
        </>
      )}

      <SectionTitle>Asignación a servicios ({total}%)</SectionTitle>
      {r.asignaciones.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--gray-mute)' }}>Sin asignaciones (Bench).</div>
      ) : (
        <table>
          <thead><tr><th>Servicio</th><th>Cliente</th><th>Perfil</th><th>Seniority</th><th>%</th><th>Desde</th><th>Hasta</th></tr></thead>
          <tbody>
            {r.asignaciones.map((asn, i) => {
              const s = servicios.find(x => x.id === asn.servicioId);
              return (
                <tr key={i}>
                  <td><strong>{s?.nombre || `Servicio ${asn.servicioId}`}</strong></td>
                  <td>{s?.cliente || '—'}</td>
                  <td>{asn.perfil}</td>
                  <td>{asn.seniority}</td>
                  <td className="mono">{asn.porcentaje}%</td>
                  <td className="mono">{asn.fechaDesde || '—'}</td>
                  <td className="mono">{asn.fechaHasta || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {r.observaciones && (
        <>
          <SectionTitle>Observaciones</SectionTitle>
          <div className="comments-box">{r.observaciones}</div>
        </>
      )}
    </Modal>
  );
}

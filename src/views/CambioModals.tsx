// Modales reutilizables para registrar cambios sensibles del servicio.
// Se usan tanto desde ServicioDetail (vista contractual) como desde ProyectoDetalle
// (workspace del PM en Avances). Ambos persisten en Servicio.cambios.
import { useState } from 'react';
import { Modal } from '../components/Modal';
import { ddmmaaaa, HOY, TIPO_CAMBIO_LABEL, type CambioServicio, type TipoCambio } from '../types';

// ============================================================
// Registrar cambio de alcance — descripción manual del cambio.
// ============================================================
export function RegistrarAlcanceModal({
  autor, onClose, onConfirm,
}: { autor: string; onClose: () => void; onConfirm: (c: CambioServicio) => void }) {
  const [descripcion, setDescripcion] = useState('');
  const [motivo, setMotivo] = useState('');
  const [elevarComercial, setElevarComercial] = useState(false);

  const confirmar = () => {
    if (!descripcion.trim()) return;
    onConfirm({
      id: Date.now(),
      tipo: 'Alcance',
      fechaRegistro: ddmmaaaa(HOY),
      descripcion: descripcion.trim(),
      motivo: motivo.trim() || undefined,
      elevarComercial,
      estadoElevacion: elevarComercial ? 'Pendiente' : undefined,
      autor,
    });
  };

  return (
    <Modal open title="Registrar cambio de alcance" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar} disabled={!descripcion.trim()}>Registrar</button>
      </>}>
      <div style={{ fontSize: 12, color: 'var(--gray-text)', marginBottom: 10 }}>
        Describí en qué consiste el cambio de alcance — qué se agrega, se quita o se reformula respecto a lo originalmente acordado.
      </div>
      <div className="form-grid">
        <div className="form-group full">
          <label>Descripción del cambio *</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3}
            placeholder="Ej: Se incorpora módulo de reportería avanzada solicitado por el cliente." autoFocus />
        </div>
        <div className="form-group full">
          <label>Motivo (opcional)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Pedido formal del cliente / Cambio normativo / Reformulación funcional" />
        </div>
        <label className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={elevarComercial}
            onChange={e => setElevarComercial(e.target.checked)} />
          <span style={{ fontSize: 12 }}><strong>Elevar a Comercial</strong> · este cambio requiere su revisión / aprobación</span>
        </label>
      </div>
    </Modal>
  );
}

// ============================================================
// Registrar cambio de fecha — pide tipo (inicio/fin), nueva fecha, motivo y elevación.
// Devuelve el cambio + la nueva fecha para que el caller actualice el servicio.
// ============================================================
export function RegistrarCambioFechaModal({
  autor, fechaInicioActual, fechaFinActual, onClose, onConfirm,
}: {
  autor: string;
  fechaInicioActual: string;
  fechaFinActual: string;
  onClose: () => void;
  onConfirm: (resultado: { cambio: CambioServicio; campo: 'inicio' | 'fin'; nuevaFecha: string }) => void;
}) {
  const [tipo, setTipo] = useState<Exclude<TipoCambio, 'Alcance' | 'HorasContratadas'>>('FechaFin');
  const valorActual = tipo === 'FechaInicio' ? fechaInicioActual : fechaFinActual;
  const [nuevaFecha, setNuevaFecha] = useState(valorActual);
  const [motivo, setMotivo] = useState('');
  const [elevarComercial, setElevarComercial] = useState(false);

  const onChangeTipo = (t: typeof tipo) => {
    setTipo(t);
    setNuevaFecha(t === 'FechaInicio' ? fechaInicioActual : fechaFinActual);
  };

  const sinCambio = (nuevaFecha || '').trim() === (valorActual || '').trim();

  const confirmar = () => {
    if (sinCambio) return;
    const cambio: CambioServicio = {
      id: Date.now(),
      tipo,
      fechaRegistro: ddmmaaaa(HOY),
      valorAnterior: valorActual,
      valorNuevo: nuevaFecha.trim(),
      motivo: motivo.trim() || undefined,
      elevarComercial,
      estadoElevacion: elevarComercial ? 'Pendiente' : undefined,
      autor,
    };
    onConfirm({
      cambio,
      campo: tipo === 'FechaInicio' ? 'inicio' : 'fin',
      nuevaFecha: nuevaFecha.trim(),
    });
  };

  return (
    <Modal open title="Registrar cambio de fecha" onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={confirmar} disabled={sinCambio || !nuevaFecha.trim()}>
          {sinCambio ? 'La fecha no cambió' : 'Confirmar cambio'}
        </button>
      </>}>
      <div style={{ fontSize: 12, color: 'var(--gray-text)', marginBottom: 12 }}>
        Cualquier reprogramación queda registrada en el historial del servicio.
      </div>
      <div className="form-grid">
        <div className="form-group">
          <label>¿Qué fecha cambia?</label>
          <select value={tipo} onChange={e => onChangeTipo(e.target.value as typeof tipo)}>
            <option value="FechaFin">{TIPO_CAMBIO_LABEL.FechaFin}</option>
            <option value="FechaInicio">{TIPO_CAMBIO_LABEL.FechaInicio}</option>
          </select>
        </div>
        <div className="form-group">
          <label>Fecha actual</label>
          <input value={valorActual || '—'} disabled style={{ background: '#f5f5f5' }} />
        </div>
        <div className="form-group">
          <label>Nueva fecha</label>
          <input value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} placeholder="dd/mm/aaaa" autoFocus />
        </div>
        <div className="form-group full">
          <label>Motivo (opcional)</label>
          <input value={motivo} onChange={e => setMotivo(e.target.value)}
            placeholder="Ej: Bloqueo cliente / Replanificación de hitos / Pedido formal" />
        </div>
        <label className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={elevarComercial}
            onChange={e => setElevarComercial(e.target.checked)} />
          <span style={{ fontSize: 12 }}><strong>Elevar a Comercial</strong> · requiere su revisión</span>
        </label>
      </div>
    </Modal>
  );
}

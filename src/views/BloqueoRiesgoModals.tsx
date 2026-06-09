// Modales reutilizables para editar Bloqueos y Riesgos.
// Se importan tanto desde ProyectoDetalle (workspace del PM) como desde
// ServicioModal (vista de Gerencia de Servicios). Asegura un único form
// canónico para cada concepto, sin duplicar código.
import { useState } from 'react';
import { Modal } from '../components/Modal';
import {
  severidadRiesgo,
  type Bloqueo, type NivelImpacto, type NivelProbabilidad, type Riesgo,
} from '../types';

interface CategoriaItem { id: number; nombre: string; activo: boolean }

// ============================================================
// Editor de Bloqueo
// ============================================================
export function BloqueoEditModal({
  bloqueo, categorias, onClose, onSave,
}: {
  bloqueo: Bloqueo;
  categorias: CategoriaItem[];
  onClose: () => void;
  onSave: (b: Bloqueo) => void;
}) {
  const [b, setB] = useState<Bloqueo>(bloqueo);
  const u = (p: Partial<Bloqueo>) => setB(prev => ({ ...prev, ...p }));
  return (
    <Modal open title={bloqueo.titulo ? `Editar bloqueo — ${bloqueo.titulo}` : 'Nuevo bloqueo'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(b)} disabled={!b.titulo.trim()}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-group full"><label>Título *</label>
          <input value={b.titulo} onChange={e => u({ titulo: e.target.value })}
            placeholder="Ej: Falta conexión SAP-AWS" autoFocus />
        </div>
        <div className="form-group full"><label>Descripción</label>
          <textarea value={b.desc} onChange={e => u({ desc: e.target.value })} rows={2}
            placeholder="Detalle del impedimento" />
        </div>
        <div className="form-group"><label>Categoría</label>
          <select value={b.categoria || ''} onChange={e => u({ categoria: e.target.value || undefined })}>
            <option value="">— Sin clasificar —</option>
            {categorias.filter(c => c.activo || c.nombre === b.categoria).map(c =>
              <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Owner (quién destraba)</label>
          <input value={b.owner} onChange={e => u({ owner: e.target.value })}
            placeholder="Cliente / proveedor / responsable" />
        </div>
        <div className="form-group"><label>Estado</label>
          <select value={b.estado} onChange={e => u({ estado: e.target.value as Bloqueo['estado'] })}>
            <option>Abierto</option><option>En curso</option><option>Cerrado</option>
          </select>
        </div>
        <div className="form-group"><label>Escalado a Dirección</label>
          <select value={b.escalado ? 'true' : 'false'} onChange={e => u({ escalado: e.target.value === 'true' })}>
            <option value="false">No</option><option value="true">Sí</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ============================================================
// Editor de Riesgo
// ============================================================
export function RiesgoEditModal({
  riesgo, categorias, onClose, onSave,
}: {
  riesgo: Riesgo;
  categorias: CategoriaItem[];
  onClose: () => void;
  onSave: (r: Riesgo) => void;
}) {
  const [r, setR] = useState<Riesgo>(riesgo);
  const u = (p: Partial<Riesgo>) => setR(prev => ({ ...prev, ...p }));
  const sev = severidadRiesgo(r);
  const sevColor = sev.nivel === 'Crítico' ? 'var(--red)' : sev.nivel === 'Alto' ? 'var(--orange)' : sev.nivel === 'Medio' ? '#f5a623' : 'var(--green)';

  return (
    <Modal open title={riesgo.titulo ? `Editar riesgo — ${riesgo.titulo}` : 'Identificar nuevo riesgo'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={() => onSave(r)} disabled={!r.titulo.trim()}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-group full"><label>Título del riesgo *</label>
          <input value={r.titulo} onChange={e => u({ titulo: e.target.value })}
            placeholder="Ej: Demora en aprobación de la arquitectura por parte del cliente" autoFocus />
        </div>
        <div className="form-group full"><label>Descripción</label>
          <textarea value={r.descripcion || ''} onChange={e => u({ descripcion: e.target.value })} rows={2}
            placeholder="¿Qué podría pasar? ¿En qué circunstancias?" />
        </div>
        <div className="form-group"><label>Probabilidad</label>
          <select value={r.probabilidad} onChange={e => u({ probabilidad: e.target.value as NivelProbabilidad })}>
            <option>Baja</option><option>Media</option><option>Alta</option>
          </select>
        </div>
        <div className="form-group"><label>Impacto</label>
          <select value={r.impacto} onChange={e => u({ impacto: e.target.value as NivelImpacto })}>
            <option>Bajo</option><option>Medio</option><option>Alto</option>
          </select>
        </div>
        <div className="form-group"><label>Severidad calculada</label>
          <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'var(--gray-soft)', color: sevColor, fontWeight: 800, fontSize: 14 }}>
            {sev.nivel} ({sev.valor}/9)
          </div>
        </div>
        <div className="form-group full"><label>Plan de mitigación</label>
          <textarea value={r.mitigacion || ''} onChange={e => u({ mitigacion: e.target.value })} rows={2}
            placeholder="¿Qué vamos a hacer para reducir la probabilidad o el impacto?" />
        </div>
        <div className="form-group"><label>Owner del seguimiento</label>
          <input value={r.owner} onChange={e => u({ owner: e.target.value })}
            placeholder="Quién monitorea y actúa" />
        </div>
        <div className="form-group"><label>Categoría</label>
          <select value={r.categoria || ''} onChange={e => u({ categoria: e.target.value || undefined })}>
            <option value="">— Sin clasificar —</option>
            {categorias.filter(c => c.activo || c.nombre === r.categoria).map(c =>
              <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="form-group"><label>Estado</label>
          <select value={r.estado} onChange={e => u({ estado: e.target.value as Riesgo['estado'] })}>
            <option>Identificado</option><option>Mitigado</option>
            <option>Materializado</option><option>Cerrado</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}

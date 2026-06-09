import { useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { CAPACIDAD_MENSUAL_DEFAULT, type CategoriaBloqueo, type Cliente, type Pais, type Perfil, type Seniority, type TablaSoporteItem, type TipoContratacion } from '../types';

type Store = ReturnType<typeof useStore>;
type AdminTab = 'clientes' | 'perfiles' | 'seniorities' | 'contratacion' | 'bloqueos';

const TAB_LABEL: Record<AdminTab, string> = {
  clientes: 'Clientes',
  perfiles: 'Perfiles',
  seniorities: 'Seniorities',
  contratacion: 'Tipos de contratación',
  bloqueos: 'Categorías de bloqueo',
};

// ============================================================
// Vista Admin — sub-solapas por tabla soporte. Solo visible a Gerencia/Director.
// ============================================================
export function AdminView({ store }: { store: Store }) {
  const [tab, setTab] = useState<AdminTab>('clientes');

  return (
    <>
      <div className="view-hero">
        <h1>Administración de <span className="accent">Tablas Soporte</span></h1>
        <p>Catálogos editables que alimentan el resto del sistema — clientes, perfiles, seniorities, modalidades.</p>
      </div>

      <div className="cert-tabs">
        {(Object.keys(TAB_LABEL) as AdminTab[]).map(t => (
          <button key={t} className={`cert-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
            <span className="cert-tab-count">{contadorDeTab(store, t)}</span>
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {tab === 'clientes' && <ClientesAdmin store={store} />}
        {tab === 'perfiles' && <SoporteAdmin
          titulo="Perfiles"
          items={store.perfiles}
          enUso={id => uso.perfilEnUso(store, store.perfiles.find(p => p.id === id)?.nombre || '')}
          onSave={p => store.upsertPerfil(p)}
          onDelete={id => store.deletePerfil(id)} />}
        {tab === 'seniorities' && <SoporteAdmin
          titulo="Seniorities"
          items={store.seniorities}
          enUso={id => uso.seniorityEnUso(store, store.seniorities.find(s => s.id === id)?.nombre || '')}
          onSave={s => store.upsertSeniority(s)}
          onDelete={id => store.deleteSeniority(id)} />}
        {tab === 'contratacion' && <SoporteAdmin
          titulo="Tipos de contratación"
          items={store.tiposContratacion}
          enUso={id => uso.contratacionEnUso(store, store.tiposContratacion.find(t => t.id === id)?.nombre || '')}
          onSave={t => store.upsertTipoContratacion(t)}
          onDelete={id => store.deleteTipoContratacion(id)} />}
        {tab === 'bloqueos' && <SoporteAdmin
          titulo="Categorías de bloqueo"
          items={store.categoriasBloqueo}
          enUso={() => 0}
          onSave={c => store.upsertCategoriaBloqueo(c)}
          onDelete={id => store.deleteCategoriaBloqueo(id)} />}
      </div>
    </>
  );
}

function contadorDeTab(store: Store, t: AdminTab): number {
  if (t === 'clientes') return store.clientes.length;
  if (t === 'perfiles') return store.perfiles.length;
  if (t === 'seniorities') return store.seniorities.length;
  if (t === 'contratacion') return store.tiposContratacion.length;
  return store.categoriasBloqueo.length;
}

// Helpers: contar uso de cada item soporte para advertir al eliminar.
const uso = {
  perfilEnUso(store: Store, nombre: string): number {
    if (!nombre) return 0;
    return store.recursos.reduce((acc, r) => acc + r.asignaciones.filter(a => a.perfil === nombre).length, 0)
      + store.recursos.filter(r => r.perfilPrincipal === nombre).length;
  },
  seniorityEnUso(store: Store, nombre: string): number {
    if (!nombre) return 0;
    return store.recursos.reduce((acc, r) => acc + r.asignaciones.filter(a => a.seniority === nombre).length, 0)
      + store.recursos.filter(r => r.seniorityPrincipal === nombre).length;
  },
  contratacionEnUso(store: Store, nombre: string): number {
    if (!nombre) return 0;
    return store.recursos.filter(r => r.tipoContratacion === nombre).length;
  },
};

// ============================================================
// CRUD genérico para tablas soporte simples (perfiles, seniorities, etc.)
// ============================================================
function SoporteAdmin({
  titulo, items, enUso, onSave, onDelete,
}: {
  titulo: string; items: TablaSoporteItem[]; enUso: (id: number) => number;
  onSave: (item: TablaSoporteItem) => void; onDelete: (id: number) => void;
}) {
  const [editando, setEditando] = useState<TablaSoporteItem | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const eliminar = (item: TablaSoporteItem) => {
    const u = enUso(item.id);
    if (u > 0) {
      if (!confirm(`"${item.nombre}" está en uso por ${u} registro${u === 1 ? '' : 's'}. ¿Eliminar de todas formas?`)) return;
    } else {
      if (!confirm(`¿Eliminar "${item.nombre}"?`)) return;
    }
    onDelete(item.id);
    showToast('Eliminado');
  };

  const itemsOrdenados = [...items].sort((a, b) => a.nombre.localeCompare(b.nombre));

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="panel-title" style={{ margin: 0 }}>{titulo} · {items.length}</div>
        <button className="btn btn-sm btn-primary" onClick={() => setOpenNew(true)}>+ Nuevo</button>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '20%' }}>Nombre</th>
            <th>Descripción</th>
            <th style={{ width: '10%' }}>Estado</th>
            <th style={{ width: '8%' }}>En uso</th>
            <th style={{ width: '14%' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {itemsOrdenados.length === 0 && (
            <tr><td colSpan={5} className="empty-state">Sin items cargados.</td></tr>
          )}
          {itemsOrdenados.map(item => {
            const u = enUso(item.id);
            return (
              <tr key={item.id}>
                <td><strong>{item.nombre}</strong></td>
                <td>{item.descripcion || <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                <td>{item.activo
                  ? <span className="pill ok">Activo</span>
                  : <span className="pill venc">Inactivo</span>}</td>
                <td className="mono" style={{ color: u > 0 ? 'var(--gray-dark)' : 'var(--gray-mute)' }}>{u}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditando(item)} style={{ marginRight: 4 }}>✏</button>
                  <button className="btn btn-sm btn-danger" onClick={() => eliminar(item)}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(openNew || editando) && (
        <SoporteForm
          titulo={titulo}
          inicial={editando}
          existentes={items}
          onClose={() => { setOpenNew(false); setEditando(null); }}
          onSave={item => {
            onSave(item);
            showToast(editando ? 'Actualizado' : 'Agregado');
            setOpenNew(false); setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function SoporteForm({
  titulo, inicial, existentes, onClose, onSave,
}: {
  titulo: string; inicial: TablaSoporteItem | null; existentes: TablaSoporteItem[];
  onClose: () => void; onSave: (item: TablaSoporteItem) => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [descripcion, setDescripcion] = useState(inicial?.descripcion || '');
  const [activo, setActivo] = useState(inicial?.activo ?? true);

  const duplicado = nombre.trim() && existentes.some(x => x.id !== inicial?.id && x.nombre.toLowerCase() === nombre.trim().toLowerCase());

  const guardar = () => {
    if (!nombre.trim()) return showToast('Falta el nombre');
    if (duplicado) return showToast(`Ya existe "${nombre.trim()}"`);
    onSave({
      id: inicial?.id ?? Date.now(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || undefined,
      activo,
    });
  };

  return (
    <Modal open title={inicial ? `Editar — ${titulo}` : `Nuevo — ${titulo}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={!nombre.trim() || !!duplicado}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-group full">
          <label>Nombre {duplicado && <span style={{ color: 'var(--red)', fontSize: 11, marginLeft: 6 }}>· ya existe</span>}</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
        </div>
        <div className="form-group full">
          <label>Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} />
        </div>
        <label className="form-group full" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" style={{ width: 18, height: 18 }} checked={activo} onChange={e => setActivo(e.target.checked)} />
          <span style={{ fontSize: 12 }}>Activo (aparece en dropdowns; desactivar para ocultarlo sin borrar histórico)</span>
        </label>
      </div>
    </Modal>
  );
}

// ============================================================
// CRUD especial de Clientes — incluye país, capacidad mensual, contacto.
// ============================================================
function ClientesAdmin({ store }: { store: Store }) {
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [openNew, setOpenNew] = useState(false);

  // Cuántos servicios activos tiene cada cliente
  const conteoServicios = useMemo(() => {
    const map = new Map<string, { activos: number; total: number }>();
    store.servicios.forEach(s => {
      const cur = map.get(s.cliente) || { activos: 0, total: 0 };
      cur.total += 1;
      if (s.estado !== 'Cerrado') cur.activos += 1;
      map.set(s.cliente, cur);
    });
    return map;
  }, [store.servicios]);

  const clientesOrden = [...store.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre));

  const eliminar = (c: Cliente) => {
    const u = conteoServicios.get(c.nombre)?.total || 0;
    if (u > 0) {
      alert(`"${c.nombre}" tiene ${u} servicio${u === 1 ? '' : 's'} asociado${u === 1 ? '' : 's'}. Editá o cerrá esos servicios primero.`);
      return;
    }
    if (!confirm(`¿Eliminar el cliente "${c.nombre}"?`)) return;
    store.deleteCliente(c.id);
    showToast('Cliente eliminado');
  };

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div className="panel-title" style={{ margin: 0 }}>Clientes · {store.clientes.length}</div>
        <button className="btn btn-sm btn-primary" onClick={() => setOpenNew(true)}>+ Nuevo cliente</button>
      </div>
      <table>
        <thead>
          <tr>
            <th style={{ width: '18%' }}>Cliente</th>
            <th style={{ width: '6%' }}>País</th>
            <th style={{ width: '10%' }}>Cap. mensual</th>
            <th style={{ width: '18%' }}>Contacto</th>
            <th>Email / Tel</th>
            <th style={{ width: '8%' }}>Servicios</th>
            <th style={{ width: '14%' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {clientesOrden.length === 0 && <tr><td colSpan={7} className="empty-state">Sin clientes cargados.</td></tr>}
          {clientesOrden.map(c => {
            const conteo = conteoServicios.get(c.nombre);
            const cap = c.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT;
            return (
              <tr key={c.id}>
                <td><strong>{c.nombre}</strong></td>
                <td><span className="badge arg">{c.pais}</span></td>
                <td className="mono">
                  {cap} <small style={{ color: 'var(--gray-mute)' }}>hs/mes</small>
                  {cap !== CAPACIDAD_MENSUAL_DEFAULT && <span style={{ fontSize: 10, color: 'var(--orange)', fontWeight: 600, marginLeft: 4 }}>·custom</span>}
                </td>
                <td>{c.contactoNombre || <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                <td style={{ fontSize: 11 }}>
                  {c.contactoEmail && <div>{c.contactoEmail}</div>}
                  {c.contactoTelefono && <div style={{ color: 'var(--gray-mute)' }}>{c.contactoTelefono}</div>}
                  {!c.contactoEmail && !c.contactoTelefono && <span style={{ color: 'var(--gray-mute)' }}>—</span>}
                </td>
                <td>
                  {conteo
                    ? <span className="mono">{conteo.activos}/{conteo.total}</span>
                    : <span style={{ color: 'var(--gray-mute)' }}>0</span>}
                </td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => setEditando(c)} style={{ marginRight: 4 }}>✏</button>
                  <button className="btn btn-sm btn-danger" onClick={() => eliminar(c)}>×</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {(openNew || editando) && (
        <ClienteForm
          inicial={editando}
          existentes={store.clientes}
          onClose={() => { setOpenNew(false); setEditando(null); }}
          onSave={c => {
            store.upsertCliente(c);
            showToast(editando ? 'Cliente actualizado' : 'Cliente creado');
            setOpenNew(false); setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function ClienteForm({
  inicial, existentes, onClose, onSave,
}: {
  inicial: Cliente | null; existentes: Cliente[];
  onClose: () => void; onSave: (c: Cliente) => void;
}) {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [pais, setPais] = useState<Pais>(inicial?.pais || 'AR');
  const [capacidad, setCapacidad] = useState<string>(String(inicial?.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT));
  const [contactoNombre, setContactoNombre] = useState(inicial?.contactoNombre || '');
  const [contactoEmail, setContactoEmail] = useState(inicial?.contactoEmail || '');
  const [contactoTelefono, setContactoTelefono] = useState(inicial?.contactoTelefono || '');
  const [observaciones, setObservaciones] = useState(inicial?.observaciones || '');

  const duplicado = nombre.trim() && existentes.some(x => x.id !== inicial?.id && x.nombre.toLowerCase() === nombre.trim().toLowerCase());

  const guardar = () => {
    if (!nombre.trim()) return showToast('Falta el nombre');
    if (duplicado) return showToast(`Ya existe el cliente "${nombre.trim()}"`);
    const cap = Number(capacidad);
    onSave({
      id: inicial?.id ?? Date.now(),
      nombre: nombre.trim(),
      pais,
      capacidadMensual: cap > 0 && cap !== CAPACIDAD_MENSUAL_DEFAULT ? cap : undefined,
      contactoNombre: contactoNombre.trim() || undefined,
      contactoEmail: contactoEmail.trim() || undefined,
      contactoTelefono: contactoTelefono.trim() || undefined,
      observaciones: observaciones.trim() || undefined,
      activo: inicial?.activo ?? true,
    });
  };

  return (
    <Modal open title={inicial ? `Editar Cliente — ${inicial.nombre}` : 'Nuevo Cliente'} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar} disabled={!nombre.trim() || !!duplicado}>Guardar</button>
      </>}>
      <div className="form-grid">
        <div className="form-section-title">Información general</div>
        <div className="form-group">
          <label>Nombre {duplicado && <span style={{ color: 'var(--red)', fontSize: 11, marginLeft: 6 }}>· ya existe</span>}</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label>País</label>
          <select value={pais} onChange={e => setPais(e.target.value as Pais)}>
            <option>AR</option><option>PE</option><option>CH</option><option>MX</option><option>OTROS</option>
          </select>
        </div>
        <div className="form-group">
          <label>Capacidad mensual (hs)</label>
          <input type="number" min={1} value={capacidad} onChange={e => setCapacidad(e.target.value)} />
          <div style={{ fontSize: 10, color: 'var(--gray-mute)', marginTop: 4 }}>Default: {CAPACIDAD_MENSUAL_DEFAULT} hs/mes</div>
        </div>

        <div className="form-section-title">Contacto principal</div>
        <div className="form-group"><label>Nombre del contacto</label>
          <input value={contactoNombre} onChange={e => setContactoNombre(e.target.value)} />
        </div>
        <div className="form-group"><label>Email</label>
          <input type="email" value={contactoEmail} onChange={e => setContactoEmail(e.target.value)} />
        </div>
        <div className="form-group"><label>Teléfono</label>
          <input value={contactoTelefono} onChange={e => setContactoTelefono(e.target.value)} />
        </div>

        <div className="form-group full"><label>Observaciones</label>
          <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} />
        </div>
      </div>
    </Modal>
  );
}

import { useState, type ReactNode } from 'react';
import { Logo } from '../components/Logo';
import { ROLES_LABEL, type Rol, type UsuarioSesion } from '../types';
import { loadSesion, saveSesion } from '../data/storage';

interface Props { children: (s: UsuarioSesion, logout: () => void) => ReactNode; }

export function LoginGate({ children }: Props) {
  const [sesion, setSesion] = useState<UsuarioSesion | null>(() => loadSesion());
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('GerenciaServicios');

  if (sesion) {
    return <>{children(sesion, () => { saveSesion(null); setSesion(null); })}</>;
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Logo />
          <span style={{ fontWeight: 800, fontSize: 18, letterSpacing: '.5px' }}>EXISOFT</span>
        </div>
        <h2>Tablero de <span className="accent">Control</span></h2>
        <p>Acceso al control centralizado de servicios.</p>
        <div className="form-group">
          <label>Nombre y apellido</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Florencia de San Félix" autoFocus />
        </div>
        <div className="form-group">
          <label>Rol</label>
          <select value={rol} onChange={e => setRol(e.target.value as Rol)}>
            {(Object.keys(ROLES_LABEL) as Rol[]).map(r => (
              <option key={r} value={r}>{ROLES_LABEL[r]}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          onClick={() => {
            if (!nombre.trim()) return;
            const u = { nombre: nombre.trim(), rol };
            saveSesion(u);
            setSesion(u);
          }}>
          Ingresar
        </button>
        <p style={{ marginTop: 16, fontSize: 11, textAlign: 'center' }}>
          Prototipo — login mock. En producción se integra con SSO de Exisoft.
        </p>
      </div>
    </div>
  );
}

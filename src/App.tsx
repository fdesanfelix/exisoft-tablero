import { useEffect, useState } from 'react';
import { Logo } from './components/Logo';
import { ToastHost } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginGate } from './auth/LoginGate';
import { useStore } from './data/storage';
import { ROLES_LABEL, type Rol } from './types';
import { ServiciosView } from './views/ServiciosView';
import { CertificacionesView } from './views/CertificacionesView';
import { RecursosView } from './views/RecursosView';
import { ClientesView } from './views/ClientesView';
import { AvancesView } from './views/AvancesView';
import { AlertasView } from './views/AlertasView';
import { DireccionView } from './views/DireccionView';
import { AdminView } from './views/AdminView';

// Agrupamos las tabs por intención: Gestión (Dirección + Certificaciones) /
// Operativo (Servicios + Gestión de Proyectos + Alertas) / Maestros (Recursos + Clientes + Admin).
type ViewId = 'direccion' | 'certificaciones' | 'servicios' | 'avances' | 'alertas' | 'recursos' | 'clientes' | 'admin';
const TABS: { id: ViewId; label: string; grupo: 'gestion' | 'operativo' | 'maestros'; soloGerenciaDir?: boolean; ocultaParaPM?: boolean }[] = [
  // GESTIÓN
  { id: 'direccion', label: 'Dirección', grupo: 'gestion' },
  // Certificaciones es vista de Gerencia/Director + Comercial (lectura).
  // El PM certifica solo los hitos de SUS proyectos desde Gestión de Proyectos.
  { id: 'certificaciones', label: 'Certificaciones', grupo: 'gestion', ocultaParaPM: true },
  // OPERATIVO
  { id: 'servicios', label: 'Servicios', grupo: 'operativo' },
  { id: 'avances', label: 'Gestión de Proyectos', grupo: 'operativo' },
  { id: 'alertas', label: 'Alertas', grupo: 'operativo' },
  // MAESTROS
  { id: 'recursos', label: 'Recursos', grupo: 'maestros' },
  { id: 'clientes', label: 'Clientes', grupo: 'maestros' },
  { id: 'admin', label: 'Admin', grupo: 'maestros', soloGerenciaDir: true },
];

export default function App() {
  return (
    <ErrorBoundary>
      <LoginGate>
        {(sesion, logout) => <Shell rol={sesion.rol} nombre={sesion.nombre} onLogout={logout} />}
      </LoginGate>
    </ErrorBoundary>
  );
}

function Shell({ rol, nombre, onLogout }: { rol: Rol; nombre: string; onLogout: () => void }) {
  const [view, setView] = useState<ViewId>('direccion');
  // Deep-link entrante a Avances: cuando se setea, la vista cambia y AvancesView lo consume.
  const [avanceServicioId, setAvanceServicioId] = useState<number | null>(null);
  const store = useStore();

  // Navega a Avances en el detalle del servicio dado. Usado desde la ficha de servicio.
  const goToAvanceProyecto = (servicioId: number) => {
    setAvanceServicioId(servicioId);
    setView('avances');
  };

  // Filtrado por rol:
  //   - Admin: solo Gerencia/Director (tabla de soporte, sensible)
  //   - Certificaciones: oculto para PM (certifica solo desde su proyecto)
  const esGerenciaODirector = rol === 'GerenciaServicios' || rol === 'DirectorServicios';
  const esPM = rol === 'PM';
  const tabsVisibles = TABS.filter(t => {
    if (t.soloGerenciaDir && !esGerenciaODirector) return false;
    if (t.ocultaParaPM && esPM) return false;
    return true;
  });
  // Si el state actual cayó en un tab no visible para este rol (ej. cambio de sesión),
  // lo movemos al primero disponible para no dejar la vista en blanco.
  useEffect(() => {
    if (!tabsVisibles.some(t => t.id === view)) {
      setView(tabsVisibles[0]?.id ?? 'direccion');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, rol]);

  // Insertamos un separador entre grupos para que la barra de tabs muestre los bloques
  // visualmente (Gestión · Operativo · Maestros) sin agregar otra fila de UI.
  const tabsConSep: (typeof TABS[number] | { sep: true })[] = [];
  tabsVisibles.forEach((t, i) => {
    if (i > 0 && tabsVisibles[i - 1].grupo !== t.grupo) tabsConSep.push({ sep: true });
    tabsConSep.push(t);
  });

  return (
    <>
      <header className="header">
        <div className="logo"><Logo /><span className="logo-word">EXISOFT</span></div>
        <span className="header-tag">{ROLES_LABEL[rol]}</span>
        <span className="header-spacer" />
        <nav className="nav-tabs">
          {tabsConSep.map((t, i) => (
            'sep' in t
              ? <span key={`sep-${i}`} className="nav-tab-sep" aria-hidden />
              : (
                <button key={t.id}
                  className={`nav-tab ${view === t.id ? 'active' : ''}`}
                  onClick={() => setView(t.id)}>
                  {t.label}
                </button>
              )
          ))}
        </nav>
        <div className="user-chip">
          <strong>{nombre}</strong>
          <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'var(--gray-mute)', cursor: 'pointer', fontSize: 12 }} title="Cerrar sesión">↩</button>
        </div>
      </header>

      <main className="container">
        <ErrorBoundary>
          {view === 'direccion' && <DireccionView store={store} />}
          {view === 'certificaciones' && <CertificacionesView store={store} usuario={nombre} />}
          {view === 'servicios' && <ServiciosView store={store} rol={rol} usuario={nombre} onGoToAvances={goToAvanceProyecto} />}
          {view === 'avances' && (
            <AvancesView store={store} usuario={nombre} rol={rol}
              initialServicioId={avanceServicioId}
              onConsumedInitial={() => setAvanceServicioId(null)} />
          )}
          {view === 'alertas' && <AlertasView store={store} />}
          {view === 'recursos' && <RecursosView store={store} rol={rol} />}
          {view === 'clientes' && <ClientesView store={store} />}
          {view === 'admin' && esGerenciaODirector && <AdminView store={store} />}
        </ErrorBoundary>
      </main>

      <ToastHost />
    </>
  );
}

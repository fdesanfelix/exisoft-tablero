import { useMemo, useState } from 'react';
import type { useStore } from '../data/storage';
import { KPI } from '../components/KPI';
import { Modal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { SortableTh, useSort } from '../components/Sort';
import {
  ANIO_ACTUAL, ddmmaaaa, equipoDe, HOY, MESES, MES_ACTUAL, nombreCompleto, parseDate,
  type CertificacionMeta, type HitoServicio, type Servicio,
} from '../types';

type Store = ReturnType<typeof useStore>;
type Tab = 'mes' | 'pendientes' | 'historico';

// Una "fila de certificación" — unifica mensuales e hitos en un modelo común para la UI.
interface CertItem {
  key: string;
  servicio: Servicio;
  cliente: string;
  pais: string;
  tipo: 'Mensual' | 'Hito';
  concepto: string;          // "Mayo 2026" | "Hito 2: UAT"
  mes?: number;              // si Mensual
  anio?: number;             // si Mensual
  hito?: HitoServicio;       // si Hito
  fechaPlan: Date | null;    // fecha planificada / estimada
  fechaReal?: Date | null;   // fecha real (si certificado)
  horasEstim: number | null; // horas que correspondería certificar
  horasReal?: number | null; // horas efectivamente certificadas
  certificado: boolean;      // ya tiene OK definitivo
  vencido: boolean;          // pasó la fecha y aún no se certificó
  comentario?: string;
  autorCert?: string;
}

// Helper: horas estimadas por mes para un servicio mensual.
function hsMensual(s: Servicio): number | null {
  const inicio = parseDate(s.inicio);
  const fin = parseDate(s.fin);
  if (s.horasCont != null && inicio && fin && fin > inicio) {
    const meses = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / (30 * 86400000)));
    return Math.round((s.horasCont / meses) * 10) / 10;
  }
  if (s.horasCont != null) return Math.round((s.horasCont / 12) * 10) / 10;
  return null;
}

export function CertificacionesView({ store, usuario }: { store: Store; usuario: string }) {
  const [tab, setTab] = useState<Tab>('mes');
  const [filtroCliente, setFiltroCliente] = useState<string>('all');
  const [filtroPais, setFiltroPais] = useState<string>('all');
  const [aCertificar, setACertificar] = useState<CertItem | null>(null);

  // ── Construye TODOS los items de certificación, marcando estado y fecha ──
  const items = useMemo<CertItem[]>(() => {
    const out: CertItem[] = [];
    store.servicios.forEach(s => {
      if (s.modoCertificacion === 'NoCertifica') return;
      if (s.estado === 'Cerrado') return; // los cerrados van al historial puro, los manejaremos aparte

      // ── Mensuales: una fila por mes del año actual ──
      if (s.modoCertificacion === 'Mensual') {
        const inicioSrv = parseDate(s.inicio);
        const finSrv = parseDate(s.fin);
        const desdeMes = inicioSrv && inicioSrv.getFullYear() === ANIO_ACTUAL ? inicioSrv.getMonth() + 1 : 1;
        const hastaMes = finSrv && finSrv.getFullYear() === ANIO_ACTUAL ? finSrv.getMonth() + 1 : 12;
        const hsEstim = hsMensual(s);
        for (let m = desdeMes; m <= hastaMes; m++) {
          const estado = s.certificaciones?.[m] || 'Pendiente';
          const meta = s.certificacionesMeta?.[m];
          const finMes = new Date(ANIO_ACTUAL, m, 0); // último día del mes
          out.push({
            key: `m-${s.id}-${m}`,
            servicio: s, cliente: s.cliente, pais: s.pais,
            tipo: 'Mensual',
            concepto: `${MESES[m - 1]} ${ANIO_ACTUAL}`,
            mes: m, anio: ANIO_ACTUAL,
            fechaPlan: finMes,
            fechaReal: meta?.fecha ? parseDate(meta.fecha) : null,
            horasEstim: hsEstim,
            horasReal: meta?.horas,
            certificado: estado === 'Ok',
            vencido: estado !== 'Ok' && finMes < HOY,
            comentario: meta?.comentario,
            autorCert: meta?.autor,
          });
        }
      }

      // ── Hitos: una fila por hito del servicio ──
      if (s.modoCertificacion === 'Hitos') {
        s.hitos.forEach(h => {
          const f = parseDate(h.fechaCert);
          out.push({
            key: `h-${s.id}-${h.id}`,
            servicio: s, cliente: s.cliente, pais: s.pais,
            tipo: 'Hito',
            concepto: h.nombre,
            hito: h,
            fechaPlan: f,
            fechaReal: h.fechaCertReal ? parseDate(h.fechaCertReal) : null,
            horasEstim: h.horas ?? null,
            horasReal: h.horasCertReal,
            certificado: !!h.cumplido,
            vencido: !h.cumplido && !!f && f < HOY,
            comentario: h.comentarioCert,
            autorCert: h.autorCert,
          });
        });
      }
    });
    return out;
  }, [store.servicios]);

  // ── Filtros: cliente / país ──
  const clientesDisponibles = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => set.add(i.cliente));
    return Array.from(set).sort();
  }, [items]);

  const itemsFiltrados = useMemo(() => items.filter(i => {
    if (filtroCliente !== 'all' && i.cliente !== filtroCliente) return false;
    if (filtroPais !== 'all' && i.pais !== filtroPais) return false;
    return true;
  }), [items, filtroCliente, filtroPais]);

  // ── Particiones por solapa ──
  const delMes = useMemo(() => itemsFiltrados.filter(i => {
    if (i.tipo === 'Mensual') return i.mes === MES_ACTUAL && i.anio === ANIO_ACTUAL;
    // Hito: fechaPlan cae en el mes actual
    return i.fechaPlan && i.fechaPlan.getMonth() + 1 === MES_ACTUAL && i.fechaPlan.getFullYear() === ANIO_ACTUAL;
  }), [itemsFiltrados]);

  const pendientesAnteriores = useMemo(() => itemsFiltrados.filter(i => {
    if (i.certificado) return false;
    if (!i.fechaPlan) return false;
    // Anterior al mes actual y vencido
    const esDelMesActual = i.fechaPlan.getMonth() + 1 === MES_ACTUAL && i.fechaPlan.getFullYear() === ANIO_ACTUAL;
    return i.vencido && !esDelMesActual;
  }), [itemsFiltrados]);

  const historico = useMemo(() => itemsFiltrados.filter(i => i.certificado), [itemsFiltrados]);

  // ── KPIs (siempre del mes actual) ──
  const k = useMemo(() => {
    const certificadasMes = delMes.filter(i => i.certificado).length;
    const aCertMes = delMes.filter(i => !i.certificado).length;
    const hsAcert = delMes.filter(i => !i.certificado).reduce((a, i) => a + (i.horasEstim || 0), 0);
    const hsCertOk = delMes.filter(i => i.certificado).reduce((a, i) => a + (i.horasReal || i.horasEstim || 0), 0);
    return {
      aCertMes, certificadasMes,
      vencidasTotal: pendientesAnteriores.length,
      hsAcert: Math.round(hsAcert * 10) / 10,
      hsCertOk: Math.round(hsCertOk * 10) / 10,
    };
  }, [delMes, pendientesAnteriores]);

  // ── Acciones ──
  const certificar = (item: CertItem, datos: { fecha: string; horas: number; comentario: string; autor: string }) => {
    const s = item.servicio;
    if (item.tipo === 'Mensual' && item.mes) {
      const nuevasCerts = { ...(s.certificaciones || {}), [item.mes]: 'Ok' as const };
      const nuevoMeta: CertificacionMeta = {
        fecha: datos.fecha, horas: datos.horas, comentario: datos.comentario,
        autor: datos.autor, anio: item.anio || ANIO_ACTUAL,
      };
      const nuevasCertsMeta = { ...(s.certificacionesMeta || {}), [item.mes]: nuevoMeta };
      store.upsertServicio({ ...s, certificaciones: nuevasCerts, certificacionesMeta: nuevasCertsMeta });
      showToast(`✓ ${s.nombre} · ${MESES[item.mes - 1]} certificado`);
    } else if (item.tipo === 'Hito' && item.hito) {
      const nuevosHitos = s.hitos.map(h => h.id === item.hito!.id ? {
        ...h, cumplido: true, fechaCertReal: datos.fecha, horasCertReal: datos.horas,
        comentarioCert: datos.comentario, autorCert: datos.autor,
      } : h);
      store.upsertServicio({ ...s, hitos: nuevosHitos });
      showToast(`✓ ${s.nombre} · ${item.hito.nombre} certificado`);
    }
    setACertificar(null);
  };

  const revertir = (item: CertItem) => {
    if (!confirm('¿Deshacer la certificación? Volverá a estar pendiente.')) return;
    const s = item.servicio;
    if (item.tipo === 'Mensual' && item.mes) {
      const nuevasCerts = { ...(s.certificaciones || {}), [item.mes]: 'Pendiente' as const };
      const meta = { ...(s.certificacionesMeta || {}) };
      delete meta[item.mes];
      store.upsertServicio({ ...s, certificaciones: nuevasCerts, certificacionesMeta: meta });
      showToast('Certificación deshecha');
    } else if (item.tipo === 'Hito' && item.hito) {
      const nuevosHitos = s.hitos.map(h => h.id === item.hito!.id ? {
        ...h, cumplido: false, fechaCertReal: undefined, horasCertReal: undefined,
        comentarioCert: undefined, autorCert: undefined,
      } : h);
      store.upsertServicio({ ...s, hitos: nuevosHitos });
      showToast('Certificación deshecha');
    }
  };

  const visible = tab === 'mes' ? delMes : pendientesAnteriores;

  return (
    <>
      <div className="view-hero">
        <h1>Certificaciones de <span className="accent">{MESES[MES_ACTUAL - 1]} {ANIO_ACTUAL}</span></h1>
        <p>To-do del mes — qué falta certificar, qué quedó pendiente de meses anteriores, y todo lo ya cerrado</p>
      </div>

      <div className="kpi-grid">
        <KPI label="A certificar este mes" value={k.aCertMes} meta={`${k.hsAcert} hs estimadas`} variant="at" />
        <KPI label="Certificadas este mes" value={k.certificadasMes} meta={`${k.hsCertOk} hs registradas`} variant="on" />
        <KPI label="Vencidas anteriores" value={k.vencidasTotal} meta="sin certificar" variant="off" />
        <KPI label="Histórico OK (año)" value={historico.length} meta="acumulado" variant="hours" />
      </div>

      {/* Filtros mínimos */}
      <div className="svc-toolbar">
        <select className="svc-select" value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}>
          <option value="all">Todos los clientes</option>
          {clientesDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="svc-select" value={filtroPais} onChange={e => setFiltroPais(e.target.value)}>
          <option value="all">Todos los países</option>
          <option value="PE">PE</option>
          <option value="AR">AR</option>
          <option value="CH">CH</option>
          <option value="MX">MX</option>
          <option value="OTROS">OTROS</option>
        </select>
      </div>

      {/* Solapas */}
      <div className="cert-tabs">
        <button className={`cert-tab ${tab === 'mes' ? 'active' : ''}`} onClick={() => setTab('mes')}>
          Del mes <span className="cert-tab-count">{delMes.length}</span>
        </button>
        <button className={`cert-tab ${tab === 'pendientes' ? 'active' : ''}`} onClick={() => setTab('pendientes')}>
          Pendientes anteriores <span className="cert-tab-count cert-tab-count-warn">{pendientesAnteriores.length}</span>
        </button>
        <button className={`cert-tab ${tab === 'historico' ? 'active' : ''}`} onClick={() => setTab('historico')}>
          Histórico <span className="cert-tab-count">{historico.length}</span>
        </button>
      </div>

      {tab !== 'historico' ? (
        <CertificacionesTabla items={visible} mostrarReal={false}
          onCertificar={setACertificar} onRevertir={revertir} />
      ) : (
        <HistoricoCalendario store={store} filtroCliente={filtroCliente} filtroPais={filtroPais}
          onRevertir={revertir} onCertificar={setACertificar} />
      )}

      {aCertificar && (
        <CertificarModal item={aCertificar} usuario={usuario} store={store}
          onClose={() => setACertificar(null)} onSave={d => certificar(aCertificar, d)} />
      )}
    </>
  );
}

// ============================================================
// Tabla de certificaciones — adapta columnas según solapa
// ============================================================
function CertificacionesTabla({
  items, mostrarReal, onCertificar, onRevertir,
}: {
  items: CertItem[]; mostrarReal: boolean;
  onCertificar: (item: CertItem) => void; onRevertir: (item: CertItem) => void;
}) {
  type K = 'cliente' | 'servicio' | 'tipo' | 'concepto' | 'fechaPlan' | 'horas';
  const { sorted, sort } = useSort<CertItem, K>(items, (i, k) => {
    if (k === 'servicio') return i.servicio.nombre;
    if (k === 'fechaPlan') return i.fechaPlan ? i.fechaPlan.getTime() : null;
    if (k === 'horas') return i.horasEstim ?? 0;
    return (i as any)[k];
  }, mostrarReal ? 'fechaPlan' : 'fechaPlan', mostrarReal ? 'desc' : 'asc');

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <table>
        <thead>
          <tr>
            <SortableTh field="cliente" sort={sort} style={{ width: '14%' }}>Cliente</SortableTh>
            <SortableTh field="servicio" sort={sort} style={{ width: '24%' }}>Servicio</SortableTh>
            <SortableTh field="tipo" sort={sort} style={{ width: '7%' }}>Tipo</SortableTh>
            <SortableTh field="concepto" sort={sort} style={{ width: '15%' }}>Concepto</SortableTh>
            <SortableTh field="fechaPlan" sort={sort} style={{ width: '10%' }}>{mostrarReal ? 'Certif. real' : 'Vence'}</SortableTh>
            <SortableTh field="horas" sort={sort} style={{ width: '10%' }}>Horas</SortableTh>
            <th style={{ width: '8%' }}>OC</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="empty-state">
              {mostrarReal ? 'Aún no hay certificaciones registradas.' : 'No hay certificaciones para este filtro.'}
            </td></tr>
          )}
          {sorted.map(i => {
            const fechaMostrar = mostrarReal ? i.fechaReal : i.fechaPlan;
            return (
              <tr key={i.key} className={i.vencido ? 'cert-row-vencido' : i.certificado ? 'cert-row-ok' : ''}>
                <td><strong>{i.cliente}</strong></td>
                <td>{i.servicio.nombre}</td>
                <td><span className={`badge ${i.tipo === 'Hito' ? 'llave' : 'soporte'}`}>{i.tipo}</span></td>
                <td>{i.concepto}</td>
                <td className="mono">{fechaMostrar ? ddmmaaaa(fechaMostrar) : '—'}</td>
                <td className="mono">
                  {mostrarReal && i.horasReal != null
                    ? <>{i.horasReal}{i.horasEstim != null && i.horasReal !== i.horasEstim && (
                        <small style={{ color: 'var(--gray-mute)', marginLeft: 4 }}>(est. {i.horasEstim})</small>)}</>
                    : i.horasEstim != null ? <>{i.horasEstim}</> : '—'}
                </td>
                <td>{i.servicio.tieneOC === true ? <span className="pill ok">Con OC</span>
                  : i.servicio.tieneOC === false ? <span className="pill venc">Sin OC</span>
                  : <span style={{ color: 'var(--gray-mute)' }}>—</span>}</td>
                <td>
                  {i.certificado ? (
                    <div className="cert-done">
                      <span className="cert-done-check" title={`Certificado por ${i.autorCert || '—'}${i.fechaReal ? ` el ${ddmmaaaa(i.fechaReal)}` : ''}${i.comentario ? ` · ${i.comentario}` : ''}`}>✓</span>
                      <button className="cert-undo-btn" onClick={() => onRevertir(i)} title="Deshacer certificación" aria-label="Deshacer">↺</button>
                    </div>
                  ) : (
                    <button className="btn btn-sm btn-primary" onClick={() => onCertificar(i)}>Certificar</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// Histórico — calendario por año navegable.
// Una fila por servicio (mensuales + sus hitos), 12 columnas (Ene..Dic).
// Cada celda muestra estado: ✓ Ok / blank / × Pendiente / ! Vencido / — NoAplica.
// Click en una celda con estado certificado abre tooltip con detalles.
// ============================================================
function HistoricoCalendario({
  store, filtroCliente, filtroPais, onRevertir, onCertificar,
}: {
  store: Store; filtroCliente: string; filtroPais: string;
  onRevertir: (item: CertItem) => void; onCertificar: (item: CertItem) => void;
}) {
  const [anio, setAnio] = useState(ANIO_ACTUAL);

  // Años disponibles: tomar todos los años entre el más antiguo y el actual + 1.
  const aniosDisponibles = useMemo(() => {
    let min = ANIO_ACTUAL, max = ANIO_ACTUAL;
    store.servicios.forEach(s => {
      const ini = parseDate(s.inicio); const fin = parseDate(s.fin);
      if (ini) { min = Math.min(min, ini.getFullYear()); max = Math.max(max, ini.getFullYear()); }
      if (fin) { min = Math.min(min, fin.getFullYear()); max = Math.max(max, fin.getFullYear()); }
      Object.values(s.certificacionesMeta || {}).forEach(m => max = Math.max(max, m.anio));
      s.hitos.forEach(h => {
        const f = parseDate(h.fechaCert);
        if (f) { min = Math.min(min, f.getFullYear()); max = Math.max(max, f.getFullYear()); }
      });
    });
    const out: number[] = [];
    for (let y = min; y <= Math.max(max, ANIO_ACTUAL); y++) out.push(y);
    return out;
  }, [store.servicios]);

  // Servicios mensuales filtrados (con celdas en el año)
  const filasMensuales = useMemo(() => {
    return store.servicios
      .filter(s => s.modoCertificacion === 'Mensual')
      .filter(s => filtroCliente === 'all' || s.cliente === filtroCliente)
      .filter(s => filtroPais === 'all' || s.pais === filtroPais)
      .map(s => {
        const inicioSrv = parseDate(s.inicio);
        const finSrv = parseDate(s.fin);
        const desdeMes = inicioSrv && inicioSrv.getFullYear() <= anio ? (inicioSrv.getFullYear() < anio ? 1 : inicioSrv.getMonth() + 1) : (inicioSrv && inicioSrv.getFullYear() > anio ? 13 : 1);
        const hastaMes = finSrv && finSrv.getFullYear() >= anio ? (finSrv.getFullYear() > anio ? 12 : finSrv.getMonth() + 1) : (finSrv && finSrv.getFullYear() < anio ? 0 : 12);
        const meses = Array.from({ length: 12 }, (_, idx) => {
          const m = idx + 1;
          if (m < desdeMes || m > hastaMes) return { aplica: false };
          const meta = s.certificacionesMeta?.[m];
          const certificadoEnEsteAnio = meta && meta.anio === anio;
          // Para el año actual el estado del servicio.certificaciones[m] aplica directamente;
          // para años anteriores, sólo mostramos certificado si la meta del año coincide.
          let estado: 'Ok' | 'Pendiente' | 'Vencido' | 'Proyectado' = 'Pendiente';
          if (anio === ANIO_ACTUAL) {
            const e = s.certificaciones?.[m];
            if (e === 'Ok') estado = 'Ok';
            else if (e === 'Vencido') estado = 'Vencido';
            else if (e === 'Proyectado') estado = 'Proyectado';
            else estado = 'Pendiente';
            // Forzar vencido si el mes ya pasó y no está OK
            const finMes = new Date(anio, m, 0);
            if (estado !== 'Ok' && finMes < HOY) estado = 'Vencido';
          } else if (anio < ANIO_ACTUAL) {
            estado = certificadoEnEsteAnio ? 'Ok' : 'Vencido';
          } else {
            estado = 'Proyectado';
          }
          return { aplica: true, estado, meta: certificadoEnEsteAnio ? meta : undefined, mes: m };
        });
        return { servicio: s, meses };
      });
  }, [store.servicios, anio, filtroCliente, filtroPais]);

  // Hitos del año (lista debajo del calendario)
  const hitosDelAnio = useMemo(() => {
    const out: { servicio: Servicio; hito: HitoServicio; fecha: Date }[] = [];
    store.servicios
      .filter(s => filtroCliente === 'all' || s.cliente === filtroCliente)
      .filter(s => filtroPais === 'all' || s.pais === filtroPais)
      .forEach(s => s.hitos.forEach(h => {
        const f = parseDate(h.fechaCertReal || h.fechaCert);
        if (!f) return;
        if (f.getFullYear() !== anio) return;
        out.push({ servicio: s, hito: h, fecha: f });
      }));
    return out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  }, [store.servicios, anio, filtroCliente, filtroPais]);

  const idxAnio = aniosDisponibles.indexOf(anio);
  const irAnterior = () => { if (idxAnio > 0) setAnio(aniosDisponibles[idxAnio - 1]); };
  const irSiguiente = () => { if (idxAnio < aniosDisponibles.length - 1) setAnio(aniosDisponibles[idxAnio + 1]); };

  // Convierte celda en CertItem para revertir / certificar
  const cellToItem = (s: Servicio, m: number, meta?: CertificacionMeta): CertItem => ({
    key: `m-${s.id}-${m}`, servicio: s, cliente: s.cliente, pais: s.pais,
    tipo: 'Mensual', concepto: `${MESES[m - 1]} ${anio}`, mes: m, anio,
    fechaPlan: new Date(anio, m, 0),
    fechaReal: meta?.fecha ? parseDate(meta.fecha) : null,
    horasEstim: hsMensual(s), horasReal: meta?.horas,
    certificado: !!meta, vencido: false, comentario: meta?.comentario, autorCert: meta?.autor,
  });
  const hitoToItem = (s: Servicio, h: HitoServicio): CertItem => ({
    key: `h-${s.id}-${h.id}`, servicio: s, cliente: s.cliente, pais: s.pais,
    tipo: 'Hito', concepto: h.nombre, hito: h,
    fechaPlan: parseDate(h.fechaCert),
    fechaReal: h.fechaCertReal ? parseDate(h.fechaCertReal) : null,
    horasEstim: h.horas ?? null, horasReal: h.horasCertReal,
    certificado: !!h.cumplido, vencido: false,
    comentario: h.comentarioCert, autorCert: h.autorCert,
  });

  return (
    <>
      {/* Navegador de año */}
      <div className="cert-year-nav">
        <button className="cert-year-btn" onClick={irAnterior} disabled={idxAnio <= 0} aria-label="Año anterior">←</button>
        <div className="cert-year-pills">
          {aniosDisponibles.map(y => (
            <button key={y} className={`cert-year-pill ${y === anio ? 'active' : ''}`} onClick={() => setAnio(y)}>{y}</button>
          ))}
        </div>
        <button className="cert-year-btn" onClick={irSiguiente} disabled={idxAnio >= aniosDisponibles.length - 1} aria-label="Año siguiente">→</button>
      </div>

      {/* Calendario mensual */}
      <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="cert-cal">
          <thead>
            <tr>
              <th style={{ width: '14%', textAlign: 'left', paddingLeft: 14 }}>Cliente</th>
              <th style={{ width: '18%', textAlign: 'left' }}>Servicio</th>
              {MESES.map(m => <th key={m} className="cert-cal-mes-th">{m.slice(0, 3)}</th>)}
            </tr>
          </thead>
          <tbody>
            {filasMensuales.length === 0 && (
              <tr><td colSpan={14} className="empty-state">No hay servicios mensuales para el filtro actual en {anio}.</td></tr>
            )}
            {filasMensuales.map(({ servicio: s, meses }) => (
              <tr key={s.id}>
                <td><strong>{s.cliente}</strong></td>
                <td>{s.nombre}</td>
                {meses.map((c, i) => {
                  const m = i + 1;
                  if (!c.aplica) return <td key={m} className="cert-cal-cell na">—</td>;
                  if (c.estado === 'Ok' && c.meta) {
                    return (
                      <td key={m} className="cert-cal-cell ok"
                        title={`Certificado el ${c.meta.fecha}${c.meta.horas ? ` · ${c.meta.horas} hs` : ''}${c.meta.autor ? ` · ${c.meta.autor}` : ''}${c.meta.comentario ? `\n${c.meta.comentario}` : ''}`}
                        onClick={() => { if (confirm(`Deshacer certificación de ${s.nombre} · ${MESES[i]} ${anio}?`)) onRevertir(cellToItem(s, m, c.meta)); }}>
                        ✓
                      </td>
                    );
                  }
                  if (c.estado === 'Vencido' && anio === ANIO_ACTUAL) {
                    return (
                      <td key={m} className="cert-cal-cell venc" title="Vencido — click para certificar"
                        onClick={() => onCertificar(cellToItem(s, m))}>!</td>
                    );
                  }
                  if (c.estado === 'Pendiente' && anio === ANIO_ACTUAL) {
                    return (
                      <td key={m} className="cert-cal-cell pend" title="Pendiente — click para certificar"
                        onClick={() => onCertificar(cellToItem(s, m))}>·</td>
                    );
                  }
                  if (c.estado === 'Proyectado') {
                    return <td key={m} className="cert-cal-cell proy" title="Proyectado">○</td>;
                  }
                  return <td key={m} className="cert-cal-cell venc" title="No certificado">×</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="cert-cal-legend">
          <span><i className="cert-cal-cell ok" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 3 }}>✓</i> Certificado</span>
          <span><i className="cert-cal-cell venc" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 3 }}>!</i> Vencido / no certificado</span>
          <span><i className="cert-cal-cell pend" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 3 }}>·</i> Pendiente</span>
          <span><i className="cert-cal-cell proy" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 3 }}>○</i> Proyectado</span>
          <span><i className="cert-cal-cell na" style={{ display: 'inline-block', padding: '0 6px', borderRadius: 3 }}>—</i> No aplica</span>
        </div>
      </div>

      {/* Hitos del año */}
      {hitosDelAnio.length > 0 && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-title">Hitos certificados en {anio} · {hitosDelAnio.filter(x => x.hito.cumplido).length} de {hitosDelAnio.length}</div>
          <table>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Cliente</th>
                <th style={{ width: '24%' }}>Servicio</th>
                <th style={{ width: '20%' }}>Hito</th>
                <th style={{ width: '10%' }}>Fecha</th>
                <th style={{ width: '8%' }}>Horas</th>
                <th style={{ width: '8%' }}>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {hitosDelAnio.map(x => (
                <tr key={`${x.servicio.id}-${x.hito.id}`} className={x.hito.cumplido ? 'cert-row-ok' : ''}>
                  <td><strong>{x.servicio.cliente}</strong></td>
                  <td>{x.servicio.nombre}</td>
                  <td>{x.hito.nombre}</td>
                  <td className="mono">{ddmmaaaa(x.fecha)}</td>
                  <td className="mono">{x.hito.horasCertReal ?? x.hito.horas ?? '—'}</td>
                  <td>{x.hito.cumplido
                    ? <span className="pill ok">Cumplido</span>
                    : <span className="pill pend">Pendiente</span>}</td>
                  <td>
                    {x.hito.cumplido ? (
                      <div className="cert-done">
                        <span className="cert-done-check" title={`Certificado por ${x.hito.autorCert || '—'}${x.hito.comentarioCert ? ` · ${x.hito.comentarioCert}` : ''}`}>✓</span>
                        <button className="cert-undo-btn" onClick={() => onRevertir(hitoToItem(x.servicio, x.hito))} title="Deshacer certificación">↺</button>
                      </div>
                    ) : (
                      <button className="btn btn-sm btn-primary" onClick={() => onCertificar(hitoToItem(x.servicio, x.hito))}>Certificar</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ============================================================
// Mini-form de Certificar
// ============================================================
function CertificarModal({
  item, usuario, store, onClose, onSave,
}: {
  item: CertItem; usuario: string; store: Store;
  onClose: () => void; onSave: (d: { fecha: string; horas: number; comentario: string; autor: string }) => void;
}) {
  const [fecha, setFecha] = useState(ddmmaaaa(HOY));
  const [horas, setHoras] = useState<string>(item.horasEstim != null ? String(item.horasEstim) : '0');
  const [comentario, setComentario] = useState('');

  // Autor: priorizamos el usuario logueado si está en Recursos; sino primer PM del equipo; sino primer recurso.
  const equipoSrv = equipoDe(item.servicio.id, store.recursos, store.servicios, store.clientes);
  const usuarioEstaEnRecursos = store.recursos.some(r => nombreCompleto(r) === usuario);
  const defAutor = usuarioEstaEnRecursos
    ? usuario
    : equipoSrv.find(m => /PM/i.test(m.perfil))?.nombre
      ?? equipoSrv[0]?.nombre
      ?? (store.recursos[0] ? nombreCompleto(store.recursos[0]) : '');
  const [autor, setAutor] = useState(defAutor);

  const recursosOrden = useMemo(
    () => [...store.recursos].sort((a, b) => nombreCompleto(a).localeCompare(nombreCompleto(b))),
    [store.recursos],
  );
  const idsEquipo = new Set(equipoSrv.map(m => m.recursoId));

  const guardar = () => {
    const h = Number(horas) || 0;
    if (!fecha.trim()) { showToast('Falta la fecha de certificación'); return; }
    if (!autor) { showToast('Falta el autor'); return; }
    onSave({ fecha: fecha.trim(), horas: h, comentario: comentario.trim(), autor });
  };

  return (
    <Modal open title={`Certificar — ${item.cliente}`} onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn-primary" onClick={guardar}>Confirmar certificación</button>
      </>}>
      <div className="form-grid">
        <div className="form-group full">
          <label>Servicio</label>
          <div style={{ fontSize: 13, color: 'var(--gray-dark)', padding: '8px 10px', background: 'var(--gray-soft)', borderRadius: 6 }}>
            <strong>{item.servicio.nombre}</strong>
            <div style={{ fontSize: 11, color: 'var(--gray-mute)', marginTop: 2 }}>
              {item.tipo} · {item.concepto}{item.fechaPlan ? ` · estim. ${ddmmaaaa(item.fechaPlan)}` : ''}
            </div>
          </div>
        </div>
        <div className="form-group"><label>Fecha real de certificación</label>
          <input value={fecha} onChange={e => setFecha(e.target.value)} placeholder="dd/mm/aaaa" />
        </div>
        <div className="form-group"><label>Horas certificadas</label>
          <input type="number" step="0.1" value={horas} onChange={e => setHoras(e.target.value)} />
        </div>
        <div className="form-group full"><label>Autor (quién registra)</label>
          <select value={autor} onChange={e => setAutor(e.target.value)}>
            <option value="">— Seleccionar —</option>
            {equipoSrv.length > 0 && (
              <optgroup label="Equipo del servicio">
                {equipoSrv.map(m => <option key={`eq-${m.recursoId}`} value={m.nombre}>{m.nombre}{m.perfil ? ` · ${m.perfil}` : ''}</option>)}
              </optgroup>
            )}
            <optgroup label="Otros profesionales">
              {recursosOrden.filter(r => !idsEquipo.has(r.id)).map(r =>
                <option key={`ot-${r.id}`} value={nombreCompleto(r)}>{nombreCompleto(r)}</option>)}
            </optgroup>
          </select>
        </div>
        <div className="form-group full"><label>Comentario (opcional)</label>
          <textarea value={comentario} onChange={e => setComentario(e.target.value)}
            placeholder="Detalle relevante: cliente firmó, factura emitida, etc." rows={3} />
        </div>
      </div>
    </Modal>
  );
}

import { useMemo } from 'react';
import type { useStore } from '../data/storage';
import {
  cargaTotal, HOY, MESES, nombreCompleto, ultimoAvance,
  type EstadoAvance,
} from '../types';

type Store = ReturnType<typeof useStore>;

// ============================================================
// Vista "Dirección" — reporte ejecutivo para reunión de Dirección.
// Optimizada para proyectar: tipografía grande, contraste alto,
// narrativa autogenerada arriba, tres secciones grandes abajo.
// ============================================================
export function DireccionView({ store }: { store: Store }) {
  const data = useMemo(() => computar(store), [store.servicios, store.recursos, store.avances, store.clientes]); // eslint-disable-line react-hooks/exhaustive-deps

  const mes = MESES[HOY.getMonth()];
  const anio = HOY.getFullYear();

  return (
    <div className="direccion-view">
      {/* ─────────────── HEADLINE ─────────────── */}
      <div className="dir-hero">
        <div>
          <div className="dir-hero-eyebrow">Reporte de Servicios · {mes} {anio}</div>
          <h1 className="dir-hero-title">Estado del <span className="accent">Portafolio</span></h1>
          <p className="dir-hero-narrative">{data.narrativa}</p>
        </div>
        <div className="dir-hero-numbers">
          <BigNumber label="Activos" value={data.activos} />
          <BigNumber label="Con desvíos" value={data.conDesvios} color={data.conDesvios > 0 ? 'var(--red)' : 'var(--green)'} />
          <BigNumber label="Utilización equipo" value={`${data.utilPool}%`}
            color={data.utilPool > 95 ? 'var(--red)' : data.utilPool > 75 ? 'var(--green)' : 'var(--orange)'} />
          <BigNumber label="Horas comprometidas" value={data.horasContTotal.toLocaleString()} sub="contratadas" />
        </div>
      </div>

      {/* ─────────────── SECCIÓN 1 — HORAS Y NEGOCIO (lo primero que mira Dirección) ─────────────── */}
      <SectionTitle eyebrow="01" title="Horas y negocio" subtitle="Distribución de horas contratadas vs consumidas — la foto comercial del portafolio" />
      <div className="dir-grid">
        <div className="dir-card span-12">
          <div className="dir-horas-row">
            <BigNumber label="Contratadas" value={data.horasContTotal.toLocaleString()} sub="hs" color="var(--gray-dark)" />
            <BigNumber label="Consumidas" value={data.horasConsTotal.toLocaleString()} sub={`${data.pctConsumo}%`} color="var(--orange)" />
            <BigNumber label="Restantes" value={data.horasRestTotal.toLocaleString()} sub="hs" color="var(--green)" />
          </div>
          <div className="dir-horas-bar">
            <div className="dir-horas-bar-fill" style={{ width: `${Math.min(100, data.pctConsumo)}%` }} />
          </div>
        </div>

        <div className="dir-card span-6">
          <div className="dir-card-title">Top clientes por horas contratadas</div>
          <div className="dir-rank">
            {data.topClientes.map((c, i) => (
              <div key={c.cliente} className="dir-rank-row">
                <span className="dir-rank-idx">{i + 1}</span>
                <span className="dir-rank-name">{c.cliente}</span>
                <span className="mono dir-rank-val">{c.horas.toLocaleString()} <small>hs</small></span>
                <div className="dir-rank-bar">
                  <div className="dir-rank-bar-fill" style={{ width: `${(c.horas / data.topClientes[0].horas) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="dir-card span-3">
          <div className="dir-card-title">Por país</div>
          <div className="dir-pie-mini">
            {data.porPais.map(p => (
              <div key={p.pais} className="dir-pie-row">
                <span className="badge arg" style={{ minWidth: 30, textAlign: 'center' }}>{p.pais}</span>
                <span className="mono">{p.servicios}</span>
                <span style={{ color: 'var(--gray-mute)', fontSize: 11 }}>servicios</span>
                <span className="mono dir-pie-hs" style={{ marginLeft: 'auto' }}>{p.horas.toLocaleString()}<small>hs</small></span>
              </div>
            ))}
          </div>
        </div>

        <div className="dir-card span-3">
          <div className="dir-card-title">Mix por tipo</div>
          <div className="dir-pie-mini">
            {data.porTipo.map(t => (
              <div key={t.tipo} className="dir-pie-row">
                <span style={{ fontSize: 11, fontWeight: 600, minWidth: 80 }}>{t.tipo}</span>
                <div className="dir-rank-bar" style={{ flex: 1 }}>
                  <div className="dir-rank-bar-fill" style={{ width: `${t.pct}%` }} />
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--gray-mute)' }}>{t.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─────────────── SECCIÓN 2 — PORTAFOLIO ─────────────── */}
      <SectionTitle eyebrow="02" title="Salud del portafolio" subtitle="Cómo está marchando cada servicio según el último pulso semanal" />
      <div className="dir-grid">
        <div className="dir-card span-4">
          <div className="dir-card-title">Distribución por estado de avance</div>
          <DonutPortafolio data={data.distPortafolio} total={data.activos} />
          <div className="dir-card-footer">
            {data.sinPulso > 0 && <span style={{ color: 'var(--gray-mute)', fontSize: 11 }}>{data.sinPulso} servicios sin pulso reciente</span>}
          </div>
        </div>

        <div className="dir-card span-8">
          <div className="dir-card-title">Proyectos en problemas <span className="dir-card-meta">{data.proyectosCriticos.length}</span></div>
          {data.proyectosCriticos.length === 0 ? (
            <div className="dir-empty">Sin proyectos en estado crítico esta semana.</div>
          ) : (
            <div className="dir-list">
              {data.proyectosCriticos.slice(0, 5).map(p => (
                <div key={p.servicioId} className="dir-row-crit">
                  <div className="dir-row-crit-head">
                    <span className={`status-badge ${p.estadoCls}`}>{p.estado}</span>
                    <strong>{p.cliente}</strong>
                    <span className="dir-row-crit-name">{p.nombre}</span>
                    <span className="dir-row-crit-pulso">{p.fechaPulso}</span>
                  </div>
                  {p.motivo && <div className="dir-row-crit-motivo">{p.motivo}</div>}
                  {p.bloqueosTxt && <div className="dir-row-crit-bloq">⚑ {p.bloqueosTxt}</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="dir-card span-6">
          <div className="dir-card-title">Bloqueos escalados <span className="dir-card-meta">{data.bloqueosEscalados.length}</span></div>
          {data.bloqueosEscalados.length === 0 ? (
            <div className="dir-empty">Sin bloqueos escalados a Dirección.</div>
          ) : (
            <ul className="dir-bloqueos">
              {data.bloqueosEscalados.slice(0, 6).map((b, i) => (
                <li key={i}>
                  <strong>{b.cliente}</strong> · {b.servicio}
                  <div className="dir-bloq-titulo">⚑ {b.titulo}</div>
                  <div className="dir-bloq-meta">Owner: {b.owner} · {b.estado}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dir-card span-6">
          <div className="dir-card-title">Certificaciones del mes</div>
          <div className="dir-cert-stats">
            <div><span className="dir-cert-val" style={{ color: 'var(--green)' }}>{data.certs.ok}</span><span className="dir-cert-lbl">OK</span></div>
            <div><span className="dir-cert-val" style={{ color: 'var(--orange)' }}>{data.certs.pendientes}</span><span className="dir-cert-lbl">Pendientes</span></div>
            <div><span className="dir-cert-val" style={{ color: 'var(--red)' }}>{data.certs.vencidas}</span><span className="dir-cert-lbl">Vencidas</span></div>
            <div><span className="dir-cert-val" style={{ color: 'var(--gray-dark)' }}>{data.certs.proyectadas}</span><span className="dir-cert-lbl">Proyectadas</span></div>
          </div>
          {data.serviciosSinOC > 0 && (
            <div className="dir-cert-warn">⚠ {data.serviciosSinOC} servicio{data.serviciosSinOC === 1 ? '' : 's'} sin OC registrada</div>
          )}
        </div>
      </div>

      {/* ─────────────── SECCIÓN 3 — EQUIPO ─────────────── */}
      <SectionTitle eyebrow="03" title="Capacidad y equipo" subtitle="Cómo está distribuida la carga del equipo hoy" />
      <div className="dir-grid">
        <div className="dir-card span-4 dir-card-emph">
          <div className="dir-card-title">Utilización del pool</div>
          <div className="dir-util-big" style={{ color: data.utilPool > 95 ? 'var(--red)' : data.utilPool > 75 ? 'var(--green)' : 'var(--orange)' }}>
            {data.utilPool}<small>%</small>
          </div>
          <div className="dir-util-sub">{data.profesionalesActivos} profesionales activos</div>
          <div className="dir-util-bar">
            <div className="dir-util-bar-fill" style={{ width: `${Math.min(100, data.utilPool)}%`, background: data.utilPool > 95 ? 'var(--red)' : data.utilPool > 75 ? 'var(--green)' : 'var(--orange)' }} />
            {data.utilPool > 100 && <div className="dir-util-bar-overflow" />}
          </div>
        </div>

        <div className="dir-card span-4">
          <div className="dir-card-title">Carga por perfil</div>
          <div className="dir-perfil-bars">
            {data.cargaPorPerfil.map(p => (
              <div key={p.perfil} className="dir-perfil-row">
                <span className="dir-perfil-name">{p.perfil}</span>
                <div className="dir-perfil-track">
                  <div className="dir-perfil-fill" style={{ width: `${Math.min(100, p.utilProm)}%`, background: p.utilProm > 95 ? 'var(--red)' : p.utilProm > 75 ? 'var(--green)' : 'var(--orange)' }} />
                </div>
                <span className="dir-perfil-pct mono">{p.utilProm}%</span>
                <span className="dir-perfil-count">({p.cant})</span>
              </div>
            ))}
          </div>
        </div>

        <div className="dir-card span-4">
          <div className="dir-card-title">Alertas de equipo</div>
          <div className="dir-eq-alertas">
            <div>
              <span className="dir-eq-val" style={{ color: 'var(--red)' }}>{data.sobreasignados.length}</span>
              <span className="dir-eq-lbl">sobreasignados</span>
            </div>
            <div>
              <span className="dir-eq-val" style={{ color: 'var(--orange)' }}>{data.subutilizados.length}</span>
              <span className="dir-eq-lbl">subutilizados (&lt;50%)</span>
            </div>
            <div>
              <span className="dir-eq-val" style={{ color: 'var(--gray-mute)' }}>{data.libres.length}</span>
              <span className="dir-eq-lbl">libres (0%)</span>
            </div>
          </div>
        </div>

        {data.sobreasignados.length > 0 && (
          <div className="dir-card span-6">
            <div className="dir-card-title">Top sobreasignados <span className="dir-card-meta">{data.sobreasignados.length}</span></div>
            <ul className="dir-pers-list">
              {data.sobreasignados.slice(0, 5).map(p => (
                <li key={p.id}>
                  <span className="dir-pers-name">{p.nombre}</span>
                  <span className="dir-pers-meta">{p.perfil} · {p.seniority}</span>
                  <span className="mono dir-pers-pct" style={{ color: 'var(--red)' }}>{p.carga}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {data.libres.length > 0 && (
          <div className="dir-card span-6">
            <div className="dir-card-title">Disponibles para asignación <span className="dir-card-meta">{data.libres.length}</span></div>
            <ul className="dir-pers-list">
              {data.libres.slice(0, 5).map(p => (
                <li key={p.id}>
                  <span className="dir-pers-name">{p.nombre}</span>
                  <span className="dir-pers-meta">{p.perfil} · {p.seniority}</span>
                  <span className="mono dir-pers-pct" style={{ color: 'var(--green)' }}>0%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="dir-footer">
        Tablero de Control · Exisoft · generado el {HOY.toLocaleDateString('es-AR')}
      </div>
    </div>
  );
}

// ─── Sub-componentes ───────────────────────────────────────────

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="dir-section-head">
      <div className="dir-section-eyebrow">{eyebrow}</div>
      <div>
        <h2 className="dir-section-title">{title}</h2>
        {subtitle && <p className="dir-section-sub">{subtitle}</p>}
      </div>
    </div>
  );
}

function BigNumber({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div className="dir-bignum">
      <div className="dir-bignum-label">{label}</div>
      <div className="dir-bignum-val" style={color ? { color } : undefined}>{value}</div>
      {sub && <div className="dir-bignum-sub">{sub}</div>}
    </div>
  );
}

function DonutPortafolio({ data, total }: {
  data: { on: number; at: number; off: number; sinPulso: number };
  total: number;
}) {
  if (total === 0) return <div className="dir-empty">Sin servicios activos.</div>;
  const segments = [
    { val: data.on, color: 'var(--green)', label: 'ON-TRACK' },
    { val: data.at, color: 'var(--orange)', label: 'AT-RISK' },
    { val: data.off, color: 'var(--red)', label: 'OFF-TRACK' },
    { val: data.sinPulso, color: 'var(--gray-line)', label: 'Sin pulso' },
  ];
  const r = 60, cx = 80, cy = 80;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="dir-donut-wrap">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--gray-line)" strokeWidth="20" />
        {segments.map((s, i) => {
          if (s.val === 0) return null;
          const dash = (s.val / total) * C;
          const offset = -acc;
          acc += dash;
          return (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth="20"
              strokeDasharray={`${dash} ${C - dash}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`} />
          );
        })}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="32" fontWeight="800" fill="var(--gray-dark)">{total}</text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize="11" fill="var(--gray-mute)" style={{ textTransform: 'uppercase', letterSpacing: '.6px' }}>activos</text>
      </svg>
      <div className="dir-donut-legend">
        {segments.map(s => (
          <div key={s.label} className="dir-donut-leg-row">
            <span className="dir-donut-dot" style={{ background: s.color }} />
            <span className="dir-donut-lbl">{s.label}</span>
            <span className="mono dir-donut-val">{s.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cálculo de datos ─────────────────────────────────────────

function computar(store: Store) {
  const { servicios, recursos, avances, clientes } = store;
  const activosArr = servicios.filter(s => s.estado === 'En curso' || s.estado === 'En pausa' || s.estado === 'Cerrado por PM');

  // Distribución por estado de avance (último pulso)
  let on = 0, at = 0, off = 0, sinPulso = 0;
  const proyectosCriticos: Array<{
    servicioId: number; cliente: string; nombre: string;
    estado: EstadoAvance; estadoCls: string;
    fechaPulso: string; motivo?: string; bloqueosTxt?: string;
  }> = [];
  activosArr.forEach(s => {
    const ult = ultimoAvance(avances, s.id);
    if (!ult) { sinPulso++; return; }
    if (ult.estado === 'ON-TRACK') on++;
    else if (ult.estado === 'AT-RISK') at++;
    else off++;
    if (ult.estado !== 'ON-TRACK') {
      const bloqueosAbiertos = (s.bloqueos || []).filter(b => b.estado !== 'Cerrado');
      proyectosCriticos.push({
        servicioId: s.id, cliente: s.cliente, nombre: s.nombre,
        estado: ult.estado,
        estadoCls: ult.estado === 'AT-RISK' ? 'at' : 'off',
        fechaPulso: ult.fechaSemana,
        motivo: ult.motivoEstado,
        bloqueosTxt: bloqueosAbiertos.length > 0 ? bloqueosAbiertos.map(b => b.titulo).join(' · ') : undefined,
      });
    }
  });
  // Ordenar críticos: OFF-TRACK arriba, después AT-RISK
  proyectosCriticos.sort((a, b) => (a.estado === 'OFF-TRACK' ? 0 : 1) - (b.estado === 'OFF-TRACK' ? 0 : 1));

  // Bloqueos escalados
  const bloqueosEscalados: Array<{ cliente: string; servicio: string; titulo: string; owner: string; estado: string }> = [];
  activosArr.forEach(s => {
    (s.bloqueos || []).filter(b => b.escalado && b.estado !== 'Cerrado').forEach(b => {
      bloqueosEscalados.push({ cliente: s.cliente, servicio: s.nombre, titulo: b.titulo, owner: b.owner, estado: b.estado });
    });
  });

  // Certificaciones del mes actual
  const mesActual = HOY.getMonth() + 1;
  const certs = { ok: 0, pendientes: 0, vencidas: 0, proyectadas: 0 };
  servicios.forEach(s => {
    if (s.modoCertificacion === 'NoCertifica') return;
    const c = s.certificaciones?.[mesActual];
    if (c === 'Ok') certs.ok++;
    else if (c === 'Pendiente') certs.pendientes++;
    else if (c === 'Vencido') certs.vencidas++;
    else if (c === 'Proyectado') certs.proyectadas++;
  });
  const serviciosSinOC = activosArr.filter(s => s.tieneOC === false).length;

  // Equipo
  const profesionalesActivos = recursos.filter(r => r.estadoLaboral === 'Activo');
  type Carga = { id: number; nombre: string; perfil: string; seniority: string; carga: number };
  const cargas: Carga[] = profesionalesActivos.map(r => ({
    id: r.id, nombre: nombreCompleto(r),
    perfil: r.perfilPrincipal, seniority: r.seniorityPrincipal,
    carga: cargaTotal(r, servicios, recursos, clientes),
  }));
  const sumaCargas = cargas.reduce((a, c) => a + c.carga, 0);
  const utilPool = profesionalesActivos.length > 0
    ? Math.round((sumaCargas / (profesionalesActivos.length * 100)) * 100)
    : 0;
  const sobreasignados = cargas.filter(c => c.carga > 100).sort((a, b) => b.carga - a.carga);
  const subutilizados = cargas.filter(c => c.carga > 0 && c.carga < 50).sort((a, b) => a.carga - b.carga);
  const libres = cargas.filter(c => c.carga === 0);

  // Carga por perfil (PM, LT, Dev, etc.)
  const cargaPorPerfilMap = new Map<string, { suma: number; cant: number }>();
  cargas.forEach(c => {
    const p = c.perfil || 'Otro';
    const cur = cargaPorPerfilMap.get(p) || { suma: 0, cant: 0 };
    cur.suma += c.carga; cur.cant += 1;
    cargaPorPerfilMap.set(p, cur);
  });
  const cargaPorPerfil = Array.from(cargaPorPerfilMap.entries())
    .map(([perfil, v]) => ({ perfil, utilProm: Math.round(v.suma / v.cant), cant: v.cant }))
    .sort((a, b) => b.utilProm - a.utilProm);

  // ── Agregados solo de servicios NO Cerrados ──
  // Los servicios cerrados quedan en su ficha pero NO suman a totales globales:
  // ya no son "futuro comprometido". La vista de Dirección refleja la cartera viva.
  const serviciosVivos = servicios.filter(s => s.estado !== 'Cerrado');

  // Horas
  const horasContTotal = serviciosVivos.reduce((a, s) => a + (s.horasCont || 0), 0);
  const horasConsTotal = serviciosVivos.reduce((a, s) => a + (s.horasCons || 0), 0);
  const horasRestTotal = Math.max(0, horasContTotal - horasConsTotal);
  const pctConsumo = horasContTotal > 0 ? Math.round((horasConsTotal / horasContTotal) * 100) : 0;

  // Top clientes
  const porClienteMap = new Map<string, number>();
  serviciosVivos.forEach(s => porClienteMap.set(s.cliente, (porClienteMap.get(s.cliente) || 0) + (s.horasCont || 0)));
  const topClientes = Array.from(porClienteMap.entries())
    .map(([cliente, horas]) => ({ cliente, horas }))
    .filter(c => c.horas > 0)
    .sort((a, b) => b.horas - a.horas)
    .slice(0, 5);

  // Por país
  const porPaisMap = new Map<string, { servicios: number; horas: number }>();
  serviciosVivos.forEach(s => {
    const cur = porPaisMap.get(s.pais) || { servicios: 0, horas: 0 };
    cur.servicios += 1;
    cur.horas += s.horasCont || 0;
    porPaisMap.set(s.pais, cur);
  });
  const porPais = Array.from(porPaisMap.entries()).map(([pais, v]) => ({ pais, ...v })).sort((a, b) => b.horas - a.horas);

  // Por tipo
  const porTipoMap = new Map<string, number>();
  serviciosVivos.forEach(s => porTipoMap.set(s.tipo, (porTipoMap.get(s.tipo) || 0) + 1));
  const totalServicios = serviciosVivos.length || 1;
  const porTipo = Array.from(porTipoMap.entries())
    .map(([tipo, count]) => ({ tipo, pct: Math.round((count / totalServicios) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  // Narrativa autogenerada
  const narrativa = construirNarrativa({
    activos: activosArr.length, conDesvios: at + off, off, utilPool,
    sobreasignados: sobreasignados.length, bloqueosEscalados: bloqueosEscalados.length,
  });

  return {
    activos: activosArr.length,
    conDesvios: at + off,
    sinPulso,
    distPortafolio: { on, at, off, sinPulso },
    proyectosCriticos,
    bloqueosEscalados,
    certs, serviciosSinOC,

    profesionalesActivos: profesionalesActivos.length,
    utilPool,
    sobreasignados,
    subutilizados,
    libres,
    cargaPorPerfil,

    horasContTotal, horasConsTotal, horasRestTotal, pctConsumo,
    topClientes,
    porPais,
    porTipo,

    narrativa,
  };
}

function construirNarrativa(d: {
  activos: number; conDesvios: number; off: number;
  utilPool: number; sobreasignados: number; bloqueosEscalados: number;
}): string {
  const partes: string[] = [];
  partes.push(`${d.activos} servicios activos en el portafolio.`);
  if (d.conDesvios === 0) partes.push('Sin desvíos reportados esta semana.');
  else if (d.off > 0) partes.push(`${d.conDesvios} con desvíos, ${d.off} en OFF-TRACK.`);
  else partes.push(`${d.conDesvios} con desvíos leves (AT-RISK).`);
  if (d.utilPool > 95) partes.push(`Equipo al ${d.utilPool}% — capacidad saturada.`);
  else if (d.utilPool > 75) partes.push(`Equipo al ${d.utilPool}% de utilización.`);
  else partes.push(`Equipo al ${d.utilPool}% — capacidad disponible.`);
  if (d.bloqueosEscalados > 0) partes.push(`${d.bloqueosEscalados} bloqueo${d.bloqueosEscalados === 1 ? '' : 's'} escalado${d.bloqueosEscalados === 1 ? '' : 's'} a Dirección.`);
  if (d.sobreasignados > 0) partes.push(`${d.sobreasignados} profesional${d.sobreasignados === 1 ? '' : 'es'} sobreasignado${d.sobreasignados === 1 ? '' : 's'}.`);
  return partes.join(' ');
}


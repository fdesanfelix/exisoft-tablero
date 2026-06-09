// Tipos del dominio — espejo de la base ExiServicios (ver server/README.md).
// Los prefijos SQL (pal_, sio_, cte_) se mantienen en los comentarios para mapear
// directamente con la base existente al conectar el backend.

export type Pais = 'AR' | 'PE' | 'CH' | 'MX' | 'OTROS';

// Tipos de servicio canónicos. Llave en mano agrupa también a "Proyecto",
// y Horas agrupa a "Consultoría" (decisión funcional Exisoft).
export type TipoServicio = 'Soporte' | 'Llave en mano' | 'T&M' | 'Horas';
export const TIPOS_SERVICIO: TipoServicio[] = ['Soporte', 'Llave en mano', 'T&M', 'Horas'];

// Aliases legacy → canónico. Se usan al cargar datos de planillas viejas.
export const TIPO_ALIAS: Record<string, TipoServicio> = {
  'Soporte': 'Soporte',
  'Llave en mano': 'Llave en mano',
  'Proyecto': 'Llave en mano',
  'T&M': 'T&M',
  'Horas': 'Horas',
  'Consultoría': 'Horas',
  'Consultoria': 'Horas',
  'Manpower': 'T&M',
};
export function normalizarTipo(s: string): TipoServicio {
  return TIPO_ALIAS[s] || 'Horas';
}

// Estado del ciclo de vida del servicio.
// Cierre en dos niveles: PM declara terminado → Servicios da el OK final ("Cerrado").
export type EstadoServicio =
  | 'No iniciado'
  | 'En curso'
  | 'En pausa'
  | 'Cerrado por PM'   // PM lo dio por terminado, espera validación de servicios
  | 'Cerrado';         // Servicios validó y dio el OK definitivo
export const ESTADOS_SERVICIO: EstadoServicio[] = ['No iniciado', 'En curso', 'En pausa', 'Cerrado por PM', 'Cerrado'];
export type EstadoBloqueo = 'Abierto' | 'En curso' | 'Cerrado';
export type EstadoCertificacion = 'Ok' | 'Pendiente' | 'Vencido' | 'Proyectado' | 'NoAplica';
export type Rol = 'PM' | 'Comercial' | 'GerenciaServicios' | 'DirectorServicios';

// Modo de certificación elegido al alta del servicio.
// - 'Mensual'    → Gerencia de Servicios da OK por mes (Horas / T&M, etc.)
// - 'Hitos'      → cada hito se certifica individualmente desde el avance (Llave en mano)
// - 'NoCertifica'→ no aparece en la vista de Certificaciones
export type ModoCertificacion = 'Mensual' | 'Hitos' | 'NoCertifica';
export const MODOS_CERT_LABEL: Record<ModoCertificacion, string> = {
  Mensual: 'Mensual',
  Hitos: 'Por hitos',
  NoCertifica: 'No se certifica desde Servicios',
};

// ──────────────────────────────────────────────────────────────────────────
// HITO de servicio — tabla SQL dbo.HITO
// ──────────────────────────────────────────────────────────────────────────
export interface HitoServicio {
  id: number;                 // hto_id
  nombre: string;             // hto_nombre
  porcentaje: number;         // % de facturación del hito (suma 100 entre todos los hitos)
  fechaCert: string;          // hto_fecha — fecha estimada de certificación (dd/mm/aaaa)
  horas?: number | null;      // hito_horas
  valor?: number | null;      // hto_valor (monto)
  cumplido?: boolean;         // marcado como certificado
  fechaCertReal?: string;     // dd/mm/aaaa — fecha real de la certificación
  comentarioCert?: string;    // observación al certificar
  horasCertReal?: number;     // horas efectivamente certificadas (puede diferir del estimado)
  autorCert?: string;         // nombre del recurso que registró la certificación
  descripcion?: string;       // hto_descripcion
  responsableId?: number;     // FK Recurso — dueño del hito
}

// Detalle de una certificación mensual concreta (lo que el PM/Gerencia carga al certificar).
// La indexación es por número de mes (1..12). Anio implícito = ANIO_ACTUAL al cargar,
// se guarda explícito por si se certifica un mes de otro año.
export interface CertificacionMeta {
  fecha: string;              // dd/mm/aaaa — cuándo se registró la certificación
  horas?: number;             // horas efectivamente certificadas
  comentario?: string;
  autor: string;              // nombre del recurso que certificó
  anio: number;
}

// ──────────────────────────────────────────────────────────────────────────
// SERVICIO — dbo.SERVICIO + tablas nuevas (SERVICIO_HORAS, CERTIFICACION_MENSUAL...)
// ──────────────────────────────────────────────────────────────────────────
export interface Servicio {
  id: number;                       // sio_id
  cliente: string;                  // join CLIENTE.cte_nombre
  pais: Pais;                       // join CLIENTE.cte_pis_id
  nombre: string;                   // sio_nombre
  tipo: TipoServicio;               // TIPO_CONTRATO.tco_tipo_contrato
  estado: EstadoServicio;           // estado operativo (tabla nueva)
  inicio: string;                   // sio_fecha_inicio
  fin: string;                      // sio_fecha_fin
  horasCont: number | null;         // SERVICIO_HORAS.contratadas (último snapshot)
  horasCons: number | null;         // SERVICIO_HORAS.consumidas
  horasRest: number | null;         // derivado
  certif: string;                   // texto libre del modo de certificación
  alertas: string[];                // derivadas + tabla ALERTA
  bloqueos: Bloqueo[];              // tabla BLOQUEO
  tieneOC?: boolean;                // tabla OC
  derivaDe?: number;                // sio_deriva_servicio_de
  subcontratado?: boolean;          // tabla SUBCONTRATO

  // Configuración de certificación
  modoCertificacion: ModoCertificacion;  // Mensual / Hitos / NoCertifica
  seguimientoAvances: boolean;           // si true → puede agregarse a un Informe de Avances
  hitos: HitoServicio[];                 // sólo aplica si modoCertificacion === 'Hitos'

  // Cierres del servicio (dos niveles)
  cierrePM?: { fecha: string; por: string };
  cierreServicios?: { fecha: string; por: string };

  certificaciones?: Record<number, EstadoCertificacion>; // mes 1..12 -> estado
  // Detalle por mes (fecha real, horas, comentario, autor). Solo se llena cuando
  // efectivamente se registró una certificación.
  certificacionesMeta?: Record<number, CertificacionMeta>;

  // Desglose opcional de horas contratadas por perfil/seniority.
  // Si está cargado, el % de asignación de cada miembro se deriva de acá.
  // Idealmente la suma de horas == horasCont; si no, se marca como warning.
  horasPorPerfil?: HorasPorPerfil[];

  // Historial de cambios sensibles al servicio (fechas, alcance, horas contratadas).
  // Cada cambio guarda valor anterior/nuevo + flag de elevación a Comercial.
  cambios?: CambioServicio[];

  // Ventana en días para el panel "Novedades de la semana" en Avances.
  // Default 7. Configurable a 14 si el ritmo del proyecto es más pausado.
  ventanaPulsoDias?: number;

  // Riesgos identificados — distinto de bloqueos. Un riesgo es algo que PODRÍA
  // ocurrir; cuando se materializa, opcionalmente se convierte en un bloqueo.
  riesgos?: Riesgo[];

  // ── Herencia de horas entre servicios derivados ──
  // Cuando el servicio "deriva de" un servicio cerrado con sobrantes y se elige
  // transferir las horas, registramos cuánto se heredó y de dónde.
  horasHeredadas?: number;
  horasHeredadasDeId?: number;
  // En el servicio CERRADO origen: indica si las horas se trasladaron a otro servicio.
  horasTrasladadasAId?: number;
  horasTrasladadasCant?: number;
  // Saldo al cerrar el servicio: qué pasa con las horas que sobraron al cierre.
  // - 'AFavorCliente' → quedan reservadas para futuro uso del cliente
  // - 'Vencidas'      → se pierden (no se podrán recuperar)
  // - 'Trasladadas'   → ya se reasignaron a otro servicio derivado
  saldoCierre?: 'AFavorCliente' | 'Vencidas' | 'Trasladadas';
}

export type TipoCambio = 'FechaInicio' | 'FechaFin' | 'Alcance' | 'HorasContratadas';
export type EstadoElevacion = 'Pendiente' | 'Notificado' | 'Aprobado' | 'Rechazado';

export const TIPO_CAMBIO_LABEL: Record<TipoCambio, string> = {
  FechaInicio: 'Fecha de inicio',
  FechaFin: 'Fecha de fin',
  HorasContratadas: 'Horas contratadas',
  Alcance: 'Alcance',
};

export interface CambioServicio {
  id: number;
  tipo: TipoCambio;
  fechaRegistro: string;        // dd/mm/aaaa
  valorAnterior?: string;       // serializado a texto (vacío para alcance)
  valorNuevo?: string;
  descripcion?: string;         // libre, sobre todo para alcance
  motivo?: string;              // por qué se cambia
  elevarComercial: boolean;
  estadoElevacion?: EstadoElevacion;  // workflow básico opcional
  autor: string;                // nombre del recurso que registró
}

export interface HorasPorPerfil {
  perfil: string;
  seniority: string;
  horas: number;
}

export interface Bloqueo {
  titulo: string;
  desc: string;
  owner: string;
  estado: EstadoBloqueo;
  escalado: boolean;
  categoria?: string;        // ref a CategoriaBloqueo.nombre (opcional)
}

// ──────────────────────────────────────────────────────────────────────────
// RIESGO — algo que PODRÍA pasar y afectar el proyecto. Si se materializa,
// se convierte en un Bloqueo activo. Probabilidad × Impacto = severidad.
// ──────────────────────────────────────────────────────────────────────────
// Probabilidad y impacto usan adjetivos en género distinto (la probabilidad es femenina,
// el impacto masculino) para que las labels se lean bien en español.
export type NivelProbabilidad = 'Baja' | 'Media' | 'Alta';
export type NivelImpacto = 'Bajo' | 'Medio' | 'Alto';
export const NIVELES_PROBABILIDAD: NivelProbabilidad[] = ['Baja', 'Media', 'Alta'];
export const NIVELES_IMPACTO: NivelImpacto[] = ['Bajo', 'Medio', 'Alto'];
export type EstadoRiesgo = 'Identificado' | 'Mitigado' | 'Materializado' | 'Cerrado';
export const ESTADOS_RIESGO: EstadoRiesgo[] = ['Identificado', 'Mitigado', 'Materializado', 'Cerrado'];

export interface Riesgo {
  id: number;
  titulo: string;
  descripcion?: string;
  probabilidad: NivelProbabilidad;
  impacto: NivelImpacto;
  mitigacion?: string;          // plan o acción para reducir el riesgo
  owner: string;                // quién monitorea / actúa
  estado: EstadoRiesgo;
  fechaIdentificacion: string;  // dd/mm/aaaa
  fechaCierre?: string;
  categoria?: string;           // misma tabla soporte que CategoriaBloqueo (opcional)
}

// Severidad numérica 1-9 para ordenar y colorear. Devuelve {valor, nivel}.
export function severidadRiesgo(r: Riesgo): { valor: number; nivel: 'Bajo' | 'Medio' | 'Alto' | 'Crítico' } {
  const nProb = (x: NivelProbabilidad) => x === 'Alta' ? 3 : x === 'Media' ? 2 : 1;
  const nImp = (x: NivelImpacto) => x === 'Alto' ? 3 : x === 'Medio' ? 2 : 1;
  const valor = nProb(r.probabilidad) * nImp(r.impacto);
  const nivel = valor >= 6 ? 'Crítico' : valor >= 3 ? 'Alto' : valor >= 2 ? 'Medio' : 'Bajo';
  return { valor, nivel };
}

// ──────────────────────────────────────────────────────────────────────────
// PROFESIONAL — espejo exacto de dbo.PROFESIONAL + PROFESIONAL_SERVICIO
// ──────────────────────────────────────────────────────────────────────────
export interface AsignacionServicio {
  servicioId: number;               // pso_id_servicio
  // % override manual. Si está vacío/0, se usa el % calculado automáticamente
  // a partir de horasPorPerfil del servicio + capacidad mensual del cliente.
  porcentaje?: number;              // override (opcional)
  // @deprecated — se mantiene por compatibilidad con seeds viejos; no se usa en UI nueva.
  porcentajeCliente?: number;
  perfil: string;                   // PERFIL.pil_nombre
  seniority: string;                // SENIORITY.sty_nombre
  fechaDesde: string;               // pso_fecha_desde
  fechaHasta: string;               // pso_fecha_hasta
  // Si la asignación cerró porque vino un reemplazo (no por finalización natural),
  // referencia al recurso que tomó el slot.
  reemplazadoPorId?: number;
  motivoBaja?: string;              // texto libre: "renuncia", "rotación interna", etc.
}

export interface Recurso {
  id: number;                       // pal_id
  legajo: string;                   // pal_legajo
  nombre: string;                   // pal_nombre
  apellido: string;                 // pal_apellido
  fechaIngreso: string;             // pal_fecha_ingreso
  fechaNacimiento: string;          // pal_fecha_nacimiento
  dni: string;                      // pal_dni
  cuit: string;                     // pal_cuit
  mail: string;                     // pal_mail (laboral)
  mailPersonal: string;             // pal_mail_personal
  telefono: string;                 // pal_telefono
  tipoContratacion: string;         // TIPO_CONTRATACION.tcn_nombre (RelDep, Monotributo, etc.)
  estadoLaboral: 'Activo' | 'Licencia' | 'Renunció' | 'Despedido'; // pal_estado
  fechaRenuncia?: string;           // pal_fecha_renuncia
  observaciones?: string;           // pal_observaciones

  // Dirección
  dirCalle: string;                 // pal_direccion_calle
  dirNumero: string;                // pal_direccion_numero
  dirPisoDto?: string;              // pal_direccion_piso_dto
  dirCiudad: string;                // join LOCALIDAD
  dirProvincia: string;             // join PROVINCIA_ESTADO
  dirPais: Pais;                    // join PAIS

  // Contacto de emergencia
  personaContacto?: string;         // pal_persona_contacto
  telContacto?: string;             // pal_tel_contacto

  // Perfil/seniority general (no por servicio)
  perfilPrincipal: string;          // PERFIL.pil_nombre actual
  seniorityPrincipal: string;       // SENIORITY.sty_nombre actual

  subcontratado: boolean;           // tabla SUBCONTRATO
  asignaciones: AsignacionServicio[]; // PROFESIONAL_SERVICIO

  alerta?: string;                  // derivado
}

// ──────────────────────────────────────────────────────────────────────────
// AVANCES — tabla nueva. Un Avance por proyecto + semana. SQL: dbo.AVANCE
// El histórico de un proyecto = todos los Avances filtrados por servicioId.
// ──────────────────────────────────────────────────────────────────────────
export type EstadoAvance = 'ON-TRACK' | 'AT-RISK' | 'OFF-TRACK';

// ──────────────────────────────────────────────────────────────────────────
// TAREA (macroplan) — tabla nueva en SQL: dbo.TAREA
// Vive a nivel proyecto. El PM la mantiene actualizada; el sistema toma
// snapshots semanales (tareasCompletadas / tareasAtrasadas) cuando se carga
// un Avance.
// ──────────────────────────────────────────────────────────────────────────
export type EstadoTarea = 'Pendiente' | 'En curso' | 'Completada' | 'Bloqueada' | 'Cancelada';
export const ESTADOS_TAREA: EstadoTarea[] = ['Pendiente', 'En curso', 'Completada', 'Bloqueada', 'Cancelada'];

export interface Tarea {
  id: number;
  servicioId: number;
  nombre: string;
  responsableId?: number;          // FK Recurso (opcional)
  responsableNombre?: string;      // denormalizado (para externos o vista rápida)
  fechaInicioPlan: string;         // dd/mm/aaaa
  fechaFinPlan: string;            // dd/mm/aaaa
  estado: EstadoTarea;
  fechaFinReal?: string;           // dd/mm/aaaa cuando se marca Completada
  porcentaje?: number;             // 0-100, opcional para tareas largas
  hitoId?: number;                 // opcional, vincula a HitoServicio
  comentario?: string;
  orden: number;                   // para ordenar manualmente
}

// ──────────────────────────────────────────────────────────────────────────
// AVANCE semanal — pulso. Conviviendo con modelo viejo (campos opcionales).
// ──────────────────────────────────────────────────────────────────────────
export interface Avance {
  id: number;
  servicioId: number;              // FK SERVICIO
  fechaSemana: string;             // dd/mm/aaaa — lunes de la semana de carga
  autor: string;                   // quien cargó el avance
  fechaCarga: string;              // dd/mm/aaaa

  estado: EstadoAvance;            // ON / AT / OFF
  motivoEstado?: string;           // si AT/OFF: por qué

  // Snapshot del macroplan al momento de la carga (no se recalcula después)
  pctAvanceGlobal?: number;        // % tareas completadas / total
  tareasCompletadas?: number[];    // IDs cerradas entre semana anterior y ésta
  tareasAtrasadas?: number[];      // IDs con fechaFinPlan vencida y no Completada

  comentario?: string;             // 1 párrafo del PM — explica desvíos / contexto

  // ── Modelo nuevo (pulso auto-generado) ──
  autoGenerado?: boolean;          // true si vino del cálculo automático al cierre de semana
  estadoAuto?: EstadoAvance;       // el estado que infirió la regla (si difiere de estado, hubo override del PM)
  resumenAuto?: string;            // resumen textual auto-generado del período
  motivoEstadoAuto?: string;       // explicación textual del por qué del estadoAuto

  // ────── Campos legacy (avances cargados con el modelo anterior) ──────
  planeado?: number;
  real?: number;
  pmExisoft?: string;
  ltExisoft?: string;
  pmCliente?: string;
  objetivos?: string[];
  logros?: string[];
  proximo?: string[];
  comentarios?: string;
  bloqueos?: Bloqueo[];
}

// Helper: parsea dd/mm/aaaa → Date (o null)
export function parseDate(s: string): Date | null {
  if (!s) return null;
  const p = s.split('/').map(Number);
  if (p.length !== 3 || !p[0] || !p[1] || !p[2]) return null;
  return new Date(p[2], p[1] - 1, p[0]);
}

// Helper: último Avance por servicio (el "estado actual")
export function ultimoAvance(avances: Avance[], servicioId: number): Avance | null {
  const items = avances
    .filter(a => a.servicioId === servicioId)
    .map(a => ({ a, d: parseDate(a.fechaSemana)?.getTime() ?? 0 }))
    .sort((x, y) => y.d - x.d);
  return items[0]?.a ?? null;
}

export function historialAvances(avances: Avance[], servicioId: number): Avance[] {
  return avances
    .filter(a => a.servicioId === servicioId)
    .map(a => ({ a, d: parseDate(a.fechaSemana)?.getTime() ?? 0 }))
    .sort((x, y) => x.d - y.d)
    .map(x => x.a);
}

// Devuelve el lunes (00:00) de la semana que contiene a `d`.
export function lunesDeSemana(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dia = x.getDay(); // 0=Dom, 1=Lun, ..., 6=Sáb
  const diff = dia === 0 ? -6 : 1 - dia;
  x.setDate(x.getDate() + diff);
  return x;
}
export function ddmmaaaa(d: Date): string {
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
}

// Tareas: filtra por servicio y ordena por orden / fechaInicio
export function tareasDe(tareas: Tarea[], servicioId: number): Tarea[] {
  return tareas
    .filter(t => t.servicioId === servicioId)
    .sort((a, b) => {
      if (a.orden !== b.orden) return a.orden - b.orden;
      const da = parseDate(a.fechaInicioPlan)?.getTime() ?? 0;
      const db = parseDate(b.fechaInicioPlan)?.getTime() ?? 0;
      return da - db;
    });
}

// Detecta tareas atrasadas a una fecha dada (con fechaFinPlan < ref y no Completada/Cancelada)
export function tareasAtrasadasAt(tareas: Tarea[], servicioId: number, ref: Date): Tarea[] {
  return tareasDe(tareas, servicioId).filter(t => {
    if (t.estado === 'Completada' || t.estado === 'Cancelada') return false;
    const ff = parseDate(t.fechaFinPlan);
    return !!ff && ff < ref;
  });
}

// Devuelve el nombre del responsable de una tarea, resolviéndolo siempre desde Recursos
// si hay un responsableId. Esto evita que un rename del recurso quede colgado en tareas viejas.
// El responsableNombre denormalizado se usa solo como fallback (imports legacy, sin id).
export function responsableDe(tarea: Tarea, recursos: Recurso[]): string {
  if (tarea.responsableId) {
    const r = recursos.find(x => x.id === tarea.responsableId);
    if (r) return nombreCompleto(r);
  }
  return tarea.responsableNombre || '';
}

// ──────────────────────────────────────────────────────────────────────────
// PULSO AUTO-GENERADO — infiere estado y resumen desde la data del proyecto
// ──────────────────────────────────────────────────────────────────────────

// Reglas para inferir el estado del proyecto a partir de señales objetivas:
// - OFF-TRACK: hay hitos vencidos sin cumplir, o > 30% de las tareas activas atrasadas.
// - AT-RISK: hay bloqueos escalados activos, o entre 1 y 30% de tareas atrasadas.
// - ON-TRACK: nada de lo anterior.
export interface ResultadoInferenciaEstado {
  estado: EstadoAvance;
  motivo: string;            // explicación textual corta
}

export function inferirEstadoAvance(
  tareas: Tarea[],
  servicioId: number,
  bloqueos: Bloqueo[],
  hitos: HitoServicio[],
  hasta: Date,
): ResultadoInferenciaEstado {
  const tareasServ = tareasDe(tareas, servicioId).filter(t => t.estado !== 'Cancelada');
  const totalActivas = tareasServ.length;
  const atrasadas = tareasAtrasadasAt(tareas, servicioId, hasta);
  const pctAtrasadas = totalActivas > 0 ? (atrasadas.length / totalActivas) * 100 : 0;

  const hitosVencidos = (hitos || []).filter(h => {
    if (h.cumplido) return false;
    const f = parseDate(h.fechaCert);
    return !!f && f < hasta;
  });

  const bloqueosEscalados = (bloqueos || []).filter(b => b.escalado && b.estado !== 'Cerrado');
  const bloqueosAbiertos = (bloqueos || []).filter(b => b.estado !== 'Cerrado');

  // OFF-TRACK
  if (hitosVencidos.length > 0) {
    return { estado: 'OFF-TRACK', motivo: `${hitosVencidos.length} hito${hitosVencidos.length === 1 ? '' : 's'} vencido${hitosVencidos.length === 1 ? '' : 's'} sin certificar` };
  }
  if (pctAtrasadas > 30) {
    return { estado: 'OFF-TRACK', motivo: `${atrasadas.length} de ${totalActivas} tareas atrasadas (${Math.round(pctAtrasadas)}%)` };
  }

  // AT-RISK
  if (bloqueosEscalados.length > 0) {
    return { estado: 'AT-RISK', motivo: `${bloqueosEscalados.length} bloqueo${bloqueosEscalados.length === 1 ? '' : 's'} escalado${bloqueosEscalados.length === 1 ? '' : 's'} a Dirección` };
  }
  if (atrasadas.length > 0) {
    return { estado: 'AT-RISK', motivo: `${atrasadas.length} tarea${atrasadas.length === 1 ? '' : 's'} atrasada${atrasadas.length === 1 ? '' : 's'}` };
  }
  if (bloqueosAbiertos.length > 2) {
    return { estado: 'AT-RISK', motivo: `${bloqueosAbiertos.length} bloqueos abiertos sin destrabar` };
  }

  // ON-TRACK
  return { estado: 'ON-TRACK', motivo: 'Sin desvíos detectados' };
}

// Genera un resumen textual del período: cuántas tareas cerradas, cambios, hitos, etc.
export function resumenAutoPulso(opts: {
  tareasCerradas: number;
  tareasAtrasadas: number;
  hitosCumplidos: number;
  cambiosRegistrados: number;
  bloqueosAbiertos: number;
}): string {
  const partes: string[] = [];
  if (opts.tareasCerradas > 0) partes.push(`${opts.tareasCerradas} tarea${opts.tareasCerradas === 1 ? '' : 's'} cerrada${opts.tareasCerradas === 1 ? '' : 's'}`);
  if (opts.hitosCumplidos > 0) partes.push(`${opts.hitosCumplidos} hito${opts.hitosCumplidos === 1 ? '' : 's'} cumplido${opts.hitosCumplidos === 1 ? '' : 's'}`);
  if (opts.cambiosRegistrados > 0) partes.push(`${opts.cambiosRegistrados} cambio${opts.cambiosRegistrados === 1 ? '' : 's'} registrado${opts.cambiosRegistrados === 1 ? '' : 's'}`);
  if (opts.tareasAtrasadas > 0) partes.push(`${opts.tareasAtrasadas} tarea${opts.tareasAtrasadas === 1 ? '' : 's'} atrasada${opts.tareasAtrasadas === 1 ? '' : 's'}`);
  if (opts.bloqueosAbiertos > 0) partes.push(`${opts.bloqueosAbiertos} bloqueo${opts.bloqueosAbiertos === 1 ? '' : 's'} abierto${opts.bloqueosAbiertos === 1 ? '' : 's'}`);
  if (partes.length === 0) return 'Sin actividad registrada en el período.';
  return partes.join(' · ') + '.';
}

// Tareas cerradas (estado Completada) entre `desde` (exclusive) y `hasta` (inclusive)
export function tareasCerradasEnRango(tareas: Tarea[], servicioId: number, desde: Date | null, hasta: Date): Tarea[] {
  return tareasDe(tareas, servicioId).filter(t => {
    if (t.estado !== 'Completada' || !t.fechaFinReal) return false;
    const fr = parseDate(t.fechaFinReal);
    if (!fr) return false;
    if (desde && fr <= desde) return false;
    return fr <= hasta;
  });
}

// % avance global del proyecto = tareas completadas / tareas totales (sin canceladas)
export function pctAvanceGlobal(tareas: Tarea[], servicioId: number): number {
  const ts = tareasDe(tareas, servicioId).filter(t => t.estado !== 'Cancelada');
  if (ts.length === 0) return 0;
  const completadas = ts.filter(t => t.estado === 'Completada').length;
  return Math.round((completadas / ts.length) * 100);
}

// ──────────────────────────────────────────────────────────────────────────
// CLIENTE — dbo.CLIENTE
// ──────────────────────────────────────────────────────────────────────────
export interface Cliente {
  id: number;
  nombre: string;
  pais: Pais;
  // Capacidad mensual de referencia para calcular % de asignación de los recursos
  // sobre proyectos de este cliente. Default = 160hs (8hs × 20 días).
  // Algunos clientes usan 168 (8hs × 21 días); el PM puede editarlo por cliente.
  capacidadMensual?: number;
  // Datos de contacto (opcionales).
  contactoNombre?: string;
  contactoEmail?: string;
  contactoTelefono?: string;
  observaciones?: string;
  activo?: boolean;          // default true; permite "archivar" sin borrar
}

// ──────────────────────────────────────────────────────────────────────────
// Tablas soporte editables desde Admin.
// Forma genérica: { id, nombre, descripcion?, activo? }.
// ──────────────────────────────────────────────────────────────────────────
export interface TablaSoporteItem {
  id: number;
  nombre: string;
  descripcion?: string;
  activo: boolean;
}
export interface Perfil extends TablaSoporteItem {}
export interface Seniority extends TablaSoporteItem {}
export interface TipoContratacion extends TablaSoporteItem {}
export interface CategoriaBloqueo extends TablaSoporteItem {}

// Capacidad por defecto (8hs × 20 días). Por cliente se puede sobreescribir.
export const CAPACIDAD_MENSUAL_DEFAULT = 160;

// ──────────────────────────────────────────────────────────────────────────
// SESIÓN
// ──────────────────────────────────────────────────────────────────────────
export interface UsuarioSesion { nombre: string; rol: Rol; }

export const ROLES_LABEL: Record<Rol, string> = {
  PM: 'Project Manager',
  Comercial: 'Comercial',
  GerenciaServicios: 'Gerencia de Servicios',
  DirectorServicios: 'Director de Servicios',
};

export const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// HOY/MES_ACTUAL son dinámicos — siempre toman la fecha real del navegador.
// (En producción esto vendrá del server. En el prototipo usa el reloj del cliente.)
export const HOY = new Date();
export const MES_ACTUAL = HOY.getMonth() + 1;
export const ANIO_ACTUAL = HOY.getFullYear();

// Helper
export function nombreCompleto(r: { nombre: string; apellido: string }): string {
  return `${r.nombre} ${r.apellido}`.trim();
}

// Suma de los overrides manuales del recurso. Se mantiene por compatibilidad —
// para la carga REAL del recurso considerando cálculos automáticos, usar `cargaTotal()`.
export function asignacionTotal(r: Recurso): number {
  return r.asignaciones.reduce((a, x) => a + (x.porcentaje || 0), 0);
}

// ──────────────────────────────────────────────────────────────────────────
// CÁLCULO DE % DE ASIGNACIÓN
// ──────────────────────────────────────────────────────────────────────────

// Capacidad mensual del cliente (configurable, default 160hs).
export function capacidadMensualCliente(clientes: Cliente[], nombreCliente: string): number {
  const c = clientes.find(x => x.nombre === nombreCliente);
  return c?.capacidadMensual ?? CAPACIDAD_MENSUAL_DEFAULT;
}

// Duración del servicio en meses. Cuando no hay fechas válidas (o el horizonte
// es ambiguo, ej. T&M sin fin), asumimos 1 mes (decisión funcional Exisoft).
export function duracionMesesServicio(s: Servicio): number {
  const ini = parseDate(s.inicio);
  const fin = parseDate(s.fin);
  if (!ini || !fin) return 1;
  const diffMs = fin.getTime() - ini.getTime();
  if (diffMs <= 0) return 1;
  const meses = diffMs / (1000 * 60 * 60 * 24 * 30.4375); // promedio de días/mes
  return Math.max(1, Math.round(meses * 10) / 10);
}

// Cuántas horas de un servicio le corresponden a un (perfil, seniority).
// Si hay desglose `horasPorPerfil`, busca la match exacta. Si no, devuelve
// horasCont / #miembros (split parejo).
function horasParaPerfilEnServicio(
  s: Servicio,
  perfil: string,
  seniority: string,
  miembrosDelEquipo: { perfil: string; seniority: string }[],
): number {
  // Caso 1: hay desglose
  if (s.horasPorPerfil && s.horasPorPerfil.length > 0) {
    const slot = s.horasPorPerfil.find(h =>
      h.perfil.toLowerCase() === perfil.toLowerCase()
      && h.seniority.toLowerCase() === seniority.toLowerCase());
    if (slot) {
      // Si hay N personas en ese mismo slot, reparten en partes iguales.
      const personasEnSlot = miembrosDelEquipo.filter(m =>
        m.perfil.toLowerCase() === perfil.toLowerCase()
        && m.seniority.toLowerCase() === seniority.toLowerCase()).length || 1;
      return slot.horas / personasEnSlot;
    }
    // Perfil no listado: el miembro no debería estar, pero por las dudas, 0.
    return 0;
  }
  // Caso 2: split parejo
  const horasCont = s.horasCont ?? 0;
  const N = Math.max(1, miembrosDelEquipo.length);
  return horasCont / N;
}

// % de asignación calculado automáticamente para un miembro de un servicio.
// Devuelve un entero redondeado.
export function porcentajeAuto(
  s: Servicio,
  perfil: string,
  seniority: string,
  miembrosDelEquipo: { perfil: string; seniority: string }[],
  clientes: Cliente[],
): number {
  const horas = horasParaPerfilEnServicio(s, perfil, seniority, miembrosDelEquipo);
  if (horas <= 0) return 0;
  const meses = duracionMesesServicio(s);
  const capCliente = capacidadMensualCliente(clientes, s.cliente);
  if (meses <= 0 || capCliente <= 0) return 0;
  return Math.round((horas / (meses * capCliente)) * 100);
}

// % efectivo: si la asignación tiene override, lo usa; sino, calcula auto.
export function porcentajeEfectivo(
  asn: AsignacionServicio,
  servicio: Servicio,
  miembrosDelEquipo: { perfil: string; seniority: string }[],
  clientes: Cliente[],
): number {
  if (asn.porcentaje != null && asn.porcentaje > 0) return asn.porcentaje;
  return porcentajeAuto(servicio, asn.perfil, asn.seniority, miembrosDelEquipo, clientes);
}

// Lista los slots (perfil/seniority) de los miembros de un servicio. Útil para calcular
// cómo se reparten las horas de un perfil cuando hay N personas en el mismo slot.
export function miembrosSlotsDe(
  servicioId: number,
  recursos: Recurso[],
): { perfil: string; seniority: string }[] {
  return recursos.flatMap(r => (r.asignaciones || [])
    .filter(a => a.servicioId === servicioId)
    .map(a => ({
      perfil: a.perfil || 'Dev',
      seniority: a.seniority || r.seniorityPrincipal || 'Semi-Sr',
    })));
}

// Carga total efectiva de un recurso (suma de % efectivos de sus asignaciones activas
// en servicios no cerrados). Considera overrides y cálculo automático según corresponda.
export function cargaTotal(
  r: Recurso,
  servicios: Servicio[],
  recursos: Recurso[],
  clientes: Cliente[],
): number {
  let total = 0;
  (r.asignaciones || []).forEach(a => {
    const s = servicios.find(x => x.id === a.servicioId);
    if (!s || s.estado === 'Cerrado') return;
    const slots = miembrosSlotsDe(s.id, recursos);
    total += porcentajeEfectivo(a, s, slots, clientes);
  });
  return total;
}

// ──────────────────────────────────────────────────────────────────────────
// Equipo derivado del servicio — fuente única: PROFESIONAL_SERVICIO
// ──────────────────────────────────────────────────────────────────────────
export interface MiembroEquipo {
  recursoId: number;
  nombre: string;
  perfil: string;
  seniority: string;
  // % efectivo (override si existe, sino calculado). Es lo que las vistas deben mostrar.
  porcentaje: number;
  // % automático calculado (informativo — útil para mostrar "auto vs override").
  porcentajeAuto: number;
  // True si el % efectivo viene de un override manual del PM.
  esOverride: boolean;
  fechaDesde: string;
  fechaHasta: string;
}

// equipoDe puede operar en dos modos:
// - Si se pasan `servicios` y `clientes`, calcula porcentajeAuto/Efectivo correctamente.
// - Si NO se pasan, cae a los overrides manuales (back-compat).
export function equipoDe(
  servicioId: number,
  recursos: Recurso[],
  servicios?: Servicio[],
  clientes?: Cliente[],
): MiembroEquipo[] {
  const servicio = servicios?.find(s => s.id === servicioId);
  // Slots del servicio (todos los perfil/seniority de los miembros) para el split correcto.
  const slots: { perfil: string; seniority: string }[] = [];
  (recursos || []).forEach(r => {
    (r.asignaciones || []).filter(a => a.servicioId === servicioId).forEach(a => {
      slots.push({ perfil: a.perfil || 'Dev', seniority: a.seniority || r.seniorityPrincipal || 'Semi-Sr' });
    });
  });

  const out: MiembroEquipo[] = [];
  (recursos || []).forEach(r => {
    (r.asignaciones || [])
      .filter(a => a && a.servicioId === servicioId)
      .forEach(a => {
        const perfil = a.perfil || 'Dev';
        const seniority = a.seniority || r.seniorityPrincipal || 'Semi-Sr';
        const auto = (servicio && clientes)
          ? porcentajeAuto(servicio, perfil, seniority, slots, clientes)
          : 0;
        const override = a.porcentaje != null && a.porcentaje > 0 ? a.porcentaje : null;
        const efectivo = override ?? auto;
        out.push({
          recursoId: r.id,
          nombre: nombreCompleto(r),
          perfil,
          seniority,
          porcentaje: efectivo,
          porcentajeAuto: auto,
          esOverride: override != null,
          fechaDesde: a.fechaDesde || '',
          fechaHasta: a.fechaHasta || '',
        });
      });
  });
  return out;
}

export function pmsDe(servicioId: number, recursos: Recurso[], servicios?: Servicio[], clientes?: Cliente[]): MiembroEquipo[] {
  return equipoDe(servicioId, recursos, servicios, clientes).filter(m => /PM/i.test(m.perfil));
}
export function ltsDe(servicioId: number, recursos: Recurso[], servicios?: Servicio[], clientes?: Cliente[]): MiembroEquipo[] {
  return equipoDe(servicioId, recursos, servicios, clientes).filter(m => /LT|Arquitect/i.test(m.perfil));
}

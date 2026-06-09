import type {
  Servicio, Recurso, Cliente, EstadoCertificacion, HitoServicio,
  Avance, AsignacionServicio, EstadoAvance, Bloqueo, ModoCertificacion, Tarea, EstadoTarea,
  Perfil, Seniority, TipoContratacion, CategoriaBloqueo,
} from '../types';

// ============================================================
// TABLAS SOPORTE — administrables desde Admin
// ============================================================
const mkSoporte = (nombres: string[], descripciones?: (string | undefined)[]) =>
  nombres.map((n, i) => {
    const d = descripciones?.[i];
    return d ? { id: i + 1, nombre: n, descripcion: d, activo: true } : { id: i + 1, nombre: n, activo: true };
  });

export const PERFILES_SEED: Perfil[] = mkSoporte(
  ['PM', 'LT', 'Arquitecto', 'Dev', 'Funcional', 'QA', 'Infra', 'Otro'],
  ['Project Manager', 'Líder Técnico', 'Arquitecto/a de soluciones', 'Desarrollador/a', 'Analista funcional', 'Quality Assurance', 'Infraestructura', undefined],
);

export const SENIORITIES_SEED: Seniority[] = mkSoporte(
  ['Junior', 'Semi-Sr', 'Senior'],
);

export const TIPOS_CONTRATACION_SEED: TipoContratacion[] = mkSoporte(
  ['Relación de dependencia', 'Monotributo', 'Factura A', 'Subcontratado', 'Honorarios'],
);

export const CATEGORIAS_BLOQUEO_SEED: CategoriaBloqueo[] = mkSoporte(
  ['Cliente', 'Infraestructura', 'Aprobación pendiente', 'Recursos', 'Dependencias externas', 'Otro'],
  ['Depende de acción del cliente', 'Plataforma/red/permisos', 'Esperando OK formal', 'Falta de equipo', 'Otros proveedores/sistemas', undefined],
);

// ============================================================
// Helper: marca el flag de certificación según el modo
// ============================================================
const esCertMensual = (certif: string) =>
  /Mensual|Cert|Fact|mes vencido|Bolsa de horas/i.test(certif);

// Hitos por defecto para servicios llave en mano / proyecto cuando no se
// definen explícitamente. Sirve sólo de ejemplo en el seed.
function hitosDefault(fin: string, horas: number | null): HitoServicio[] {
  if (!fin || fin === '—' || fin === 'TBD') return [
    { id: 1, nombre: 'Kick-off', porcentaje: 30, fechaCert: '', horas: horas ? horas * 0.3 : null, valor: null, cumplido: false },
    { id: 2, nombre: 'Avance funcional', porcentaje: 40, fechaCert: '', horas: horas ? horas * 0.4 : null, valor: null, cumplido: false },
    { id: 3, nombre: 'Cierre', porcentaje: 30, fechaCert: '', horas: horas ? horas * 0.3 : null, valor: null, cumplido: false },
  ];
  return [
    { id: 1, nombre: 'Kick-off',          porcentaje: 30, fechaCert: '',  horas: horas ? horas * 0.3 : null, valor: null, cumplido: true },
    { id: 2, nombre: 'Avance funcional',  porcentaje: 40, fechaCert: '',  horas: horas ? horas * 0.4 : null, valor: null, cumplido: false },
    { id: 3, nombre: 'Cierre / Cert final',porcentaje: 30, fechaCert: fin, horas: horas ? horas * 0.3 : null, valor: null, cumplido: false },
  ];
}

// ============================================================
// SERVICIOS — derivados de "Servicios 18-03-2026.xlsx" + HTML existente
// ============================================================
const serviciosBase: Omit<Servicio, 'modoCertificacion' | 'seguimientoAvances' | 'hitos'>[] = [
  { id:1, cliente:'UNACEM', pais:'PE', nombre:'REQ22 - Squad Analítica (BAC)', tipo:'Horas', estado:'En curso', inicio:'30/03/2026', fin:'15/05/2026', horasCont:557, horasCons:151, horasRest:406, certif:'Fact en Dic 2024', alertas:['Fecha fin próxima'], bloqueos:[], tieneOC:true },
  { id:2, cliente:'UNACEM', pais:'PE', nombre:'REQ41 - Workshops Tecnológicos', tipo:'Llave en mano', estado:'En curso', inicio:'17/11/2025', fin:'05/06/2026', horasCont:468, horasCons:291, horasRest:177, certif:'Fact en Dic 2025', alertas:[], bloqueos:[], tieneOC:true },
  { id:3, cliente:'UNACEM', pais:'PE', nombre:'REQ45 - Portal Unacem (Assessment)', tipo:'Llave en mano', estado:'Cerrado', inicio:'03/12/2025', fin:'26/01/2026', horasCont:300, horasCons:300, horasRest:0, certif:'Fact en Dic 2025', alertas:[], bloqueos:[], tieneOC:true },
  { id:4, cliente:'UNACEM', pais:'PE', nombre:'REQ72 - Azure DevOps', tipo:'Horas', estado:'En curso', inicio:'30/03/2026', fin:'10/07/2026', horasCont:300, horasCons:145, horasRest:155, certif:'Fact en Ene 2026', alertas:[], bloqueos:[], tieneOC:true },
  { id:5, cliente:'UNACEM', pais:'PE', nombre:'REQ77 - Modelo Semántico PBI', tipo:'Horas', estado:'En curso', inicio:'30/03/2026', fin:'10/07/2026', horasCont:312, horasCons:148, horasRest:164, certif:'Mensual (x etapa)', alertas:[], bloqueos:[], tieneOC:true },
  { id:6, cliente:'UNACEM', pais:'PE', nombre:'REQ64 - Watsonx Orchestrate', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'31/03/2025', horasCont:368, horasCons:27, horasRest:341, certif:'Fact en Dic 2025', alertas:['Fecha fin vencida'], bloqueos:[{titulo:'Pruebas unitarias fallidas',desc:'Respuestas incorrectas detectadas.',owner:'UNACEM',estado:'En curso',escalado:false}], tieneOC:true },
  { id:7, cliente:'UNACEM', pais:'PE', nombre:'REQ73 - Migración Theobald', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'—', horasCont:1000, horasCons:56, horasRest:944, certif:'Fact en Ene 2026', alertas:['Bloqueo escalado'], bloqueos:[{titulo:'Falta conexión SAP-AWS',desc:'No se ha podido destrabar.',owner:'UNACEM',estado:'En curso',escalado:true}], tieneOC:true },
  { id:8, cliente:'UNACEM', pais:'PE', nombre:'REQ70 - Relevamiento IA', tipo:'Horas', estado:'En curso', inicio:'—', fin:'27/02/2026', horasCont:132, horasCons:30, horasRest:102, certif:'Fact en Dic 2025', alertas:['Fecha fin vencida','Sin respuesta cliente'], bloqueos:[], tieneOC:true },
  { id:9, cliente:'UNACEM', pais:'PE', nombre:'REQ82 - Despliegue App Pricing', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:108, horasCons:27, horasRest:81, certif:'Hito', alertas:[], bloqueos:[], tieneOC:true },
  { id:10, cliente:'UNACEM', pais:'PE', nombre:'REQ69 - Migración Asistentes WatsonX', tipo:'Horas', estado:'En curso', inicio:'—', fin:'22/05/2026', horasCont:180, horasCons:90, horasRest:90, certif:'Fact en Dic 2025', alertas:[], bloqueos:[], tieneOC:true },
  { id:11, cliente:'UNACEM', pais:'PE', nombre:'REQ63 - Ampliación Squad Analítica', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:218.5, horasCons:218.5, horasRest:0, certif:'Fact en Dic 2025', alertas:['Horas agotadas'], bloqueos:[{titulo:'Calidad de datos históricos',desc:'Irregularidades en datos de molienda.',owner:'E2E',estado:'En curso',escalado:true}], subcontratado:true },
  { id:12, cliente:'UNACEM', pais:'PE', nombre:'REQ66 - Gestión del Cambio Videoanalítica', tipo:'Horas', estado:'En curso', inicio:'—', fin:'TBD', horasCont:452, horasCons:null, horasRest:452, certif:'Fact en Dic 2025', alertas:[], bloqueos:[{titulo:'Demora en respuesta Comunicación Interna',desc:'Se requiere intervención de Alex Motta.',owner:'UNACEM',estado:'Abierto',escalado:false}] },
  { id:13, cliente:'UNACEM', pais:'PE', nombre:'REQ78 - Modelado AS IS UNICOM', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:1760, horasCons:null, horasRest:null, certif:'Mensual', alertas:['Sin horas consumidas reportadas'], bloqueos:[] },
  { id:14, cliente:'UNACEM', pais:'PE', nombre:'REQ79 - Modelado AS IS ARPL', tipo:'Horas', estado:'Cerrado', inicio:'—', fin:'—', horasCont:400, horasCons:400, horasRest:0, certif:'Mensual', alertas:[], bloqueos:[] },
  { id:15, cliente:'UNACEM', pais:'PE', nombre:'REQ80 - Arquitectos BI', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:2536, horasCons:1320, horasRest:1216, certif:'Cert a mes vencido', alertas:[], bloqueos:[], tieneOC:true },
  { id:16, cliente:'UNACEM', pais:'PE', nombre:'REQ85 - Extensión ARPL', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual', alertas:['Sin horas cargadas'], bloqueos:[] },
  { id:17, cliente:'UNACEM', pais:'PE', nombre:'REQ86 - Dashboard consumo PBI', tipo:'Horas', estado:'Cerrado', inicio:'—', fin:'—', horasCont:80, horasCons:80, horasRest:0, certif:'—', alertas:[], bloqueos:[] },
  { id:18, cliente:'UNACEM', pais:'PE', nombre:'REQ87 - Relevamiento RRHH', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:170, horasCons:70.5, horasRest:99.5, certif:'Cert a mes vencido', alertas:['No tiene OC','Mayo 2026 pendiente'], bloqueos:[], tieneOC:false },
  { id:19, cliente:'UNACEM', pais:'PE', nombre:'REQ89 - Provisión BP IT', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:552, horasCons:null, horasRest:null, certif:'Cert a mes vencido', alertas:['Sin horas consumidas'], bloqueos:[] },
  { id:20, cliente:'UNACEM', pais:'PE', nombre:'REQ37 - Gestión Demanda Fase III', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual', alertas:[], bloqueos:[] },
  { id:21, cliente:'UNACEM', pais:'PE', nombre:'REQ55 - Apptio Cloudability', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:80, horasCons:27, horasRest:53, certif:'Fact en Dic 2025', alertas:[], bloqueos:[] },
  { id:22, cliente:'UNACEM', pais:'PE', nombre:'REQ68 - Provisión PM', tipo:'T&M', estado:'Cerrado', inicio:'—', fin:'—', horasCont:504, horasCons:504, horasRest:0, certif:'Cert a mes vencido', alertas:[], bloqueos:[] },
  { id:23, cliente:'Pacasmayo', pais:'PE', nombre:'RPA4 - Licitaciones SEACE', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Hitos', alertas:['Fecha fin próxima','Bloqueo GCP/VM'], bloqueos:[{titulo:'Conexión GCP',desc:'Falta de credenciales.',owner:'Pacasmayo',estado:'En curso',escalado:true},{titulo:'Disponibilidad VM',desc:'Espera infraestructura.',owner:'Pacasmayo',estado:'En curso',escalado:true}], subcontratado:true },
  { id:24, cliente:'SURA AFP Integra', pais:'PE', nombre:'Nuevos Flujos', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'30/04/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Proyecto', alertas:['Fecha fin vencida','Nuevo cronograma'], bloqueos:[{titulo:'Datos de prueba inconsistentes',desc:'Datos no alineados con escenarios reales.',owner:'SURA',estado:'En curso',escalado:false}] },
  { id:25, cliente:'SURA AFP Integra', pais:'PE', nombre:'Terceros Actualizar', tipo:'Horas', estado:'En curso', inicio:'—', fin:'08/05/2026', horasCont:164, horasCons:48, horasRest:116, certif:'Bolsa de horas', alertas:['Fecha fin próxima'], bloqueos:[{titulo:'Coordinación UAT',desc:'Dependencia agenda negocio.',owner:'SURA',estado:'En curso',escalado:false}] },
  { id:26, cliente:'Surco', pais:'PE', nombre:'Asistente Virtual Norma', tipo:'Llave en mano', estado:'En curso', inicio:'25/08/2025', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Hitos (3)', alertas:['Fecha fin crítica','Reprocesamiento arquitectura'], bloqueos:[{titulo:'Reprocesamiento adaptación',desc:'Desarrollos requieren adecuaciones.',owner:'EXISOFT',estado:'En curso',escalado:true},{titulo:'Resultados QA',desc:'Estabilidad sujeta a pruebas funcionales.',owner:'EXISOFT',estado:'En curso',escalado:true}] },
  { id:27, cliente:'Surco', pais:'PE', nombre:'Asistente Virtual Norma — CA', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Hitos (1)', alertas:[], bloqueos:[] },
  { id:28, cliente:'COELSA', pais:'AR', nombre:'Implementación WSO2 API Manager', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Hitos', alertas:['Fecha fin próxima','Certificados pendientes'], bloqueos:[{titulo:'Certificados de seguridad',desc:'Pendiente entrega.',owner:'COELSA',estado:'Abierto',escalado:false},{titulo:'Balanceadores de carga',desc:'Finalización sujeta a entrega de hardware.',owner:'COELSA',estado:'Abierto',escalado:false}] },
  { id:29, cliente:'TECPETROL', pais:'AR', nombre:'Instalación ILMT', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Al finalizar', alertas:['Fecha fin próxima','HW pendiente'], bloqueos:[{titulo:'HW para instalar',desc:'Pendiente entrega del hardware.',owner:'Tecpetrol',estado:'En curso',escalado:false}] },
  { id:30, cliente:'Sancor', pais:'AR', nombre:'Consultoría Técnica', tipo:'Horas', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Pago 100% final', alertas:[], bloqueos:[] },
  { id:31, cliente:'Sancor', pais:'AR', nombre:'Mantenimiento Evolutivo', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:32, cliente:'Sancor', pais:'AR', nombre:'Mantenimiento Prevención Salud', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:33, cliente:'Volkswagen', pais:'AR', nombre:'Mejoras VW', tipo:'Horas', estado:'En curso', inicio:'—', fin:'24/07/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Bolsa de horas', alertas:[], bloqueos:[] },
  { id:34, cliente:'Volkswagen', pais:'AR', nombre:'VW BPM', tipo:'Soporte', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:35, cliente:'Securiport', pais:'AR', nombre:'Integración con Securiport', tipo:'Llave en mano', estado:'En curso', inicio:'—', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Proyecto', alertas:['Fecha fin próxima'], bloqueos:[] },
  { id:36, cliente:'Interbanking', pais:'AR', nombre:'Workshop IBM API Connect', tipo:'Llave en mano', estado:'No iniciado', inicio:'—', fin:'08/05/2026', horasCont:null, horasCons:null, horasRest:null, certif:'Hitos', alertas:['No iniciado','Fecha fin próxima'], bloqueos:[] },
  { id:37, cliente:'Banco Patagonia', pais:'AR', nombre:'Patagonia BPM Desarrollo', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Certificación a mes vencido', alertas:[], bloqueos:[] },
  { id:38, cliente:'Banco Patagonia', pais:'AR', nombre:'Patagonia BPM Infra', tipo:'Soporte', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:39, cliente:'Naranja X', pais:'AR', nombre:'Naranja X', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:40, cliente:'Sierra Gorda', pais:'CH', nombre:'Sierra Gorda Integraciones', tipo:'Soporte', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:41, cliente:'Banco Galicia', pais:'AR', nombre:'Galicia Desarrollador BPM SR', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
  { id:42, cliente:'Banco Galicia', pais:'AR', nombre:'Galicia Java (Jimmi)', tipo:'T&M', estado:'En curso', inicio:'—', fin:'—', horasCont:null, horasCons:null, horasRest:null, certif:'Mensual Gustavo', alertas:[], bloqueos:[] },
];

function derivarModoCert(s: { tipo: string; certif: string }): ModoCertificacion {
  if (s.tipo === 'Llave en mano') return 'Hitos';
  if (esCertMensual(s.certif)) return 'Mensual';
  return 'NoCertifica';
}

export const SERVICIOS_SEED: Servicio[] = serviciosBase.map(s => {
  const esHito = s.tipo === 'Llave en mano';
  const modo = derivarModoCert(s);
  return {
    ...s,
    modoCertificacion: modo,
    seguimientoAvances: esHito,
    hitos: modo === 'Hitos' ? hitosDefault(s.fin, s.horasCont) : [],
  };
});

// Cálculo de certificación mensual a partir del modo de cert + alertas
function calcularCertificaciones(s: Servicio): Record<number, EstadoCertificacion> {
  const cert: Record<number, EstadoCertificacion> = {};
  for (let m = 1; m <= 12; m++) {
    if (s.estado === 'No iniciado') { cert[m] = 'NoAplica'; continue; }
    if (s.estado === 'Cerrado') { cert[m] = m <= 4 ? 'Ok' : 'NoAplica'; continue; }
    const esMensual = /Mensual|Cert|Fact|mes vencido/i.test(s.certif);
    const esHito = /Hito|Proyect|Llave|Proyecto/i.test(s.certif) || s.tipo === 'Llave en mano';
    if (esMensual) cert[m] = m < 5 ? 'Ok' : m === 5 ? 'Pendiente' : 'Proyectado';
    else if (esHito) cert[m] = m <= 4 ? (s.bloqueos.length ? 'Vencido' : 'Ok') : 'Proyectado';
    else cert[m] = m <= 4 ? 'Ok' : m === 5 ? 'Pendiente' : 'NoAplica';
    if (s.alertas?.some(a => /vencid/i.test(a)) && m === 5) cert[m] = 'Vencido';
  }
  return cert;
}
SERVICIOS_SEED.forEach(s => { s.certificaciones = calcularCertificaciones(s); });

// ──────────────────────────────────────────────────────────────────────────
// Desglose de horas por perfil — sembrado en los proyectos de mayor visibilidad
// (los que tienen seguimiento de avances) para demostrar el cálculo automático
// de % de asignación. El resto cae en split parejo de horasCont sobre el equipo.
// ──────────────────────────────────────────────────────────────────────────
const HORAS_POR_PERFIL_SEED: Record<number, { perfil: string; seniority: string; horas: number }[]> = {
  // REQ41 Workshops UNACEM (468hs, 6.5 meses)
  2: [
    { perfil: 'PM', seniority: 'Senior', horas: 80 },
    { perfil: 'LT', seniority: 'Senior', horas: 120 },
    { perfil: 'Dev', seniority: 'Senior', horas: 268 },
  ],
  // REQ73 Migración Theobald UNACEM (1000hs)
  7: [
    { perfil: 'PM', seniority: 'Senior', horas: 150 },
    { perfil: 'Arquitecto', seniority: 'Senior', horas: 250 },
    { perfil: 'Dev', seniority: 'Senior', horas: 600 },
  ],
  // RPA SEACE Pacasmayo (id 23) — horas no claras, usamos split parejo
  // Asistente Virtual Norma Surco (id 26)
  26: [
    { perfil: 'PM', seniority: 'Senior', horas: 60 },
    { perfil: 'Dev', seniority: 'Senior', horas: 240 },
  ],
  // WSO2 API Manager COELSA (id 28)
  28: [
    { perfil: 'PM', seniority: 'Senior', horas: 50 },
    { perfil: 'Arquitecto', seniority: 'Senior', horas: 120 },
    { perfil: 'Infra', seniority: 'Senior', horas: 180 },
  ],
  // ILMT Tecpetrol (id 29) — sin horas cargadas, dejamos sin desglose
};
SERVICIOS_SEED.forEach(s => {
  const desglose = HORAS_POR_PERFIL_SEED[s.id];
  if (desglose) s.horasPorPerfil = desglose;
});

// ============================================================
// PROFESIONALES — espejo dbo.PROFESIONAL + asignaciones por servicio
// ============================================================
// Helper de asignación. El % se guarda como override manual (lo que hoy hay
// cargado a mano en la planilla histórica). Para los servicios con `horasPorPerfil`
// sembrado, el PM puede limpiar el override con el botón ↺ y ver el cálculo auto.
const a = (servicioId: number, porcentaje: number, perfil = 'Dev', seniority = 'Senior'): AsignacionServicio => ({
  servicioId, porcentaje, perfil, seniority,
  fechaDesde: '01/01/2026', fechaHasta: '',
});

export const RECURSOS_SEED: Recurso[] = [
  { id:1, legajo:'EXI-0001', nombre:'Damián', apellido:'Faccini',
    fechaIngreso:'15/03/2018', fechaNacimiento:'12/06/1985', dni:'30123456', cuit:'20301234567',
    mail:'dfaccini@exisoft.com', mailPersonal:'damian.faccini@gmail.com', telefono:'+541155551001',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Av. Corrientes', dirNumero:'1234', dirPisoDto:'5B', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    personaContacto:'María Faccini', telContacto:'+541155551002',
    perfilPrincipal:'LT / Arquitecto', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(1,30,'LT','Senior'), a(2,15,'LT','Senior'), a(4,15,'LT','Senior'), a(7,25,'LT','Senior'), a(39,10,'LT','Senior') ],
  },
  { id:2, legajo:'EXI-0002', nombre:'Florencia', apellido:'de San Félix',
    fechaIngreso:'01/07/2019', fechaNacimiento:'22/02/1988', dni:'33111222', cuit:'27331112223',
    mail:'fsanfelix@exisoft.com', mailPersonal:'flordsf@gmail.com', telefono:'+541155551101',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Av. Cabildo', dirNumero:'2350', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'PM', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(1,15,'PM','Senior'), a(2,20,'PM','Senior'), a(4,15,'PM','Senior'), a(5,20,'PM','Senior'), a(29,15,'PM','Senior'), a(36,15,'PM','Senior') ],
  },
  { id:3, legajo:'EXI-0003', nombre:'Johan', apellido:'Malave',
    fechaIngreso:'05/05/2020', fechaNacimiento:'10/11/1984', dni:'29555111', cuit:'20295551112',
    mail:'jmalave@exisoft.com', mailPersonal:'johan.malave@outlook.com', telefono:'+541155551201',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Belgrano', dirNumero:'880', dirCiudad:'Lomas de Zamora', dirProvincia:'Buenos Aires', dirPais:'AR',
    perfilPrincipal:'PM', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(6,20,'PM','Senior'), a(7,20,'PM','Senior'), a(8,15,'PM','Senior'), a(9,15,'PM','Senior'), a(33,15,'PM','Senior'), a(30,15,'PM','Senior') ],
  },
  { id:4, legajo:'EXI-0004', nombre:'Gustavo', apellido:'Vivaldo',
    fechaIngreso:'11/01/2017', fechaNacimiento:'03/08/1982', dni:'27444333', cuit:'20274443334',
    mail:'gvivaldo@exisoft.com', mailPersonal:'gvivaldo@gmail.com', telefono:'+541155551301',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Rivadavia', dirNumero:'4520', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'PM', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(11,15,'PM','Senior'), a(23,20,'PM','Senior'), a(24,15,'PM','Senior'), a(25,15,'PM','Senior'), a(26,20,'PM','Senior'), a(35,15,'PM','Senior') ],
  },
  { id:5, legajo:'EXI-0005', nombre:'Daniel', apellido:'García',
    fechaIngreso:'12/09/2019', fechaNacimiento:'07/04/1986', dni:'31222111', cuit:'20312221110',
    mail:'dgarcia@exisoft.com', mailPersonal:'dgarcia86@gmail.com', telefono:'+541155551401',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Mendoza', dirNumero:'1500', dirCiudad:'Rosario', dirProvincia:'Santa Fe', dirPais:'AR',
    perfilPrincipal:'PM', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(3,15,'PM','Senior'), a(12,20,'PM','Senior'), a(13,20,'PM','Senior'), a(14,15,'PM','Senior'), a(28,20,'PM','Senior') ],
  },
  { id:6, legajo:'EXI-0006', nombre:'Douglas', apellido:'Leekam',
    fechaIngreso:'20/04/2018', fechaNacimiento:'15/09/1983', dni:'28666555', cuit:'20286665557',
    mail:'dleekam@exisoft.com', mailPersonal:'dleekam@gmail.com', telefono:'+541155551501',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'San Martín', dirNumero:'3210', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'LT / Arquitecto', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(2,15,'LT','Senior'), a(6,20,'LT','Senior'), a(10,20,'LT','Senior'), a(24,15,'LT','Senior'), a(25,15,'LT','Senior'), a(26,25,'LT','Senior') ],
    alerta:'Sobreasignado',
  },
  { id:7, legajo:'EXI-0007', nombre:'Javier', apellido:'Gomes Solis',
    fechaIngreso:'02/02/2020', fechaNacimiento:'19/12/1987', dni:'32777666', cuit:'20327776665',
    mail:'jgomes@exisoft.com', mailPersonal:'jgomes87@gmail.com', telefono:'+5114111101',
    tipoContratacion:'Monotributo', estadoLaboral:'Activo',
    dirCalle:'Av. Arequipa', dirNumero:'1200', dirCiudad:'Lima', dirProvincia:'Lima', dirPais:'PE',
    perfilPrincipal:'LT Data / DevOps', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(5,35,'LT','Senior'), a(4,25,'LT','Senior'), a(7,25,'LT','Senior') ],
  },
  { id:8, legajo:'EXI-0008', nombre:'Cristian', apellido:'Aravena',
    fechaIngreso:'10/08/2021', fechaNacimiento:'05/01/1989', dni:'34111000', cuit:'20341110008',
    mail:'caravena@exisoft.com', mailPersonal:'cris.aravena@gmail.com', telefono:'+541155551701',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Av. de Mayo', dirNumero:'600', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Arquitecto / Dev', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(8,50,'Arquitecto','Senior'), a(4,30,'Dev','Senior') ],
  },
  { id:9, legajo:'EXI-0009', nombre:'Mariano', apellido:'Silvapobas',
    fechaIngreso:'18/06/2018', fechaNacimiento:'30/03/1981', dni:'26999888', cuit:'20269998886',
    mail:'msilvapobas@exisoft.com', mailPersonal:'mariano.sp@gmail.com', telefono:'+541155551801',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Las Heras', dirNumero:'2010', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'PM / Arquitecto', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(10,45,'PM','Senior'), a(21,30,'PM','Senior') ],
  },
  { id:10, legajo:'EXI-0010', nombre:'Arturo', apellido:'Perea',
    fechaIngreso:'01/03/2019', fechaNacimiento:'21/07/1985', dni:'30222111', cuit:'20302221115',
    mail:'aperea@exisoft.com', mailPersonal:'arturo.perea@gmail.com', telefono:'+541155551901',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Lavalle', dirNumero:'750', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Producto / Arq', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(28,55,'Arquitecto','Senior'), a(30,35,'Arquitecto','Senior') ],
  },
  { id:11, legajo:'EXI-0011', nombre:'Diego', apellido:'Pérez',
    fechaIngreso:'05/05/2017', fechaNacimiento:'12/12/1980', dni:'25111000', cuit:'20251110005',
    mail:'dperez@exisoft.com', mailPersonal:'dperez@gmail.com', telefono:'+541155552001',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Maipú', dirNumero:'430', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Arquitecto SAP', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(28,40,'Arquitecto SAP','Senior'), a(13,30,'Arquitecto SAP','Senior'), a(14,30,'Arquitecto SAP','Senior') ],
  },
  { id:12, legajo:'EXI-0012', nombre:'Gustavo', apellido:'Santos',
    fechaIngreso:'13/10/2019', fechaNacimiento:'09/06/1984', dni:'29333222', cuit:'20293332220',
    mail:'gsantos@exisoft.com', mailPersonal:'gsantos84@gmail.com', telefono:'+541155552101',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Sarmiento', dirNumero:'1500', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Funcional SAP', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(13,50,'Funcional SAP','Senior'), a(14,50,'Funcional SAP','Senior') ],
  },
  { id:13, legajo:'SUB-0001', nombre:'Leonardo', apellido:'Romero',
    fechaIngreso:'01/01/2024', fechaNacimiento:'17/05/1990', dni:'35888777', cuit:'20358887778',
    mail:'lromero@subcontrata.com', mailPersonal:'lromero@gmail.com', telefono:'+541155552201',
    tipoContratacion:'Subcontratado (PartnerX)', estadoLaboral:'Activo',
    dirCalle:'Mitre', dirNumero:'200', dirCiudad:'La Plata', dirProvincia:'Buenos Aires', dirPais:'AR',
    perfilPrincipal:'RPA Dev', seniorityPrincipal:'Semi-Sr', subcontratado:true,
    asignaciones:[ a(23,90,'RPA Dev','Semi-Sr') ],
    alerta:'Subcontratado',
  },
  { id:14, legajo:'EXI-0014', nombre:'Matías', apellido:'Casanova',
    fechaIngreso:'02/02/2022', fechaNacimiento:'25/11/1991', dni:'36555444', cuit:'20365554443',
    mail:'mcasanova@exisoft.com', mailPersonal:'mcasanova@gmail.com', telefono:'+541155552301',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Esmeralda', dirNumero:'910', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'BPM Dev', seniorityPrincipal:'Semi-Sr', subcontratado:false,
    asignaciones:[ a(25,30,'Dev','Semi-Sr'), a(41,20,'Dev','Semi-Sr') ],
    alerta:'Disponible 50%',
  },
  { id:15, legajo:'EXI-0015', nombre:'Susana', apellido:'Huenchuman',
    fechaIngreso:'19/09/2020', fechaNacimiento:'14/04/1986', dni:'30700111', cuit:'27307001114',
    mail:'shuenchuman@exisoft.com', mailPersonal:'shuenchuman@gmail.com', telefono:'+541155552401',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Belgrano', dirNumero:'150', dirCiudad:'Bariloche', dirProvincia:'Río Negro', dirPais:'AR',
    perfilPrincipal:'LT VW', seniorityPrincipal:'Semi-Sr', subcontratado:false,
    asignaciones:[ a(33,60,'LT','Semi-Sr') ],
    alerta:'Disponible 40%',
  },
  { id:16, legajo:'EXI-0016', nombre:'Fernando', apellido:'Montellano',
    fechaIngreso:'07/07/2019', fechaNacimiento:'02/10/1983', dni:'28000999', cuit:'20280009990',
    mail:'fmontellano@exisoft.com', mailPersonal:'fmontellano@gmail.com', telefono:'+541155552501',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Pueyrredón', dirNumero:'1700', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Infra / ILMT', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[ a(29,40,'Infra','Senior'), a(35,30,'Infra','Senior') ],
    alerta:'Disponible 30%',
  },
  { id:17, legajo:'SUB-0002', nombre:'E2E', apellido:'Subcontrata',
    fechaIngreso:'01/01/2023', fechaNacimiento:'01/01/1980', dni:'00000000', cuit:'30700000007',
    mail:'contacto@e2e.com', mailPersonal:'', telefono:'+51999000000',
    tipoContratacion:'Subcontratado (E2E)', estadoLaboral:'Activo',
    dirCalle:'Av. Javier Prado', dirNumero:'4500', dirCiudad:'Lima', dirProvincia:'Lima', dirPais:'PE',
    perfilPrincipal:'Científico de Datos', seniorityPrincipal:'Senior', subcontratado:true,
    asignaciones:[ a(11,100,'Data Scientist','Senior') ],
    alerta:'Subcontratado',
  },
  { id:18, legajo:'EXI-0018', nombre:'Lany', apellido:'Rojas',
    fechaIngreso:'01/04/2022', fechaNacimiento:'08/07/1992', dni:'37222111', cuit:'27372221117',
    mail:'lrojas@exisoft.com', mailPersonal:'lanyrojas@gmail.com', telefono:'+541155552601',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Florida', dirNumero:'500', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Arquitecta / Data', seniorityPrincipal:'Senior', subcontratado:false,
    asignaciones:[],
    alerta:'Bench',
  },
  { id:19, legajo:'EXI-0019', nombre:'Jonathan', apellido:'Vera',
    fechaIngreso:'15/09/2022', fechaNacimiento:'30/11/1990', dni:'35666111', cuit:'20356661118',
    mail:'jvera@exisoft.com', mailPersonal:'jonathan.vera@gmail.com', telefono:'+541155552701',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Tucumán', dirNumero:'850', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Técnico / RBAC', seniorityPrincipal:'Semi-Sr', subcontratado:false,
    asignaciones:[],
    alerta:'Bench',
  },
  { id:20, legajo:'EXI-0020', nombre:'Joaquín', apellido:'Vasquez',
    fechaIngreso:'02/01/2024', fechaNacimiento:'14/02/1998', dni:'42111000', cuit:'20421110009',
    mail:'jvasquez@exisoft.com', mailPersonal:'joaquin.vasquez@gmail.com', telefono:'+541155552801',
    tipoContratacion:'Relación de Dependencia', estadoLaboral:'Activo',
    dirCalle:'Brasil', dirNumero:'1100', dirCiudad:'CABA', dirProvincia:'CABA', dirPais:'AR',
    perfilPrincipal:'Dev Front', seniorityPrincipal:'Junior', subcontratado:false,
    asignaciones:[],
    alerta:'Bench',
  },
];

// ============================================================
// CLIENTES — derivados de SERVICIOS al alta del seed.
// Algunos clientes tienen capacidadMensual custom (ej. UNACEM trabaja 168hs/mes).
// El resto cae en el default (160). El usuario puede editarlo desde la vista Clientes.
// ============================================================
const CAPACIDAD_CUSTOM: Record<string, number> = {
  'UNACEM': 168,   // jornada de 8.4hs (mercado peruano corporativo)
};
const _clientes = new Map<string, Cliente>();
SERVICIOS_SEED.forEach((s, i) => {
  if (!_clientes.has(s.cliente)) {
    const cap = CAPACIDAD_CUSTOM[s.cliente];
    _clientes.set(s.cliente, {
      id: i + 1,
      nombre: s.cliente,
      pais: s.pais,
      ...(cap ? { capacidadMensual: cap } : {}),
    });
  }
});
export const CLIENTES_SEED: Cliente[] = Array.from(_clientes.values());

// ============================================================
// AVANCES SEMANALES — tabla independiente (dbo.AVANCE).
// Cada registro = un avance semanal de un proyecto. La gráfica de evolución
// se arma con todos los avances de un servicioId ordenados por fechaSemana.
// ============================================================

// Genera N pulsos semanales hacia atrás para un servicio.
// MODELO NUEVO: cada pulso lleva estado + motivo (si AT/OFF) + comentario + pctAvanceGlobal.
// Los snapshots de tareas (tareasCompletadas/atrasadas) quedan vacíos en el seed:
// son retrospectivos por definición y los pulsos reales los completan al cargarse.
// Los bloqueos NO van en el avance — son propiedad del Servicio (ya están en SERVICIOS_SEED).
type AvanceTemplate = {
  servicioId: number;
  autor: string;
  comentarioBase: string;
  motivoBase?: string;        // motivo por defecto cuando el estado es AT/OFF
  evolucion: {
    semana: string;
    estado: EstadoAvance;
    pct: number;               // % avance global del proyecto al cierre de esa semana
    comentario?: string;       // override del comentario base si la semana lo amerita
    motivo?: string;            // override del motivo base
  }[];
};

let _avId = 1;
function generarAvances(tpl: AvanceTemplate): Avance[] {
  return tpl.evolucion.map(ev => {
    const av: Avance = {
      id: _avId++,
      servicioId: tpl.servicioId,
      fechaSemana: ev.semana,
      autor: tpl.autor,
      fechaCarga: ev.semana,
      estado: ev.estado,
      pctAvanceGlobal: ev.pct,
      comentario: ev.comentario ?? tpl.comentarioBase,
      tareasCompletadas: [],
      tareasAtrasadas: [],
    };
    if (ev.estado !== 'ON-TRACK') {
      av.motivoEstado = ev.motivo ?? tpl.motivoBase;
    }
    return av;
  });
}

const TEMPLATES: AvanceTemplate[] = [
  // RPA4 - Licitaciones SEACE (Pacasmayo) — id 23 — OFF-TRACK con deterioro
  {
    servicioId: 23,
    autor: 'Gustavo Vivaldo',
    comentarioBase: 'Proyecto avanza pero con bloqueos de infra del lado del cliente (conexión GCP, disponibilidad VM).',
    motivoBase: 'Bloqueos de infraestructura cliente (GCP + VM) sin destrabar.',
    evolucion: [
      { semana: '20/04/2026', estado: 'AT-RISK',   pct: 48 },
      { semana: '27/04/2026', estado: 'AT-RISK',   pct: 55, comentario: 'Pruebas iniciales con datos mock; persisten bloqueos de infra.' },
      { semana: '04/05/2026', estado: 'OFF-TRACK', pct: 55, comentario: 'Conexión GCP sigue trabada. Se solicita escalación.' },
      { semana: '11/05/2026', estado: 'OFF-TRACK', pct: 55, comentario: 'Sin avance esta semana por bloqueos infra. Se requiere escalación a Dirección Pacasmayo.' },
    ],
  },
  // Surco - Asistente Virtual Norma — id 26 — AT-RISK estable
  {
    servicioId: 26,
    autor: 'Gustavo Vivaldo',
    comentarioBase: 'Adecuaciones técnicas para producción introdujeron retrabajo. Riesgo controlado.',
    motivoBase: 'Reprocesamiento de adaptación para nueva arquitectura productiva.',
    evolucion: [
      { semana: '20/04/2026', estado: 'ON-TRACK', pct: 45 },
      { semana: '27/04/2026', estado: 'AT-RISK',  pct: 50, comentario: 'Flujos básicos liberados en pre-prod; aparecen adecuaciones de arquitectura.' },
      { semana: '04/05/2026', estado: 'AT-RISK',  pct: 58 },
      { semana: '11/05/2026', estado: 'AT-RISK',  pct: 65 },
    ],
  },
  // COELSA - WSO2 API Manager — id 28 — AT-RISK por dependencias
  {
    servicioId: 28,
    autor: 'Daniel García',
    comentarioBase: 'Dependencia fuerte de entregas del cliente (certificados, balanceadores).',
    motivoBase: 'Pendiente entrega de certificados de seguridad y balanceadores por parte de COELSA.',
    evolucion: [
      { semana: '20/04/2026', estado: 'ON-TRACK', pct: 50, comentario: 'Diseño de políticas iniciales completado.' },
      { semana: '27/04/2026', estado: 'ON-TRACK', pct: 58 },
      { semana: '04/05/2026', estado: 'AT-RISK',  pct: 60 },
      { semana: '11/05/2026', estado: 'AT-RISK',  pct: 60 },
    ],
  },
  // REQ41 - Workshops Tecnológicos (UNACEM) — id 2 — ON-TRACK
  {
    servicioId: 2,
    autor: 'Florencia de San Félix',
    comentarioBase: 'Avance según lo planificado. Workshops 1 a 3 completados; queda WS4 (arquitectura cloud) y cierre.',
    evolucion: [
      { semana: '20/04/2026', estado: 'ON-TRACK', pct: 42 },
      { semana: '27/04/2026', estado: 'ON-TRACK', pct: 52 },
      { semana: '04/05/2026', estado: 'ON-TRACK', pct: 60 },
      { semana: '11/05/2026', estado: 'ON-TRACK', pct: 65 },
    ],
  },
  // TECPETROL - ILMT — id 29 — AT-RISK por HW
  {
    servicioId: 29,
    autor: 'Florencia de San Félix',
    comentarioBase: 'Instalación detenida hasta entrega de hardware por parte del cliente.',
    motivoBase: 'HW pendiente de entrega; sin equipo no podemos avanzar con la instalación.',
    evolucion: [
      { semana: '20/04/2026', estado: 'ON-TRACK', pct: 55 },
      { semana: '27/04/2026', estado: 'AT-RISK',  pct: 62 },
      { semana: '04/05/2026', estado: 'AT-RISK',  pct: 68 },
      { semana: '11/05/2026', estado: 'AT-RISK',  pct: 70 },
    ],
  },
  // REQ73 - Migración Theobald (UNACEM) — id 7 — recientemente OFF
  {
    servicioId: 7,
    autor: 'Johan Malave',
    comentarioBase: 'Bloqueo de conectividad SAP-AWS pendiente de respuesta del cliente.',
    motivoBase: 'Falta conectividad SAP-AWS, escalado sin respuesta.',
    evolucion: [
      { semana: '20/04/2026', estado: 'ON-TRACK', pct: 18 },
      { semana: '27/04/2026', estado: 'AT-RISK',  pct: 22 },
      { semana: '04/05/2026', estado: 'OFF-TRACK',pct: 25 },
      { semana: '11/05/2026', estado: 'OFF-TRACK',pct: 28, comentario: 'Bloqueo activo desde hace 3 semanas sin respuesta del cliente.' },
    ],
  },
];

export const AVANCES_SEED: Avance[] = TEMPLATES.flatMap(generarAvances);

// ============================================================
// MACROPLAN — tareas de ejemplo para los proyectos seguidos
// (los demás proyectos quedan sin tareas hasta que el PM las cargue)
// ============================================================
let _tareaId = 1;
function t(servicioId: number, orden: number, nombre: string, responsableId: number | undefined, inicio: string, fin: string,
           estado: EstadoTarea, fechaFinReal?: string, hitoId?: number): Tarea {
  return {
    id: _tareaId++, servicioId, orden, nombre,
    responsableId, fechaInicioPlan: inicio, fechaFinPlan: fin, estado, fechaFinReal, hitoId,
  };
}

export const TAREAS_SEED: Tarea[] = [
  // RPA4 Pacasmayo (servicio 23) — proyecto con desvíos
  t(23, 1, 'Relevamiento y diseño funcional',         4,  '06/04/2026', '17/04/2026', 'Completada', '17/04/2026'),
  t(23, 2, 'Modelado del flujo RPA principal',        13, '20/04/2026', '01/05/2026', 'Completada', '01/05/2026'),
  t(23, 3, 'Integración con repositorio GCP',         13, '04/05/2026', '15/05/2026', 'Bloqueada'),
  t(23, 4, 'Pruebas con datos productivos',           13, '18/05/2026', '29/05/2026', 'Pendiente'),
  t(23, 5, 'UAT con Pacasmayo',                       4,  '01/06/2026', '08/06/2026', 'Pendiente'),
  t(23, 6, 'Despliegue a producción',                 13, '09/06/2026', '12/06/2026', 'Pendiente'),
  // Surco - Asistente Norma (servicio 26)
  t(26, 1, 'Diseño del modelo de NLP',                6,  '15/03/2026', '03/04/2026', 'Completada', '03/04/2026'),
  t(26, 2, 'Integración del motor NLP',               6,  '06/04/2026', '24/04/2026', 'Completada', '24/04/2026'),
  t(26, 3, 'Flujos básicos en preproducción',         6,  '27/04/2026', '08/05/2026', 'Completada', '08/05/2026'),
  t(26, 4, 'Adecuación arquitectura producción',      6,  '11/05/2026', '22/05/2026', 'En curso'),
  t(26, 5, 'Pruebas QA estabilidad',                  6,  '25/05/2026', '05/06/2026', 'Pendiente'),
  t(26, 6, 'Go-live asistido',                        4,  '08/06/2026', '12/06/2026', 'Pendiente'),
  // COELSA WSO2 (servicio 28)
  t(28, 1, 'Instalación en ambiente DEV',             10, '13/04/2026', '24/04/2026', 'Completada', '24/04/2026'),
  t(28, 2, 'Configuración políticas iniciales',       10, '27/04/2026', '08/05/2026', 'Completada', '08/05/2026'),
  t(28, 3, 'Recibir certificados de seguridad',       undefined, '11/05/2026', '22/05/2026', 'Bloqueada'),
  t(28, 4, 'Configurar balanceadores de carga',       11, '25/05/2026', '05/06/2026', 'Pendiente'),
  t(28, 5, 'Pruebas integradas DEV→PRE',              10, '08/06/2026', '19/06/2026', 'Pendiente'),
  t(28, 6, 'Pase a producción',                       10, '22/06/2026', '26/06/2026', 'Pendiente'),
  // REQ41 Workshops (servicio 2) — ON-TRACK
  t(2, 1, 'Workshop 1 - Fundamentos cloud',           2,  '17/11/2025', '21/11/2025', 'Completada', '21/11/2025'),
  t(2, 2, 'Workshop 2 - Arquitectura distribuida',    2,  '01/12/2025', '05/12/2025', 'Completada', '05/12/2025'),
  t(2, 3, 'Workshop 3 - DevOps avanzado',             1,  '12/01/2026', '16/01/2026', 'Completada', '16/01/2026'),
  t(2, 4, 'Workshop 4 - Arquitectura cloud',          7,  '11/05/2026', '15/05/2026', 'En curso'),
  t(2, 5, 'Workshop 5 - Cierre',                      1,  '01/06/2026', '05/06/2026', 'Pendiente'),
  t(2, 6, 'Entrega de materiales y certificados',     2,  '08/06/2026', '12/06/2026', 'Pendiente'),
  // TECPETROL ILMT (servicio 29) — AT-RISK
  t(29, 1, 'Plan de instalación aprobado',            16, '13/04/2026', '17/04/2026', 'Completada', '17/04/2026'),
  t(29, 2, 'Configuración de pre-requisitos',         16, '20/04/2026', '01/05/2026', 'Completada', '01/05/2026'),
  t(29, 3, 'Recepción de HW',                         undefined, '04/05/2026', '08/05/2026', 'Bloqueada'),
  t(29, 4, 'Instalación ILMT',                        16, '11/05/2026', '22/05/2026', 'Pendiente'),
  t(29, 5, 'Validación con compliance',               2,  '25/05/2026', '05/06/2026', 'Pendiente'),
];

// Denormalizar nombres de responsables para que se muestren rápidamente
TAREAS_SEED.forEach(tarea => {
  if (tarea.responsableId) {
    const r = RECURSOS_SEED.find(x => x.id === tarea.responsableId);
    if (r) tarea.responsableNombre = `${r.nombre} ${r.apellido}`;
  }
});

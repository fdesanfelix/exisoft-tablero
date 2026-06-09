import { useEffect, useState } from 'react';
import type {
  Servicio, Recurso, UsuarioSesion, Avance, Tarea, Cliente,
  Perfil, Seniority, TipoContratacion, CategoriaBloqueo,
} from '../types';
import {
  SERVICIOS_SEED, RECURSOS_SEED, AVANCES_SEED, TAREAS_SEED, CLIENTES_SEED,
  PERFILES_SEED, SENIORITIES_SEED, TIPOS_CONTRATACION_SEED, CATEGORIAS_BLOQUEO_SEED,
} from './seed';

const KEY = 'exisoft-tablero-v11';
const SESSION_KEY = 'exisoft-sesion';
const OLD_KEYS = ['exisoft-tablero-v1', 'exisoft-tablero-v2', 'exisoft-tablero-v3', 'exisoft-tablero-v4', 'exisoft-tablero-v5', 'exisoft-tablero-v6', 'exisoft-tablero-v7', 'exisoft-tablero-v8', 'exisoft-tablero-v9', 'exisoft-tablero-v10'];

interface PersistedState {
  servicios: Servicio[];
  recursos: Recurso[];
  avances: Avance[];
  tareas: Tarea[];
  clientes: Cliente[];
  perfiles: Perfil[];
  seniorities: Seniority[];
  tiposContratacion: TipoContratacion[];
  categoriasBloqueo: CategoriaBloqueo[];
}

// Migraciones suaves: si una versión anterior del dump no tenía alguna colección
// nueva (clientes, perfiles, etc.), la sembramos. La data del usuario se preserva.
function migrar(parsed: Partial<PersistedState>): PersistedState {
  if (!parsed.clientes) parsed.clientes = JSON.parse(JSON.stringify(CLIENTES_SEED));
  if (!parsed.perfiles) parsed.perfiles = JSON.parse(JSON.stringify(PERFILES_SEED));
  if (!parsed.seniorities) parsed.seniorities = JSON.parse(JSON.stringify(SENIORITIES_SEED));
  if (!parsed.tiposContratacion) parsed.tiposContratacion = JSON.parse(JSON.stringify(TIPOS_CONTRATACION_SEED));
  if (!parsed.categoriasBloqueo) parsed.categoriasBloqueo = JSON.parse(JSON.stringify(CATEGORIAS_BLOQUEO_SEED));
  return parsed as PersistedState;
}

function load(): PersistedState {
  // 1) Versión actual
  try {
    const s = localStorage.getItem(KEY);
    if (s) return migrar(JSON.parse(s) as Partial<PersistedState>);
  } catch {}

  // 2) Fallback: buscar en versiones anteriores (de la más reciente a la más vieja)
  // para preservar la data del usuario aunque hayamos bumpeado el storage.
  for (const oldKey of [...OLD_KEYS].reverse()) {
    try {
      const s = localStorage.getItem(oldKey);
      if (s) {
        const migrated = migrar(JSON.parse(s) as Partial<PersistedState>);
        // Persistimos en la nueva versión así no migramos cada vez.
        localStorage.setItem(KEY, JSON.stringify(migrated));
        // Y limpiamos la vieja (los datos ya viven en la nueva).
        localStorage.removeItem(oldKey);
        // eslint-disable-next-line no-console
        console.info(`[Exisoft] Datos migrados de ${oldKey} → ${KEY}`);
        return migrated;
      }
    } catch {}
  }

  // 3) Install limpio: sembramos todo.
  return {
    servicios: JSON.parse(JSON.stringify(SERVICIOS_SEED)),
    recursos: JSON.parse(JSON.stringify(RECURSOS_SEED)),
    avances: JSON.parse(JSON.stringify(AVANCES_SEED)),
    tareas: JSON.parse(JSON.stringify(TAREAS_SEED)),
    clientes: JSON.parse(JSON.stringify(CLIENTES_SEED)),
    perfiles: JSON.parse(JSON.stringify(PERFILES_SEED)),
    seniorities: JSON.parse(JSON.stringify(SENIORITIES_SEED)),
    tiposContratacion: JSON.parse(JSON.stringify(TIPOS_CONTRATACION_SEED)),
    categoriasBloqueo: JSON.parse(JSON.stringify(CATEGORIAS_BLOQUEO_SEED)),
  };
}

function save(s: PersistedState) { localStorage.setItem(KEY, JSON.stringify(s)); }

export function resetSeed() {
  localStorage.removeItem(KEY);
  OLD_KEYS.forEach(k => localStorage.removeItem(k));
  location.reload();
}

export function useStore() {
  const [state, setState] = useState<PersistedState>(() => load());
  useEffect(() => { save(state); }, [state]);

  return {
    servicios: state.servicios,
    recursos: state.recursos,
    avances: state.avances,
    tareas: state.tareas,
    clientes: state.clientes,
    perfiles: state.perfiles,
    seniorities: state.seniorities,
    tiposContratacion: state.tiposContratacion,
    categoriasBloqueo: state.categoriasBloqueo,

    upsertCliente(c: Cliente) {
      setState(prev => {
        const i = prev.clientes.findIndex(x => x.id === c.id);
        const next = [...prev.clientes];
        if (i >= 0) next[i] = c; else next.push(c);
        return { ...prev, clientes: next };
      });
    },
    deleteCliente(id: number) {
      setState(prev => ({ ...prev, clientes: prev.clientes.filter(x => x.id !== id) }));
    },

    upsertPerfil(p: Perfil) {
      setState(prev => {
        const i = prev.perfiles.findIndex(x => x.id === p.id);
        const next = [...prev.perfiles];
        if (i >= 0) next[i] = p; else next.push(p);
        return { ...prev, perfiles: next };
      });
    },
    deletePerfil(id: number) {
      setState(prev => ({ ...prev, perfiles: prev.perfiles.filter(x => x.id !== id) }));
    },

    upsertSeniority(s: Seniority) {
      setState(prev => {
        const i = prev.seniorities.findIndex(x => x.id === s.id);
        const next = [...prev.seniorities];
        if (i >= 0) next[i] = s; else next.push(s);
        return { ...prev, seniorities: next };
      });
    },
    deleteSeniority(id: number) {
      setState(prev => ({ ...prev, seniorities: prev.seniorities.filter(x => x.id !== id) }));
    },

    upsertTipoContratacion(t: TipoContratacion) {
      setState(prev => {
        const i = prev.tiposContratacion.findIndex(x => x.id === t.id);
        const next = [...prev.tiposContratacion];
        if (i >= 0) next[i] = t; else next.push(t);
        return { ...prev, tiposContratacion: next };
      });
    },
    deleteTipoContratacion(id: number) {
      setState(prev => ({ ...prev, tiposContratacion: prev.tiposContratacion.filter(x => x.id !== id) }));
    },

    upsertCategoriaBloqueo(c: CategoriaBloqueo) {
      setState(prev => {
        const i = prev.categoriasBloqueo.findIndex(x => x.id === c.id);
        const next = [...prev.categoriasBloqueo];
        if (i >= 0) next[i] = c; else next.push(c);
        return { ...prev, categoriasBloqueo: next };
      });
    },
    deleteCategoriaBloqueo(id: number) {
      setState(prev => ({ ...prev, categoriasBloqueo: prev.categoriasBloqueo.filter(x => x.id !== id) }));
    },

    upsertServicio(s: Servicio) {
      setState(prev => {
        const i = prev.servicios.findIndex(x => x.id === s.id);
        const next = [...prev.servicios];
        if (i >= 0) next[i] = s; else next.push(s);
        return { ...prev, servicios: next };
      });
    },
    deleteServicio(id: number) {
      setState(prev => ({
        ...prev,
        servicios: prev.servicios.filter(x => x.id !== id),
        avances: prev.avances.filter(a => a.servicioId !== id),
        tareas: prev.tareas.filter(t => t.servicioId !== id),
        recursos: prev.recursos.map(r => ({
          ...r,
          asignaciones: r.asignaciones.filter(a => a.servicioId !== id),
        })),
      }));
    },

    upsertRecurso(r: Recurso) {
      setState(prev => {
        const i = prev.recursos.findIndex(x => x.id === r.id);
        const next = [...prev.recursos];
        if (i >= 0) next[i] = r; else next.push(r);
        return { ...prev, recursos: next };
      });
    },
    deleteRecurso(id: number) {
      setState(prev => ({ ...prev, recursos: prev.recursos.filter(x => x.id !== id) }));
    },

    upsertAvance(a: Avance) {
      setState(prev => {
        const i = prev.avances.findIndex(x => x.id === a.id);
        const next = [...prev.avances];
        if (i >= 0) next[i] = a; else next.push(a);
        return { ...prev, avances: next };
      });
    },
    deleteAvance(id: number) {
      setState(prev => ({ ...prev, avances: prev.avances.filter(x => x.id !== id) }));
    },

    upsertTarea(t: Tarea) {
      setState(prev => {
        const i = prev.tareas.findIndex(x => x.id === t.id);
        const next = [...prev.tareas];
        if (i >= 0) next[i] = t; else next.push(t);
        return { ...prev, tareas: next };
      });
    },
    deleteTarea(id: number) {
      setState(prev => ({ ...prev, tareas: prev.tareas.filter(x => x.id !== id) }));
    },
    // Importación masiva (Excel/CSV pegado)
    bulkUpsertTareas(items: Tarea[]) {
      setState(prev => {
        const byId = new Map<number, Tarea>(prev.tareas.map(t => [t.id, t]));
        items.forEach(t => byId.set(t.id, t));
        return { ...prev, tareas: Array.from(byId.values()) };
      });
    },
  };
}

export function loadSesion(): UsuarioSesion | null {
  try { const s = localStorage.getItem(SESSION_KEY); if (s) return JSON.parse(s); } catch {}
  return null;
}
export function saveSesion(u: UsuarioSesion | null) {
  if (u) localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  else localStorage.removeItem(SESSION_KEY);
}

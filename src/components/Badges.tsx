import type { Pais, TipoServicio, EstadoServicio } from '../types';

export function PaisBadge({ pais }: { pais: Pais }) {
  const cls = pais === 'PE' ? 'pe' : 'arg';
  return <span className={`badge ${cls}`}>{pais}</span>;
}

export function TipoBadge({ tipo }: { tipo: TipoServicio }) {
  const map: Record<TipoServicio, string> = {
    'Soporte': 'soporte',
    'Llave en mano': 'llave',
    'T&M': 'tm',
    'Horas': 'horas',
  };
  return <span className={`badge ${map[tipo] || 'arg'}`}>{tipo}</span>;
}

export function EstadoBadge({ estado }: { estado: EstadoServicio }) {
  // Semaforización por estado del ciclo de vida:
  //   - En curso        → verde (activo y saludable)
  //   - No iniciado     → amarillo suave (en espera)
  //   - En pausa        → naranja (suspendido)
  //   - Cerrado por PM  → azul (pendiente de validación de Gerencia)
  //   - Cerrado         → gris (definitivamente terminado, neutral)
  const cls =
    estado === 'En curso' ? 'on'
    : estado === 'No iniciado' ? 'no-iniciado'
    : estado === 'En pausa' ? 'at'
    : estado === 'Cerrado por PM' ? 'cons'
    : 'neutro';      // Cerrado
  return <span className={`badge ${cls}`}>{estado}</span>;
}

export function CertPill({ certif }: { certif: string }) {
  const cls = /Ok|Cert|Fact/i.test(certif) ? 'ok'
            : /Hito|Proy/i.test(certif) ? 'proy'
            : 'pend';
  return <span className={`pill ${cls}`}>{certif || '—'}</span>;
}

# Exisoft — Tablero de Control de Servicios

Prototipo navegable del tablero centralizado de servicios para Gerencia, PMs, Comerciales y Dirección.

## Stack

- Vite + React 18 + TypeScript
- CSS plano siguiendo el manual de marca Exisoft (naranja `#EB7221`, grises corporativos, Inter + JetBrains Mono)
- localStorage como persistencia del prototipo (fase 1)
- Pensado para conectar a Node/Express + SQL Server en fase 2 (ver `server/README.md`)

## Cómo correr

```bash
cd exisoft-tablero
npm install
npm run dev      # http://localhost:5173
npm run build    # bundle de producción en /dist
npm run preview  # servir el build
```

## Vistas

| Vista | Responde a |
|---|---|
| **Resumen** | KPIs ejecutivos, distribución por país/tipo, top clientes, atajos por rol |
| **Servicios** | Tabla con filtros por país/tipo/estado, horas contratadas vs consumidas, certif., alertas. ABM con modal |
| **Certificaciones** | Calendario mensual 12 meses por servicio (Ok/Pendiente/Proyectado/Vencido/NA), KPI del mes en curso, detalle e hitos |
| **Recursos** | Cards por profesional, % asignación cliente vs real, seniority, servicios, bench, subcontratados. ABM |
| **Hitos** | Próximos vencimientos de proyectos llave en mano y proyectos |
| **Clientes** | Vista por cliente con sus servicios, horas y alertas |
| **Avances Proyectos** | Barras On/At/Off por cliente, bloqueos escalados, fechas críticas de 15 días |
| **Alertas** | Bloqueos, horas agotándose ≥80%, certificaciones vencidas y sin OC |

## Roles (mock)

El `LoginGate` pide nombre y rol. Roles disponibles: PM, Comercial, Gerencia de Servicios, Director de Servicios.
El rol **Comercial** ve sólo lectura (no aparecen botones de ABM en Servicios/Recursos).

## Datos

- `src/data/seed.ts` — 42 servicios + 20 recursos extraídos de:
  - `Servicios 18-03-2026.xlsx`
  - `Informe de Certificaciones por mes.xlsx`
  - El HTML de referencia provisto
- `src/types.ts` — tipos TS con anotaciones de equivalencia con tablas de `ExiServicios.sql`
- Para limpiar el storage y volver al seed: en consola del navegador `localStorage.removeItem('exisoft-tablero-v1'); location.reload()`.

## Estructura

```
src/
  main.tsx, App.tsx, styles.css, types.ts
  auth/LoginGate.tsx
  data/seed.ts, storage.ts
  components/  Logo, KPI, Modal, Badges, Toast
  views/  Resumen, Servicios, ServicioModal, Certificaciones,
          Recursos, Hitos, Clientes, Avances, Alertas
```

## Próxima fase — Backend Node/Express + SQL Server

Ver `server/README.md` para el diseño de las APIs y las tablas nuevas (CERTIFICACION_MENSUAL, SERVICIO_HORAS, BLOQUEO, OC, ALERTA, USUARIO) que extienden el modelo actual de `ExiServicios.sql`.

## Despliegue cloud (objetivo fase 2)

- Front: Azure Static Web Apps / Vercel
- Backend: Azure App Service (Node) o AWS App Runner
- DB: SQL Server (Azure SQL o instancia existente de Exisoft)
- Auth: Microsoft Entra ID (SSO Exisoft) o Auth0

## Marca

Tokens en `:root` de `styles.css` siguen el manual de marca Exisoft (`Exisoft_Manual de marca_digital_0723.pdf`):

- Naranja primario: `#EB7221`
- Gris dark: `#424243`
- Tipografía UI: Inter (400/500/600/700/800)
- Tipografía datos: JetBrains Mono

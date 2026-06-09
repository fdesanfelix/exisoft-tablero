# Backend — Exisoft Tablero (fase 2)

Stub de la API REST que reemplazará el localStorage del prototipo. Se conecta a la base existente `ExiServicios` (SQL Server).

## Stack sugerido

- Node 20 + Express + TypeScript
- `mssql` para SQL Server
- Auth: JWT verificado contra Microsoft Entra ID (SSO de Exisoft)
- Hosting: Azure App Service / AWS App Runner

## Endpoints

```
GET    /api/servicios                 lista paginada con filtros (pais, tipo, estado, cliente, q)
GET    /api/servicios/:id             detalle (con bloqueos, hitos, asignaciones)
POST   /api/servicios                 alta
PUT    /api/servicios/:id             modificación
DELETE /api/servicios/:id             baja lógica (sio_activo = 0)

GET    /api/clientes
GET    /api/clientes/:id/servicios

GET    /api/profesionales             lista con asignaciones agregadas
PUT    /api/profesionales/:id/asignacion  alta/baja de asignación a un servicio

GET    /api/hitos                     próximos vencimientos
GET    /api/certificaciones?year=2026 grilla mensual

GET    /api/alertas                   feed unificado
POST   /api/bloqueos                  alta de bloqueo
PUT    /api/bloqueos/:id

POST   /api/horas                     timesheet (carga de horas)

GET    /api/me                        sesión actual
```

## Modelo de datos extendido

Tablas **existentes** que se reutilizan (de `ExiServicios.sql`):
- `dbo.CLIENTE` — `cte_id`, `cte_nombre`, `cte_pis_id`
- `dbo.PAIS` — `pis_id`, `pis_nombre`
- `dbo.SERVICIO` — `sio_id`, `sio_nombre`, `sio_cte_id`, `sio_tco_id`, `sio_fecha_inicio`, `sio_fecha_fin`, `sio_ds` (Director de Servicio), `sio_activo`, `sio_deriva_servicio_de`
- `dbo.TIPO_CONTRATO` — `tco_id`, `tco_tipo_contrato`
- `dbo.HITO` — `hto_id`, `hto_sio_id`, `hto_nombre`, `hto_fecha`, `hito_horas`, `hto_valor`
- `dbo.PROFESIONAL` — `pal_id`, etc.
- `dbo.PROFESIONAL_SERVICIO` — `pso_id_profesional`, `pso_id_servicio`, `pso_porcentaje_asignacion_cte`, `pso_porcentaje_asignacion_real`, `pso_pil_id`, `pso_sty_id`, `pso_fecha_desde`, `pso_fecha_hasta`
- `dbo.SENIORITY`, `dbo.PERFIL`

Tablas **nuevas** a sumar:

```sql
-- Estado operativo y operación del servicio (más allá de sio_activo)
ALTER TABLE dbo.SERVICIO ADD
  sio_estado_operativo varchar(20) NULL,   -- 'En curso', 'No iniciado', 'En pausa', 'Finalizado'
  sio_subcontratado bit NOT NULL DEFAULT 0;

-- Snapshot semanal de horas (reemplaza la planilla Servicios 18-03-2026.xlsx)
CREATE TABLE dbo.SERVICIO_HORAS (
  sho_id int IDENTITY(1,1) PRIMARY KEY,
  sho_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  sho_fecha date NOT NULL,
  sho_horas_contratadas float NULL,
  sho_horas_consumidas float NULL,
  sho_horas_restantes AS (sho_horas_contratadas - sho_horas_consumidas)
);

-- Estado mensual de certificación (reemplaza Informe de Certificaciones por mes.xlsx)
CREATE TABLE dbo.CERTIFICACION_MENSUAL (
  cmm_id int IDENTITY(1,1) PRIMARY KEY,
  cmm_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  cmm_anio int NOT NULL,
  cmm_mes int NOT NULL,
  cmm_estado varchar(15) NOT NULL,    -- 'Ok','Pendiente','Vencido','Proyectado','NoAplica'
  cmm_monto money NULL,
  cmm_comentario nvarchar(500) NULL,
  CONSTRAINT UQ_CMM UNIQUE (cmm_sio_id, cmm_anio, cmm_mes)
);

-- Órdenes de compra
CREATE TABLE dbo.OC (
  oc_id int IDENTITY(1,1) PRIMARY KEY,
  oc_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  oc_numero varchar(50) NOT NULL,
  oc_fecha date NOT NULL,
  oc_monto money NULL,
  oc_estado varchar(20) NOT NULL       -- 'Vigente','Consumida','Vencida'
);

-- Bloqueos (con escalación)
CREATE TABLE dbo.BLOQUEO (
  blo_id int IDENTITY(1,1) PRIMARY KEY,
  blo_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  blo_titulo nvarchar(200) NOT NULL,
  blo_descripcion nvarchar(2000) NULL,
  blo_owner varchar(100) NULL,
  blo_estado varchar(20) NOT NULL,     -- 'Abierto','En curso','Cerrado'
  blo_escalado bit NOT NULL DEFAULT 0,
  blo_fecha_apertura datetime NOT NULL DEFAULT GETDATE(),
  blo_fecha_cierre datetime NULL
);

-- Carga de horas (timesheet) — reemplaza Freedcamp
CREATE TABLE dbo.CARGA_HORAS (
  cho_id int IDENTITY(1,1) PRIMARY KEY,
  cho_pal_id int NOT NULL FOREIGN KEY REFERENCES dbo.PROFESIONAL(pal_id),
  cho_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  cho_fecha date NOT NULL,
  cho_horas float NOT NULL,
  cho_descripcion nvarchar(500) NULL
);

-- Informes de avance (los que adjunta el HTML de avances)
CREATE TABLE dbo.INFORME_AVANCE (
  iao_id int IDENTITY(1,1) PRIMARY KEY,
  iao_sio_id int NOT NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  iao_fecha date NOT NULL,
  iao_estado varchar(15) NOT NULL,     -- 'OnTrack','AtRisk','OffTrack'
  iao_comentario nvarchar(max) NULL,
  iao_publicado bit NOT NULL DEFAULT 0
);

-- Subcontratos (recursos o servicios externos)
CREATE TABLE dbo.SUBCONTRATO (
  sbc_id int IDENTITY(1,1) PRIMARY KEY,
  sbc_sio_id int NULL FOREIGN KEY REFERENCES dbo.SERVICIO(sio_id),
  sbc_pal_id int NULL FOREIGN KEY REFERENCES dbo.PROFESIONAL(pal_id),
  sbc_proveedor varchar(100) NOT NULL,
  sbc_costo money NULL,
  sbc_fecha_inicio date NULL,
  sbc_fecha_fin date NULL
);

-- Usuarios del tablero y rol
CREATE TABLE dbo.USUARIO (
  usr_id int IDENTITY(1,1) PRIMARY KEY,
  usr_email varchar(150) NOT NULL UNIQUE,
  usr_pal_id int NULL FOREIGN KEY REFERENCES dbo.PROFESIONAL(pal_id),
  usr_rol varchar(30) NOT NULL,        -- 'PM','Comercial','GerenciaServicios','DirectorServicios'
  usr_activo bit NOT NULL DEFAULT 1
);
```

## ETL de planillas existentes → SQL

- `Servicios 18-03-2026.xlsx` (hoja "Servicios 02-03-2026 v2") → `SERVICIO` (alta de las nuevas) + `SERVICIO_HORAS` (snapshot)
- `Informe de Certificaciones por mes.xlsx` (hoja "2026") → `CERTIFICACION_MENSUAL`
- Documentos de propuesta técnica (ej. `ExiSoft_02_REQ87_Relevamiento_Escenarios_Extraccion_RRHH (Propuesta Técnica).pdf`) → carpeta documental enlazada al servicio (campo nuevo `sio_url_propuesta`)
- Freedcamp → `CARGA_HORAS` (export CSV o API)

## Roadmap fase 2

1. Levantar `server/` con Express + `mssql`, conectar a `ExiServicios`
2. Migración SQL con las tablas nuevas
3. ETL idempotente para las 3 planillas
4. Reemplazar `useStore()` del frontend por `fetch` contra `/api/*`
5. SSO con Entra ID
6. Despliegue Azure (Static Web App + App Service + Azure SQL)

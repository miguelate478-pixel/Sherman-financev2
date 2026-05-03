# Sherman Finance Control AI v2.0

Sistema enterprise de automatización contable peruana con SUNAT/SIRE real, parser XML UBL 2.1, clasificación IA y exportación a CONCAR SQL.

## ⚡ Setup en 3 comandos

```bash
npm install
npx prisma db push
node prisma/seed.cjs
npm run dev
```

→ Abrir **http://localhost:3000**

## 🔑 Usuarios demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Administrador | admin@empresa.pe | Admin123! |
| Contador | mruiz@empresa.pe | Demo1234! |
| Supervisor | jlopez@empresa.pe | Demo1234! |
| Auditor | aaudit@empresa.pe | Demo1234! |

## 📋 Módulos implementados (20)

1. Dashboard Ejecutivo — KPIs + gráficos Recharts
2. Centro SUNAT/SIRE — Consulta Integrada + SIRE
3. Descarga Masiva SUNAT — Jobs por período + parser XML real + IA
4. Jobs y Procesos — Historial de jobs con períodos
5. Compras — Tabla avanzada con filtros
6. Ventas — Tabla avanzada con filtros
7. Documentos XML/PDF/CDR — Con estado parser + IA
8. Bandeja Contable — Workflow completo
9. Bancos — Movimientos + gráfico saldo
10. Conciliación — (próximo)
11. Cuentas por Cobrar — CxC con estados
12. Cuentas por Pagar — CxP con estados
13. Detracciones — Depósitos + alertas
14. Reportes — Gráficos + top proveedores
15. Copiloto IA — Consultas sobre BD real
16. CONCAR SQL — Test + schema + lotes + aprobación
17. Empresas / RUC — CRUD + credenciales SOL cifradas
18. Usuarios y Roles — JWT + bcrypt + MFA flag
19. Auditoría — Log persistente BD
20. Configuración — .env + providers + roadmap

## 🏗 Stack

- **Next.js 15** + **React 19** + **TypeScript**
- **Tailwind CSS** (tokens CSS inline para máximo control)
- **Prisma ORM** + **SQLite** (dev) / **PostgreSQL** (prod)
- **JWT (jose)** + **bcrypt** + **AES-256-GCM**
- **Parser XML UBL 2.1** (xml2js)
- **Recharts** para gráficos
- **Providers pattern**: Mock ↔ Direct (SUNAT), Mock ↔ SqlServer (CONCAR), Mock ↔ OpenAI (IA)

## 🔌 Conectar SUNAT real

1. Obtener credenciales en SOL → Empresas → Credenciales API SUNAT
2. En `.env.local`:
```
SUNAT_PROVIDER=direct
SUNAT_CLIENT_ID=tu_client_id
SUNAT_CLIENT_SECRET=tu_client_secret
```

## 🔌 Conectar CONCAR SQL Server

```
CONCAR_PROVIDER=sqlserver
CONCAR_SQL_SERVER=tu_servidor
CONCAR_SQL_DATABASE=CONCAR_EMPRESA01
CONCAR_SQL_USER=app_readonly
CONCAR_SQL_PASSWORD=tu_password
```

## 🗄 Ver BD

```bash
npx prisma studio  # → http://localhost:5555
```

## 📡 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | /api/auth/login | JWT login |
| GET  | /api/auth/me | Verificar token |
| GET/POST | /api/companies | Empresas |
| GET/PATCH | /api/documents | Comprobantes |
| POST/GET | /api/sunat/bulk-download | Descarga masiva + jobs |
| POST | /api/sunat/validate | Consulta Integrada SUNAT |
| POST/GET | /api/concar | Test, schema, export, batches |
| GET/POST/PATCH | /api/users | Usuarios |
| GET/PATCH | /api/banks | Bancos |
| GET/PATCH | /api/detracciones | Detracciones |
| GET/POST | /api/audit | Auditoría |
| GET | /api/cxc | Cuentas por Cobrar |
| GET | /api/cxp | Cuentas por Pagar |

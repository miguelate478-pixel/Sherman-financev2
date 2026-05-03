# 🚀 GUÍA DE DESPLIEGUE A PRODUCCIÓN
# Sherman Finance Control AI v2.0

---

## OPCIÓN A — Railway (Recomendado, más fácil)
**Costo: ~$10-20/mes · PostgreSQL incluido · Deploy en 5 min**

### 1. Preparar repositorio
```bash
git init && git add . && git commit -m "Sherman Finance v2.0"
# Subir a GitHub/GitLab
```

### 2. Crear proyecto en Railway
1. railway.app → New Project → Deploy from GitHub
2. Seleccionar tu repositorio
3. Railway detecta Next.js automáticamente

### 3. Agregar PostgreSQL
En Railway → Add Service → PostgreSQL
Copiar el `DATABASE_URL` que te da Railway

### 4. Variables de entorno en Railway
```
DATABASE_URL=postgresql://user:pass@host/dbname   ← de Railway
JWT_SECRET=tu-secreto-64-chars-random
ENCRYPTION_KEY=exactamente-32-caracteres-!!
SUNAT_PROVIDER=direct                              ← cuando tengas credenciales
SUNAT_CLIENT_ID=tu-client-id
SUNAT_CLIENT_SECRET=tu-client-secret
NEXT_PUBLIC_SUNAT_MODE=direct
CONCAR_PROVIDER=mock                               ← cambiar a sqlserver cuando conectes
STORAGE_PATH=/app/storage
AI_PROVIDER=mock
```

### 5. Script de arranque en Railway
En `package.json` ya tienes:
```json
"start": "next start"
```
Railway usa `npm run build` + `npm start` automáticamente.

### 6. Migración de base de datos
```bash
# En la consola de Railway o en tu máquina con DATABASE_URL apuntando a prod:
psql $DATABASE_URL -f scripts/migrate-to-postgres.sql
node --experimental-sqlite scripts/seed-db.js  # ← solo para datos demo iniciales
```

---

## OPCIÓN B — Vercel + Turso (Gratis para empezar)
**Costo: $0 inicio · Next.js nativo · Turso = SQLite cloud**

### 1. Crear base de datos Turso (gratis)
```bash
npm install -g turso
turso auth login
turso db create sherman-finance
turso db tokens create sherman-finance
# Guardar: libsql://xxx.turso.io y el token
```

### 2. Deploy en Vercel
```bash
npm install -g vercel
vercel
# Seguir instrucciones
```

### 3. Variables en Vercel
```
DATABASE_URL=libsql://sherman-finance-xxx.turso.io
TURSO_AUTH_TOKEN=tu-token
JWT_SECRET=...
ENCRYPTION_KEY=...
SUNAT_PROVIDER=direct
SUNAT_CLIENT_ID=...
SUNAT_CLIENT_SECRET=...
NEXT_PUBLIC_SUNAT_MODE=direct
```

### 4. Migrar DB a Turso
```bash
turso db shell sherman-finance < scripts/init-turso.sql
```

---

## OPCIÓN C — VPS propio (DigitalOcean/Hostinger)
**Costo: $6-12/mes · Control total · SQLite simple**

```bash
# En el servidor (Ubuntu 22.04+)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash
sudo apt install -y nodejs nginx

# Clonar/subir tu proyecto
cd /home && git clone tu-repo sherman-finance
cd sherman-finance
npm install
cp .env.example .env.local
# Editar .env.local con tus datos reales

# Crear BD
node --experimental-sqlite scripts/init-db.js
node --experimental-sqlite scripts/seed-db.js  # solo primera vez

# Build
npm run build

# Iniciar con PM2
npm install -g pm2
pm2 start "npm start" --name sherman-finance
pm2 save && pm2 startup

# Nginx proxy
sudo nano /etc/nginx/sites-available/sherman
```

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/sherman /etc/nginx/sites-enabled/
sudo certbot --nginx -d tu-dominio.com    # SSL gratis con Let's Encrypt
sudo systemctl reload nginx
```

---

## PASOS COMUNES (para cualquier opción)

### Generar secretos seguros
```bash
# JWT_SECRET (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY (exactamente 32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### Activar SUNAT real
1. Entrar a SOL → Empresas → Operaciones en Línea → Credenciales API SUNAT
2. Registrar aplicación → copiar `client_id` y `client_secret`
3. Agregar al `.env`:
   ```
   SUNAT_PROVIDER=direct
   SUNAT_CLIENT_ID=tu_client_id
   SUNAT_CLIENT_SECRET=tu_client_secret
   ```
4. En el sistema → Empresas → agregar tu empresa con RUC real
5. Centro SUNAT → ingresar usuario SOL + clave SOL → "Probar vs SUNAT"

### Activar CONCAR SQL (opcional)
```
CONCAR_PROVIDER=sqlserver
CONCAR_SQL_SERVER=tu-servidor
CONCAR_SQL_DATABASE=CONCAR_EMPRESA01
CONCAR_SQL_USER=usuario_readonly
CONCAR_SQL_PASSWORD=contraseña
npm install mssql
```

---

## CHECKLIST ANTES DE LANZAR

- [ ] JWT_SECRET cambiado (min 32 chars, aleatorio)
- [ ] ENCRYPTION_KEY cambiado (exactamente 32 chars)
- [ ] SUNAT_CLIENT_ID y CLIENT_SECRET configurados
- [ ] Credenciales SOL por empresa configuradas y probadas
- [ ] HTTPS activado (SSL/TLS)
- [ ] Base de datos en producción (no SQLite local si hay múltiples usuarios)
- [ ] Storage persistente configurado (S3 o volumen montado)
- [ ] Backup automático configurado
- [ ] Usuarios reales creados (eliminar demo si no los necesitas)
- [ ] Dominio apuntando al servidor

---

## PRECIO SUGERIDO PARA CLIENTES

| Plan | Precio/mes | Incluye |
|------|-----------|---------|
| Starter | S/ 490 | 1 empresa, SUNAT mock, soporte básico |
| Business | S/ 990 | 3 empresas, SUNAT real, CONCAR SQL, soporte |
| Enterprise | S/ 1,990 | Ilimitado, IA real, hosting incluido, SLA |
| Implementación | S/ 3,500 | Setup + capacitación + 1 mes soporte |

**Mercado objetivo:** Estudios contables medianos (5-50 empresas cliente), empresas con 50-500 facturas/mes.

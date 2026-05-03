# GUÍA COMPLETA DE DESPLIEGUE A PRODUCCIÓN
# Sherman Finance Control AI v2.0
# =========================================

## OPCIÓN A — RAILWAY (Recomendado — 45 minutos, ~$15/mes)

Railway es la opción más fácil: detecta Next.js automáticamente, 
incluye PostgreSQL, y hace deploy automático desde GitHub.

---

### PASO 1: Preparar tu máquina local

Instalar Git si no lo tienes:
```
https://git-scm.com/downloads
```

Verificar:
```bash
git --version    # debe decir git 2.x
node --version   # debe decir v18 o superior
```

---

### PASO 2: Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre: `sherman-finance`
3. Privado: ✓ (marca Private)
4. NO marques "Initialize repository"
5. Clic "Create repository"

Luego en tu terminal:
```bash
cd sherman-finance-v2

git init
git add .
git commit -m "Sherman Finance Control AI v2.0 - initial"

git remote add origin https://github.com/TU_USUARIO/sherman-finance.git
git push -u origin main
```

> Reemplaza TU_USUARIO con tu usuario de GitHub.

---

### PASO 3: Crear cuenta en Railway

1. Ve a https://railway.app
2. Clic "Start a New Project"
3. Sign in with GitHub (autoriza Railway)

---

### PASO 4: Crear proyecto en Railway

1. Dashboard Railway → "New Project"
2. "Deploy from GitHub repo"
3. Selecciona `sherman-finance`
4. Railway detecta Next.js automáticamente

---

### PASO 5: Agregar base de datos PostgreSQL

1. En tu proyecto Railway → "+ New"
2. "Database" → "PostgreSQL"
3. Railway crea la BD y genera `DATABASE_URL`
4. Clic en el servicio PostgreSQL → "Variables"
5. Copia el valor de `DATABASE_URL` (lo necesitarás)

---

### PASO 6: Configurar variables de entorno

En Railway → tu servicio Next.js → "Variables" → agrega:

```
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:PORT/railway
(pegar la URL que copiaste del paso 5)

JWT_SECRET=2a0656b23866e1e14279f96af6c21cc65ece90c0fb670eb3669f1227d73cd56d
ENCRYPTION_KEY=bb4f5e5af1df234f587ec0439e9c95c9

SUNAT_PROVIDER=mock
NEXT_PUBLIC_SUNAT_MODE=mock

CONCAR_PROVIDER=mock
AI_PROVIDER=mock

STORAGE_PATH=/app/storage
APP_URL=https://TU-APP.railway.app
NODE_ENV=production
```

> IMPORTANTE: Cambia JWT_SECRET y ENCRYPTION_KEY por valores únicos.
> Genera nuevos en tu terminal:
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

---

### PASO 7: Migrar la base de datos a PostgreSQL

La app actual usa SQLite. Para Railway necesitas PostgreSQL.

**Opción A (más fácil): Mantener SQLite en Railway**
Si solo tienes 1 instancia (suficiente para empezar), puedes usar SQLite
con un volumen persistente en Railway.

En Railway → tu servicio → "Volumes" → "Mount a volume":
- Mount path: `/app/data`

Agrega variable: `DATABASE_URL=file:/app/data/sherman.db`

Luego agregar script de inicio en Railway → Settings → "Start Command":
```
node --experimental-sqlite scripts/init-db.js && node --experimental-sqlite scripts/seed-db.js && npm start
```

**Opción B: PostgreSQL (recomendado para producción real)**
Ver sección "MIGRACION A POSTGRESQL" más abajo.

---

### PASO 8: Deploy

Railway hace deploy automáticamente al hacer push a GitHub:
```bash
git push origin main
```

Ver el build en Railway → Deployments → logs en tiempo real.

---

### PASO 9: Verificar que funciona

1. Railway te da URL: `https://tu-app.railway.app`
2. Ve a `https://tu-app.railway.app/landing` — debe ver la landing page
3. Ve a `https://tu-app.railway.app/dashboard` — debe ver el login
4. Login con: `admin@empresa.pe` / `Admin123!`

---

## OPCIÓN B — VPS PROPIO ($6-12/mes, control total)

Ideal si quieres dominio personalizado y control completo.

### Proveedores recomendados:
- DigitalOcean: $6/mes, Ubuntu 22.04, fácil de configurar
- Hostinger: desde $3/mes, soporte en español
- Contabo: buena relación precio/recursos

### PASO 1: Crear servidor Ubuntu 22.04

En tu proveedor VPS, crea un servidor con:
- Sistema: Ubuntu 22.04 LTS
- RAM: mínimo 1GB (2GB recomendado)
- Disco: 25GB mínimo

### PASO 2: Conectar por SSH

```bash
ssh root@IP_DE_TU_SERVIDOR
```

### PASO 3: Instalar Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash
sudo apt install -y nodejs

node --version  # debe decir v22.x
```

### PASO 4: Instalar PM2 (mantiene la app corriendo)

```bash
npm install -g pm2
```

### PASO 5: Instalar Nginx (proxy reverso)

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### PASO 6: Subir tu proyecto al servidor

**Opción A — Desde GitHub:**
```bash
cd /home
git clone https://github.com/TU_USUARIO/sherman-finance.git
cd sherman-finance
```

**Opción B — Desde tu máquina (sin GitHub):**
```bash
# En tu máquina local:
scp -r /ruta/a/sherman-finance-v2 root@IP_SERVIDOR:/home/sherman-finance
ssh root@IP_SERVIDOR
cd /home/sherman-finance
```

### PASO 7: Instalar dependencias y configurar

```bash
npm install
```

Crear archivo de entorno:
```bash
nano .env.local
```

Pegar y editar:
```env
DATABASE_URL="file:/home/sherman-finance/data/sherman.db"
JWT_SECRET="GENERA_UNO_NUEVO_CON_EL_COMANDO_DE_ABAJO"
ENCRYPTION_KEY="GENERA_UNO_NUEVO_16_BYTES_HEX"
SUNAT_PROVIDER=mock
NEXT_PUBLIC_SUNAT_MODE=mock
CONCAR_PROVIDER=mock
AI_PROVIDER=mock
STORAGE_PATH=/home/sherman-finance/storage
APP_URL=https://TU_DOMINIO.com
NODE_ENV=production
```

Generar secretos:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # para JWT_SECRET
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"  # para ENCRYPTION_KEY
```

### PASO 8: Crear directorios y base de datos

```bash
mkdir -p /home/sherman-finance/data
mkdir -p /home/sherman-finance/storage/sunat

# Inicializar BD
node --experimental-sqlite scripts/init-db.js

# Cargar datos demo (solo primera vez)
node --experimental-sqlite scripts/seed-db.js
```

### PASO 9: Hacer el build

```bash
npm run build
```

### PASO 10: Iniciar con PM2

```bash
pm2 start "npm start" --name sherman-finance --cwd /home/sherman-finance
pm2 save
pm2 startup  # seguir las instrucciones que da este comando
```

Verificar:
```bash
pm2 status
pm2 logs sherman-finance
```

### PASO 11: Configurar Nginx

```bash
sudo nano /etc/nginx/sites-available/sherman
```

Pegar:
```nginx
server {
    listen 80;
    server_name TU_DOMINIO.com www.TU_DOMINIO.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50m;
    }
}
```

Activar:
```bash
sudo ln -s /etc/nginx/sites-available/sherman /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### PASO 12: SSL gratuito (HTTPS)

Si tienes dominio apuntando al servidor:
```bash
sudo certbot --nginx -d TU_DOMINIO.com -d www.TU_DOMINIO.com
```

Certbot configura HTTPS automáticamente. Se renueva solo cada 90 días.

---

## MIGRACIÓN A POSTGRESQL (Producción avanzada)

Si tienes varios usuarios simultáneos o necesitas más robustez.

### PASO 1: Instalar PostgreSQL

**En servidor Ubuntu:**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql

sudo -u postgres psql
CREATE DATABASE sherman_finance;
CREATE USER sherman WITH PASSWORD 'PASSWORD_SEGURO';
GRANT ALL PRIVILEGES ON DATABASE sherman_finance TO sherman;
\q
```

**O usar servicio cloud:**
- Supabase: https://supabase.com (gratis 500MB)
- Railway PostgreSQL (como vimos arriba)
- Neon: https://neon.tech (gratis 512MB)

### PASO 2: Ejecutar script de migración

```bash
# Con variable de entorno apuntando a PostgreSQL:
PGPASSWORD=TU_PASSWORD psql -h localhost -U sherman -d sherman_finance -f scripts/migrate-to-postgres.sql
```

### PASO 3: Instalar driver PostgreSQL

```bash
npm install pg @types/pg
```

### PASO 4: Actualizar DATABASE_URL

```env
DATABASE_URL=postgresql://sherman:PASSWORD@localhost:5432/sherman_finance
```

### PASO 5: Actualizar db.ts para PostgreSQL

El archivo src/lib/db.ts usa @libsql/client que solo soporta SQLite/libsql.
Para PostgreSQL necesitas reemplazarlo por `pg`:

```bash
# El archivo scripts/migrate-to-postgres.sql ya tiene el schema completo
# Adaptar db.ts para usar pg es trabajo adicional de ~2h
```

> RECOMENDACIÓN: Para empezar, usa SQLite con Turso cloud (opción más fácil)
> o SQLite en VPS con backup diario. Es suficiente para 1-10 estudios contables.

---

## TURSO — SQLite Cloud (Mejor opción para empezar)

Turso es SQLite en la nube. Compatible 100% con el código actual (usa @libsql/client).

### PASO 1: Instalar CLI

```bash
npm install -g @turso/cli
```

### PASO 2: Crear cuenta y BD

```bash
turso auth login    # abre el navegador
turso db create sherman-finance
turso db show sherman-finance   # copia la URL: libsql://xxx.turso.io
turso db tokens create sherman-finance   # copia el token
```

### PASO 3: Migrar datos

```bash
# Exportar datos locales a Turso
turso db shell sherman-finance < scripts/init-db.sql

# O usar el script de Node:
TURSO_URL="libsql://xxx.turso.io" TURSO_TOKEN="tu-token" node --experimental-sqlite scripts/migrate-to-turso.js
```

### PASO 4: Variables en producción

```env
DATABASE_URL=libsql://sherman-finance-xxx.turso.io
TURSO_AUTH_TOKEN=tu-token-aqui
```

### PASO 5: Actualizar db.ts para Turso

```typescript
// En src/lib/db.ts, cambiar:
_client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,  // agregar esta línea
});
```

---

## DOMINIO PERSONALIZADO

### Comprar dominio (~$10-15/año)
- Namecheap: https://www.namecheap.com
- GoDaddy: https://godaddy.com
- PuntoHost (Perú): https://www.puntohost.com.pe

Buscar: `shermanfinance.pe` o `shermanfinance.com`

### Apuntar dominio al servidor

En tu registrador de dominio → DNS → agregar:
```
Tipo: A
Nombre: @
Valor: IP_DE_TU_SERVIDOR
TTL: 3600

Tipo: A  
Nombre: www
Valor: IP_DE_TU_SERVIDOR
TTL: 3600
```

Los cambios DNS tardan 5-48 horas en propagarse.

---

## PRIMERAS ACCIONES DESPUÉS DEL DEPLOY

### 1. Cambiar contraseñas demo

Login como admin → Configuración → Seguridad → Cambiar contraseña.

O mejor: en Usuarios, crear un nuevo admin real y eliminar/revocar los demo.

### 2. Agregar tu empresa con RUC real

Dashboard → Empresas → + Agregar empresa → ingresar tu RUC.
El sistema autocompleta desde Padrón SUNAT.

### 3. Configurar credenciales SOL (si tienes)

Centro SUNAT → Credenciales SOL:
- Usuario SOL
- Clave SOL
- Client ID y Secret (de SOL → Credenciales API SUNAT)

Clic "Probar vs SUNAT" → debe dar `CPE ✓` y `SIRE ✓`.

### 4. Cambiar a SUNAT real

En tus variables de entorno:
```env
SUNAT_PROVIDER=direct
SUNAT_CLIENT_ID=tu_client_id
SUNAT_CLIENT_SECRET=tu_client_secret
NEXT_PUBLIC_SUNAT_MODE=direct
```

Restart de la app.

### 5. Configurar email (opcional pero útil)

Para notificaciones de bienvenida y alertas:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu@gmail.com
SMTP_PASS=tu-app-password-gmail
SMTP_FROM=noreply@shermanfinance.pe
```

> Para Gmail: activar 2FA y crear "App Password" en
> https://myaccount.google.com/apppasswords

---

## BACKUP AUTOMÁTICO DE BD

### Para SQLite (VPS)

Crear script de backup:
```bash
nano /home/scripts/backup-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/home/backups
mkdir -p $BACKUP_DIR
cp /home/sherman-finance/data/sherman.db $BACKUP_DIR/sherman_$DATE.db
# Mantener solo últimos 30 días
find $BACKUP_DIR -name "sherman_*.db" -mtime +30 -delete
echo "Backup completado: $DATE"
```

```bash
chmod +x /home/scripts/backup-db.sh
# Agregar a cron (backup diario a las 3am):
crontab -e
# Agregar línea:
0 3 * * * /home/scripts/backup-db.sh >> /home/logs/backup.log 2>&1
```

### Para Turso o Railway PostgreSQL

Turso hace backups automáticos. Railway también.

---

## MONITOREO

### Ver logs en tiempo real (VPS)
```bash
pm2 logs sherman-finance
pm2 monit  # interfaz visual
```

### Railway
Dashboard → Deployments → Logs

### Uptime monitoring gratuito
- https://uptimerobot.com (alertas si cae el sitio)
- Crea monitor HTTP para tu URL

---

## COSTOS ESTIMADOS

| Opción | Costo/mes | BD incluida | Dificultad |
|--------|-----------|-------------|------------|
| Railway Hobby | $5 + uso | PostgreSQL gratis | ⭐ Fácil |
| VPS DigitalOcean | $6 | SQLite local | ⭐⭐ Medio |
| VPS + Turso | $6 + $0 | SQLite cloud | ⭐⭐ Medio |
| Vercel + Turso | $0-20 | SQLite cloud | ⭐⭐ Medio |

**Recomendación para empezar:** Railway Hobby = ~$10-15/mes todo incluido.

---

## CHECKLIST ANTES DE LANZAR

- [ ] Variables de entorno con secretos únicos (no los del .env.example)
- [ ] JWT_SECRET generado aleatoriamente (mín 64 chars)
- [ ] ENCRYPTION_KEY generado aleatoriamente (exactamente 32 chars)
- [ ] HTTPS activado (SSL/TLS)
- [ ] Base de datos en producción funcionando
- [ ] Datos demo eliminados o contraseñas cambiadas
- [ ] Backup automático configurado
- [ ] Dominio apuntando al servidor
- [ ] Primer login exitoso como admin
- [ ] Primera empresa con RUC real creada

# Usar imagen base de Debian con Node.js
FROM node:22-bookworm-slim

# Instalar Chromium y dependencias en una sola capa
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de Node
RUN npm ci

# Copiar código fuente
COPY . .

# Build de Next.js
RUN npm run build

# Limpiar devDependencies
RUN npm prune --production

# Variables de entorno
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROMIUM_PATH=/usr/bin/chromium

# Puerto
EXPOSE 8080

# Comando de inicio
CMD ["sh", "-c", "node scripts/init-postgres.js && node scripts/seed-postgres.js && npm start"]

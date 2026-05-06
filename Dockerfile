FROM node:22-slim

# Instalar Chromium y sus dependencias del sistema
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Ruta del ejecutable de Chromium
ENV CHROMIUM_PATH=/usr/bin/chromium

WORKDIR /app

# Instalar dependencias (incluyendo devDeps para el build)
COPY package*.json ./
RUN npm ci

# Copiar código y compilar
COPY . .
RUN npm run build

# Limpiar devDependencies después del build
RUN npm prune --omit=dev

# Railway inyecta PORT automáticamente; Next.js lo respeta
EXPOSE 8080

# El script npm start ya incluye init-postgres + seed-postgres + next start
# Next.js usa la variable PORT del entorno automáticamente
CMD ["npm", "start"]

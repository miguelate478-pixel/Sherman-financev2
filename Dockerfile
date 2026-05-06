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
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Instalar todas las dependencias (incluyendo devDeps para TypeScript)
COPY package*.json ./
RUN npm ci

# Copiar código y compilar
COPY . .
RUN npm run build

# Limpiar devDependencies después del build
RUN npm prune --omit=dev

EXPOSE 8080

# npm start ahora usa: next start -p ${PORT:-8080} -H 0.0.0.0
CMD ["npm", "start"]

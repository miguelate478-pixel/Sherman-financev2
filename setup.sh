#!/usr/bin/env bash
set -e
echo ""
echo "██████╗ ██╗  ██╗███████╗██████╗ ███╗   ███╗ █████╗ ███╗   ██╗"
echo "██╔════╝██║  ██║██╔════╝██╔══██╗████╗ ████║██╔══██╗████╗  ██║"
echo "███████╗███████║█████╗  ██████╔╝██╔████╔██║███████║██╔██╗ ██║"
echo "╚════██║██╔══██║██╔══╝  ██╔══██╗██║╚██╔╝██║██╔══██║██║╚██╗██║"
echo "███████║██║  ██║███████╗██║  ██║██║ ╚═╝ ██║██║  ██║██║ ╚████║"
echo "╚══════╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝"
echo "Finance Control AI v2.0 — SUNAT/SIRE real · Parser XML UBL 2.1 · CONCAR SQL"
echo "═══════════════════════════════════════════════════════════════"

# Node version check
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
  echo "❌ Node.js $NODE_VER muy antiguo. Necesitas v18+"; exit 1
fi
echo "✓ Node.js $(node -v)"

# Copy env
if [ ! -f ".env.local" ]; then cp .env.example .env.local; echo "✓ .env.local creado"; fi

# Storage dirs
mkdir -p storage/sunat
echo "✓ storage/ creado"

# Install
echo ""
echo "📦 Instalando dependencias..."
npm install

# Init DB
echo ""
echo "🗄  Creando base de datos SQLite..."
node --experimental-sqlite scripts/init-db.js 2>/dev/null

# Seed
echo ""
echo "🌱 Cargando datos demo..."
node --experimental-sqlite scripts/seed-db.js 2>/dev/null

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "✅ Setup completado!"
echo ""
echo "🔑 CREDENCIALES:"
echo "   Admin:      admin@empresa.pe  / Admin123!"
echo "   Contador:   mruiz@empresa.pe  / Demo1234!"
echo "   Supervisor: jlopez@empresa.pe / Demo1234!"
echo "   Auditor:    aaudit@empresa.pe / Demo1234!"
echo ""
echo "🚀 INICIAR: npm run dev"
echo "🌐 ABRIR:   http://localhost:3000"
echo ""
echo "🔌 ACTIVAR SUNAT REAL:"
echo "   1. Edita .env.local: SUNAT_PROVIDER=direct"
echo "   2. Agrega: SUNAT_CLIENT_ID=... SUNAT_CLIENT_SECRET=..."
echo "   3. En el sistema: Centro SUNAT → Credenciales SOL"
echo "═══════════════════════════════════════════════════════════════"

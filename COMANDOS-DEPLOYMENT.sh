#!/bin/bash

# ============================================
# COMANDOS PARA DEPLOYMENT DEL SCRAPER SUNAT
# ============================================

echo "=== DEPLOYMENT SCRAPER SUNAT ==="
echo ""

# ============================================
# 1. VERIFICAR ARCHIVOS LOCALES
# ============================================
echo "1. Verificando archivos..."
echo ""

if [ -f "src/lib/providers/sunat-scraper.ts" ]; then
  echo "✅ sunat-scraper.ts existe"
else
  echo "❌ sunat-scraper.ts NO ENCONTRADO"
  exit 1
fi

if [ -f "src/app/api/sunat/bulk-download/route.ts" ]; then
  echo "✅ bulk-download/route.ts existe"
else
  echo "❌ bulk-download/route.ts NO ENCONTRADO"
  exit 1
fi

if [ -f "nixpacks.toml" ]; then
  echo "✅ nixpacks.toml existe"
else
  echo "❌ nixpacks.toml NO ENCONTRADO"
  exit 1
fi

echo ""

# ============================================
# 2. VERIFICAR DEPENDENCIAS
# ============================================
echo "2. Verificando dependencias..."
echo ""

if npm list puppeteer-core > /dev/null 2>&1; then
  echo "✅ puppeteer-core instalado"
  npm list puppeteer-core | grep puppeteer-core
else
  echo "❌ puppeteer-core NO INSTALADO"
  echo "Instalando..."
  npm install puppeteer-core@22.15.0
fi

if npm list adm-zip > /dev/null 2>&1; then
  echo "✅ adm-zip instalado"
  npm list adm-zip | grep adm-zip
else
  echo "❌ adm-zip NO INSTALADO"
  echo "Instalando..."
  npm install adm-zip@0.5.17
fi

echo ""

# ============================================
# 3. VERIFICAR TYPESCRIPT
# ============================================
echo "3. Verificando TypeScript..."
echo ""

npx tsc --noEmit src/lib/providers/sunat-scraper.ts
if [ $? -eq 0 ]; then
  echo "✅ sunat-scraper.ts sin errores de TypeScript"
else
  echo "❌ Errores de TypeScript encontrados"
  exit 1
fi

echo ""

# ============================================
# 4. GIT STATUS
# ============================================
echo "4. Estado de Git..."
echo ""

git status --short

echo ""
echo "Archivos modificados:"
git diff --name-only

echo ""

# ============================================
# 5. COMMIT Y PUSH
# ============================================
echo "5. ¿Deseas hacer commit y push? (y/n)"
read -r response

if [ "$response" = "y" ]; then
  echo ""
  echo "Agregando archivos..."
  git add src/lib/providers/sunat-scraper.ts
  git add src/app/api/sunat/bulk-download/route.ts
  git add nixpacks.toml
  git add INTEGRACION-SCRAPER-SUNAT.md
  git add DEPLOYMENT-SCRAPER.md
  git add RESUMEN-INTEGRACION.md
  git add test-scraper.mjs
  git add COMANDOS-DEPLOYMENT.sh
  
  echo ""
  echo "Haciendo commit..."
  git commit -m "feat: integrar scraper SUNAT headless para descarga de XML

- Agregar sunat-scraper.ts con automatización Puppeteer
- Integrar scraper como fallback en bulk-download (3 niveles)
- Agregar soporte para extraer líneas de COMPRAS
- Configurar Chromium en nixpacks.toml para Railway
- Agregar documentación completa y guías de deployment

Flujo de descarga XML:
1. SIRE API (rápido, solo VENTAS)
2. CPE API (requiere clientId/Secret)
3. Web Scraping (fallback, funciona para COMPRAS)

Tiempo de scraping: 25-30 segundos por documento
Tasa de éxito esperada: >90%"

  echo ""
  echo "Pusheando a origin..."
  git push origin main
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Push exitoso"
  else
    echo ""
    echo "❌ Error en push"
    exit 1
  fi
else
  echo ""
  echo "⏭️  Commit cancelado"
fi

echo ""

# ============================================
# 6. INSTRUCCIONES PARA RAILWAY
# ============================================
echo "============================================"
echo "PRÓXIMOS PASOS EN RAILWAY"
echo "============================================"
echo ""
echo "1. Ve a Railway Dashboard → Tu proyecto"
echo ""
echo "2. Variables → Agregar nueva variable:"
echo "   Nombre: CHROMIUM_PATH"
echo "   Valor: /usr/bin/chromium-browser"
echo ""
echo "3. Deployments → Ver logs de build"
echo "   Buscar: '✓ Installing chromium-browser'"
echo ""
echo "4. Deployments → Ver logs de runtime"
echo "   Buscar: '[SCRAPER]' cuando hagas una descarga masiva"
echo ""
echo "5. Probar en producción:"
echo "   - Login en Sherman Finance"
echo "   - Ir a Descarga Masiva"
echo "   - Seleccionar COMPRAS"
echo "   - Activar 'Extraer líneas del XML'"
echo "   - Iniciar descarga"
echo "   - Ver logs en Railway"
echo ""
echo "============================================"
echo "VERIFICACIÓN DE CHROMIUM EN RAILWAY"
echo "============================================"
echo ""
echo "Si Railway tiene shell disponible, ejecutar:"
echo ""
echo "  which chromium-browser"
echo "  # Debe mostrar: /usr/bin/chromium-browser"
echo ""
echo "  chromium-browser --version"
echo "  # Debe mostrar: Chromium 120.x.x"
echo ""
echo "============================================"
echo "TROUBLESHOOTING"
echo "============================================"
echo ""
echo "Si ves error 'Chromium not found':"
echo "  1. Verificar que nixpacks.toml tiene aptPkgs"
echo "  2. Verificar CHROMIUM_PATH en variables"
echo "  3. Rebuild en Railway"
echo ""
echo "Si ves error 'libgobject-2.0.so.0':"
echo "  1. Verificar que nixpacks.toml tiene todas las libs"
echo "  2. Agregar más dependencias si es necesario"
echo ""
echo "Para más ayuda, ver:"
echo "  - DEPLOYMENT-SCRAPER.md (troubleshooting completo)"
echo "  - INTEGRACION-SCRAPER-SUNAT.md (documentación técnica)"
echo ""
echo "============================================"
echo "✅ DEPLOYMENT PREPARADO"
echo "============================================"

#!/bin/bash
# Script para sincronizar AHORA desde Railway

echo "🔄 Sincronizando todos los documentos..."
railway run node sync-all-financial.mjs

echo ""
echo "✅ Sincronización completada"
echo "Ve al dashboard y revisa los módulos financieros"

# Script para probar descarga de XML desde SUNAT

Write-Host "=== Prueba de descarga de XML desde SUNAT ===" -ForegroundColor Cyan

# Parámetros del comprobante a descargar
$rucEmisor = "20508565934"  # Hipermercados Tottus
$tipoComprobante = "01"      # Factura
$serie = "FJ88"
$numero = "30587"

Write-Host "`nComprobante a descargar:" -ForegroundColor Yellow
Write-Host "  RUC Emisor: $rucEmisor"
Write-Host "  Tipo: $tipoComprobante (Factura)"
Write-Host "  Serie-Número: $serie-$numero"

# Credenciales SUNAT (necesitas configurarlas)
$clientId = "f62b2812-1afb-4d70-8d74-7c444bdfae4c"
$clientSecret = "TU_CLIENT_SECRET"  # Reemplazar con el real
$username = "20610169849SHERMAN1"   # RUC + usuario SOL
$password = "TU_CLAVE_SOL"          # Reemplazar con la real

Write-Host "`n[1/2] Obteniendo token SIRE de SUNAT..." -ForegroundColor Yellow

try {
    $tokenBody = @{
        grant_type = "password"
        scope = "https://api-sire.sunat.gob.pe"
        client_id = $clientId
        client_secret = $clientSecret
        username = $username
        password = $password
    }
    
    $tokenResponse = Invoke-RestMethod `
        -Uri "https://api-seguridad.sunat.gob.pe/v1/clientessol/$clientId/oauth2/token/" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $tokenBody `
        -ErrorAction Stop
    
    $sireToken = $tokenResponse.access_token
    Write-Host "  ✓ Token obtenido exitosamente" -ForegroundColor Green
    Write-Host "  Token (primeros 50 chars): $($sireToken.Substring(0, [Math]::Min(50, $sireToken.Length)))..." -ForegroundColor Gray
    
} catch {
    Write-Host "  ✗ Error al obtener token SIRE:" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "    Respuesta: $responseBody" -ForegroundColor Red
    }
    
    Write-Host "`n⚠ No se puede continuar sin token válido" -ForegroundColor Yellow
    Write-Host "Configura las credenciales correctas en el script:" -ForegroundColor Yellow
    Write-Host "  - clientSecret: Obtenerlo del portal de SUNAT" -ForegroundColor Yellow
    Write-Host "  - username: RUC + usuario SOL" -ForegroundColor Yellow
    Write-Host "  - password: Clave SOL" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n[2/2] Descargando XML del comprobante..." -ForegroundColor Yellow

try {
    $xmlUrl = "https://api-cpe.sunat.gob.pe/v1/contribuyente/gem/comprobantes/$tipoComprobante/$serie/$numero/$rucEmisor/xml"
    Write-Host "  URL: $xmlUrl" -ForegroundColor Gray
    
    $headers = @{
        "Authorization" = "Bearer $sireToken"
        "Accept" = "application/json"
    }
    
    $xmlResponse = Invoke-RestMethod `
        -Uri $xmlUrl `
        -Method Get `
        -Headers $headers `
        -ErrorAction Stop
    
    Write-Host "  ✓ XML descargado exitosamente" -ForegroundColor Green
    Write-Host "`nRespuesta de SUNAT:" -ForegroundColor Cyan
    $xmlResponse | ConvertTo-Json -Depth 10 | Write-Host
    
    # Si la respuesta contiene datos base64, intentar decodificar
    if ($xmlResponse.data -or $xmlResponse.body.data) {
        $base64Data = if ($xmlResponse.data) { $xmlResponse.data } else { $xmlResponse.body.data }
        Write-Host "`n📦 Datos base64 recibidos (primeros 100 chars):" -ForegroundColor Cyan
        Write-Host $base64Data.Substring(0, [Math]::Min(100, $base64Data.Length))
        
        # Guardar el ZIP
        $zipBytes = [Convert]::FromBase64String($base64Data)
        $outputFile = "xml-$rucEmisor-$tipoComprobante-$serie-$numero.zip"
        [System.IO.File]::WriteAllBytes($outputFile, $zipBytes)
        Write-Host "`n✓ Archivo guardado: $outputFile" -ForegroundColor Green
    }
    
} catch {
    Write-Host "  ✗ Error al descargar XML:" -ForegroundColor Red
    Write-Host "    Status: $($_.Exception.Response.StatusCode.value__) $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "    Respuesta: $responseBody" -ForegroundColor Red
    }
}

Write-Host "`n=== Fin de la prueba ===" -ForegroundColor Cyan

# Script para probar descarga de XML desde SUNAT con credenciales reales

Write-Host "=== Prueba de descarga de XML desde SUNAT ===" -ForegroundColor Cyan

# Parámetros del comprobante a descargar
$rucEmisor = "20508565934"  # Hipermercados Tottus
$tipoComprobante = "01"      # Factura
$serie = "FJ88"
$numero = "30587"

Write-Host "`nComprobante a descargar:" -ForegroundColor Yellow
Write-Host "  RUC Emisor: $rucEmisor"
Write-Host "  Tipo: $tipoComprobante (Factura)"
Write-Host "  Serie-Numero: $serie-$numero"

# Credenciales SUNAT (desde la captura de pantalla)
$clientId = "f62b2812-1afb-4d70-8d74-7c444bdfae4c"
$rucEmpresa = "20610169849"
$usuarioSOL = "SHERMAN1"
$username = "$rucEmpresa$usuarioSOL"  # 20610169849SHERMAN1

Write-Host "`n[IMPORTANTE] Necesitas proporcionar:" -ForegroundColor Yellow
Write-Host "  1. CLIENT_SECRET (desde tu configuracion SUNAT)" -ForegroundColor Yellow
Write-Host "  2. CLAVE_SOL (tu password de Clave SOL)" -ForegroundColor Yellow
Write-Host ""

# Solicitar credenciales de forma segura
$clientSecret = Read-Host "Ingresa CLIENT_SECRET" -AsSecureString
$clientSecretPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($clientSecret))

$password = Read-Host "Ingresa CLAVE_SOL" -AsSecureString
$passwordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

Write-Host "`n[1/2] Obteniendo token SIRE de SUNAT..." -ForegroundColor Yellow
Write-Host "  Username: $username" -ForegroundColor Gray
Write-Host "  Client ID: $clientId" -ForegroundColor Gray

try {
    $tokenBody = "grant_type=password&scope=https://api-sire.sunat.gob.pe&client_id=$clientId&client_secret=$clientSecretPlain&username=$username&password=$passwordPlain"
    
    $tokenResponse = Invoke-RestMethod `
        -Uri "https://api-seguridad.sunat.gob.pe/v1/clientessol/$clientId/oauth2/token/" `
        -Method Post `
        -ContentType "application/x-www-form-urlencoded" `
        -Body $tokenBody `
        -ErrorAction Stop
    
    $sireToken = $tokenResponse.access_token
    Write-Host "  OK Token obtenido exitosamente" -ForegroundColor Green
    Write-Host "  Token (primeros 50 chars): $($sireToken.Substring(0, [Math]::Min(50, $sireToken.Length)))..." -ForegroundColor Gray
    Write-Host "  Expira en: $($tokenResponse.expires_in) segundos" -ForegroundColor Gray
    
} catch {
    Write-Host "  ERROR al obtener token SIRE:" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "    Respuesta: $responseBody" -ForegroundColor Red
        } catch {}
    }
    
    Write-Host "`nNo se puede continuar sin token valido" -ForegroundColor Yellow
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
    
    Write-Host "  OK XML descargado exitosamente" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "RESPUESTA DE SUNAT:" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    $xmlResponse | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host "========================================" -ForegroundColor Cyan
    
    # Si la respuesta contiene datos base64, intentar decodificar
    if ($xmlResponse.data) {
        $base64Data = $xmlResponse.data
        Write-Host "`nDatos base64 recibidos (primeros 100 chars):" -ForegroundColor Cyan
        Write-Host $base64Data.Substring(0, [Math]::Min(100, $base64Data.Length))
        
        # Guardar el ZIP
        try {
            $zipBytes = [Convert]::FromBase64String($base64Data)
            $outputFile = "xml-$rucEmisor-$tipoComprobante-$serie-$numero.zip"
            [System.IO.File]::WriteAllBytes($outputFile, $zipBytes)
            Write-Host "`nOK Archivo guardado: $outputFile" -ForegroundColor Green
            Write-Host "Tamano: $($zipBytes.Length) bytes" -ForegroundColor Gray
        } catch {
            Write-Host "`nERROR al guardar archivo: $($_.Exception.Message)" -ForegroundColor Red
        }
    } elseif ($xmlResponse.body -and $xmlResponse.body.data) {
        $base64Data = $xmlResponse.body.data
        Write-Host "`nDatos base64 recibidos en body (primeros 100 chars):" -ForegroundColor Cyan
        Write-Host $base64Data.Substring(0, [Math]::Min(100, $base64Data.Length))
        
        # Guardar el ZIP
        try {
            $zipBytes = [Convert]::FromBase64String($base64Data)
            $fileName = if ($xmlResponse.body.fileName) { $xmlResponse.body.fileName } else { "xml-$rucEmisor-$tipoComprobante-$serie-$numero.zip" }
            [System.IO.File]::WriteAllBytes($fileName, $zipBytes)
            Write-Host "`nOK Archivo guardado: $fileName" -ForegroundColor Green
            Write-Host "Tamano: $($zipBytes.Length) bytes" -ForegroundColor Gray
        } catch {
            Write-Host "`nERROR al guardar archivo: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
} catch {
    Write-Host "  ERROR al descargar XML:" -ForegroundColor Red
    Write-Host "    Status: $($_.Exception.Response.StatusCode.value__) $($_.Exception.Response.StatusDescription)" -ForegroundColor Red
    Write-Host "    $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "`n========================================" -ForegroundColor Red
            Write-Host "RESPUESTA DE ERROR DE SUNAT:" -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
            Write-Host $responseBody -ForegroundColor Red
            Write-Host "========================================" -ForegroundColor Red
        } catch {}
    }
}

Write-Host "`n=== Fin de la prueba ===" -ForegroundColor Cyan

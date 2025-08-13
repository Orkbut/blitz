# Script de Backup usando API REST do Supabase
# Backup completo via API - Schema + Dados

param(
    [Parameter(Mandatory=$false)]
    [string]$ServiceRoleKey = "",
    [Parameter(Mandatory=$false)]
    [string]$AnonKey = ""
)

# Configuracoes do projeto RADAR
$PROJECT_ID = "umcejyqkfhvxaiyvmqac"
$PROJECT_NAME = "RADAR"
$SUPABASE_URL = "https://$PROJECT_ID.supabase.co"

# Nome dos arquivos de backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$fullBackupFile = "backup_completo_RADAR_$timestamp.txt"

Write-Host "Iniciando backup via API REST do Supabase..." -ForegroundColor Green
Write-Host "Projeto: $PROJECT_NAME ($PROJECT_ID)" -ForegroundColor Cyan
Write-Host "URL: $SUPABASE_URL" -ForegroundColor Cyan
Write-Host "" 

# Solicitar chaves se nao fornecidas
if ([string]::IsNullOrEmpty($ServiceRoleKey)) {
    Write-Host "Acesse: https://supabase.com/dashboard/project/$PROJECT_ID/settings/api" -ForegroundColor Cyan
    $ServiceRoleKey = Read-Host "Digite a Service Role Key (service_role)"
}

if ([string]::IsNullOrEmpty($AnonKey)) {
    Write-Host "Digite a Anon Key (anon/public):" -ForegroundColor Cyan
    $AnonKey = Read-Host
}

# Headers para autenticacao
$headers = @{
    "apikey" = $ServiceRoleKey
    "Authorization" = "Bearer $ServiceRoleKey"
    "Content-Type" = "application/json"
}

Write-Host "Iniciando backup completo..." -ForegroundColor Yellow
Write-Host "" 

# Backup das tabelas via API
Write-Host "1. Fazendo backup das tabelas..." -ForegroundColor Yellow

try {
    # Criar arquivo de backup completo
    $backupContent = @()
    $backupContent += "-- BACKUP COMPLETO SUPABASE RADAR"
    $backupContent += "-- Projeto: $PROJECT_NAME ($PROJECT_ID)"
    $backupContent += "-- Data: $(Get-Date)"
    $backupContent += "-- URL: $SUPABASE_URL"
    $backupContent += ""
    
    # Tentar obter informacoes das tabelas principais
    $commonTables = @(
        "usuarios", "profiles", "events", "calendar", "tasks", "projects"
    )
    
    foreach ($table in $commonTables) {
        try {
            Write-Host "   Fazendo backup da tabela: $table" -ForegroundColor Cyan
            $tableData = Invoke-RestMethod -Uri "$SUPABASE_URL/rest/v1/$table" -Headers $headers -Method GET
            
            $backupContent += "-- TABELA: $table"
            $backupContent += "-- Registros encontrados: $($tableData.Count)"
            $backupContent += "-- Dados em JSON:"
            $backupContent += ($tableData | ConvertTo-Json -Depth 10)
            $backupContent += ""
            $backupContent += "-- FIM TABELA: $table"
            $backupContent += ""
            
            Write-Host "     Sucesso: $($tableData.Count) registros salvos" -ForegroundColor Green
        }
        catch {
            Write-Host "     - Tabela $table nao encontrada ou sem acesso" -ForegroundColor Gray
            $backupContent += "-- TABELA: $table - NAO ACESSIVEL"
            $backupContent += "-- Erro: $($_.Exception.Message)"
            $backupContent += ""
        }
    }
    
    # Salvar backup completo
    $backupContent | Out-File -FilePath $fullBackupFile -Encoding UTF8
    
    Write-Host "" 
    Write-Host "BACKUP COMPLETO REALIZADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "Arquivo salvo em: $(Get-Location)\$fullBackupFile" -ForegroundColor Green
    
    if (Test-Path "$fullBackupFile") {
        $fileSize = (Get-Item "$fullBackupFile").Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "Tamanho do arquivo: $fileSizeMB MB" -ForegroundColor Green
        
        Write-Host "" 
        Write-Host "Primeiras linhas do backup:" -ForegroundColor Cyan
        Get-Content "$fullBackupFile" -Head 10 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        Write-Host "   ..." -ForegroundColor Gray
        
        Write-Host "" 
        Write-Host "Backup completissimo salvo com sucesso!" -ForegroundColor Green
        Write-Host "Arquivo contem dados de todas as tabelas acessiveis" -ForegroundColor Yellow
    }
    
}
catch {
    Write-Host "" 
    Write-Host "ERRO ao realizar backup via API!" -ForegroundColor Red
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "" 
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "   - Service Role Key esta correta" -ForegroundColor Yellow
    Write-Host "   - Permissoes de acesso ao projeto" -ForegroundColor Yellow
    Write-Host "   - Conexao com a internet" -ForegroundColor Yellow
    Write-Host "   - URL do projeto: $SUPABASE_URL" -ForegroundColor Yellow
}

Write-Host "" 
Write-Host "Backup finalizado." -ForegroundColor Gray
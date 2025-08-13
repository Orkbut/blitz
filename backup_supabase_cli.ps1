# Script de Backup usando Supabase CLI
# Backup completo do projeto RADAR

param(
    [Parameter(Mandatory=$false)]
    [string]$AccessToken = ""
)

# Configuracoes do projeto
$PROJECT_ID = "umcejyqkfhvxaiyvmqac"
$PROJECT_NAME = "RADAR"

# Nome do arquivo de backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_supabase_CLI_RADAR_$timestamp.sql"

Write-Host "Iniciando backup usando Supabase CLI..." -ForegroundColor Green
Write-Host "Projeto: $PROJECT_NAME ($PROJECT_ID)" -ForegroundColor Cyan
Write-Host "Arquivo: $backupFile" -ForegroundColor Cyan
Write-Host "" 

# Verificar se Supabase CLI esta instalado
Write-Host "Verificando Supabase CLI..." -ForegroundColor Yellow
$supabaseVersion = supabase --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Supabase CLI nao encontrado. Instalando..." -ForegroundColor Yellow
    npm install -g supabase
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Nao foi possivel instalar Supabase CLI" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Supabase CLI encontrado: $supabaseVersion" -ForegroundColor Green
}

# Login no Supabase (se necessario)
Write-Host "Verificando autenticacao..." -ForegroundColor Yellow
$authStatus = supabase projects list 2>$null
if ($LASTEXITCODE -ne 0) {
    if ([string]::IsNullOrEmpty($AccessToken)) {
        Write-Host "Acesse: https://supabase.com/dashboard/account/tokens" -ForegroundColor Cyan
        $AccessToken = Read-Host "Digite seu Access Token do Supabase"
    }
    
    Write-Host "Fazendo login..." -ForegroundColor Yellow
    $env:SUPABASE_ACCESS_TOKEN = $AccessToken
    supabase auth login --token $AccessToken
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERRO: Falha na autenticacao" -ForegroundColor Red
        exit 1
    }
}

# Fazer backup usando Supabase CLI
Write-Host "Executando backup do banco de dados..." -ForegroundColor Yellow
Write-Host "Comando: supabase db dump --project-id $PROJECT_ID --file $backupFile" -ForegroundColor Gray

supabase db dump --project-id $PROJECT_ID --file $backupFile

# Verificar resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host "" 
    Write-Host "BACKUP REALIZADO COM SUCESSO!" -ForegroundColor Green
    Write-Host "Arquivo salvo em: $(Get-Location)\$backupFile" -ForegroundColor Green
    
    if (Test-Path "$backupFile") {
        $fileSize = (Get-Item "$backupFile").Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "Tamanho do arquivo: $fileSizeMB MB" -ForegroundColor Green
        
        Write-Host "" 
        Write-Host "Primeiras linhas do backup:" -ForegroundColor Cyan
        Get-Content "$backupFile" -Head 5 | ForEach-Object { Write-Host "   $_" -ForegroundColor Gray }
        Write-Host "   ..." -ForegroundColor Gray
        
        Write-Host "" 
        Write-Host "Backup completo salvo com sucesso!" -ForegroundColor Green
        Write-Host "Para restaurar: supabase db reset --project-id $PROJECT_ID" -ForegroundColor Yellow
    }
} else {
    Write-Host "" 
    Write-Host "ERRO ao realizar backup!" -ForegroundColor Red
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "   - Access Token do Supabase" -ForegroundColor Yellow
    Write-Host "   - Permissoes do projeto" -ForegroundColor Yellow
    Write-Host "   - Conexao com a internet" -ForegroundColor Yellow
}

# Limpar variaveis por seguranca
$env:SUPABASE_ACCESS_TOKEN = $null
Write-Host "" 
Write-Host "Variaveis limpas por seguranca." -ForegroundColor Gray
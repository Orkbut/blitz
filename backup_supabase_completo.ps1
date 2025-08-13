# Script de Backup Completo do Banco de Dados Supabase RADAR
# Backup completissimo - Schema + Dados + Funcoes + Triggers + Tudo!

param(
    [Parameter(Mandatory=$false)]
    [string]$SenhaBanco = ""
)

# Configuracoes do projeto RADAR (ativo)
$DB_HOST = "db.umcejyqkfhvxaiyvmqac.supabase.co"
$DB_PORT = "5432"
$DB_NAME = "postgres"
$DB_USER = "postgres.umcejyqkfhvxaiyvmqac"

# Se nao forneceu senha, solicita
if ([string]::IsNullOrEmpty($SenhaBanco)) {
    $SecurePassword = Read-Host "Digite a senha do banco de dados Supabase" -AsSecureString
    $SenhaBanco = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword))
}

# Nome do arquivo de backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_completo_supabase_RADAR_$timestamp.sql"

Write-Host "Iniciando backup COMPLETO do banco Supabase RADAR..." -ForegroundColor Green
Write-Host "Projeto: RADAR (umcejyqkfhvxaiyvmqac)" -ForegroundColor Cyan
Write-Host "Host: $DB_HOST" -ForegroundColor Cyan
Write-Host "Banco: $DB_NAME" -ForegroundColor Cyan
Write-Host "Arquivo: $backupFile" -ForegroundColor Cyan
Write-Host "" 

# Definir senha como variavel de ambiente
$env:PGPASSWORD = $SenhaBanco

# Comando pg_dump COMPLETO com todas as opcoes
Write-Host "Executando pg_dump..." -ForegroundColor Yellow

pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME --clean --create --no-owner --no-privileges --verbose --inserts --column-inserts --disable-triggers --no-tablespaces --quote-all-identifiers --file "$backupFile"

# Verificar resultado
if ($LASTEXITCODE -eq 0) {
    Write-Host "" 
    Write-Host "BACKUP COMPLETO REALIZADO COM SUCESSO!" -ForegroundColor Green
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
        Write-Host "Backup completissimo salvo com sucesso!" -ForegroundColor Green
        Write-Host "Para restaurar: psql -h HOST -U USER -d DATABASE -f $backupFile" -ForegroundColor Yellow
    }
} else {
    Write-Host "" 
    Write-Host "ERRO ao realizar backup!" -ForegroundColor Red
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "   - Senha do banco de dados" -ForegroundColor Yellow
    Write-Host "   - Conexao com a internet" -ForegroundColor Yellow
    Write-Host "   - Se o pg_dump esta instalado" -ForegroundColor Yellow
    Write-Host "   - Permissoes de acesso ao banco" -ForegroundColor Yellow
}

# Limpar variavel de senha por seguranca
$env:PGPASSWORD = $null
Write-Host "" 
Write-Host "Variaveis de senha limpas por seguranca." -ForegroundColor Gray
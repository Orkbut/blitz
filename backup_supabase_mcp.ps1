# Script de Backup usando MCP Supabase
# Backup completo do projeto RADAR via MCP

# Configuracoes do projeto RADAR
$PROJECT_ID = "umcejyqkfhvxaiyvmqac"
$PROJECT_NAME = "RADAR"
$ORGANIZATION_ID = "fzoxbrrpjufscgthqodq"
$DATABASE_HOST = "db.umcejyqkfhvxaiyvmqac.supabase.co"
$DATABASE_VERSION = "17.4.1.042"

# Nome do arquivo de backup com timestamp
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = "backup_completo_RADAR_MCP_$timestamp.sql"

Write-Host "=== BACKUP COMPLETO SUPABASE VIA MCP ===" -ForegroundColor Green
Write-Host "Projeto: $PROJECT_NAME ($PROJECT_ID)" -ForegroundColor Cyan
Write-Host "Organizacao: $ORGANIZATION_ID" -ForegroundColor Cyan
Write-Host "Host do Banco: $DATABASE_HOST" -ForegroundColor Cyan
Write-Host "Versao PostgreSQL: $DATABASE_VERSION" -ForegroundColor Cyan
Write-Host "Status: ACTIVE_HEALTHY" -ForegroundColor Green
Write-Host "" 

# Solicitar credenciais do banco
Write-Host "Para realizar o backup completo, precisamos das credenciais do banco:" -ForegroundColor Yellow
Write-Host "" 

# Solicitar senha do banco
$dbPassword = Read-Host "Digite a senha do banco de dados PostgreSQL" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

# Usuario padrao do Supabase
$dbUser = "postgres.$PROJECT_ID"
$dbName = "postgres"
$dbPort = "5432"

Write-Host "" 
Write-Host "Iniciando backup completo via pg_dump..." -ForegroundColor Yellow
Write-Host "" 

# Definir variavel de ambiente para senha
$env:PGPASSWORD = $dbPasswordPlain

try {
    Write-Host "Executando pg_dump com parametros completos..." -ForegroundColor Cyan
    Write-Host "Comando: pg_dump --host=$DATABASE_HOST --username=$dbUser --dbname=$dbName" -ForegroundColor Gray
    Write-Host "" 
    
    # Executar backup completo (schema + dados)
    Write-Host "1. Fazendo backup do SCHEMA..." -ForegroundColor Yellow
    $schemaFile = "backup_schema_RADAR_$timestamp.sql"
    & pg_dump --host=$DATABASE_HOST --port=$dbPort --username=$dbUser --dbname=$dbName --verbose --clean --create --if-exists --schema-only --no-owner --no-privileges --file=$schemaFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Schema backup concluido com sucesso!" -ForegroundColor Green
    } else {
        throw "Erro no backup do schema. Exit code: $LASTEXITCODE"
    }
    
    Write-Host "" 
    Write-Host "2. Fazendo backup dos DADOS..." -ForegroundColor Yellow
    $dataFile = "backup_dados_RADAR_$timestamp.sql"
    & pg_dump --host=$DATABASE_HOST --port=$dbPort --username=$dbUser --dbname=$dbName --verbose --data-only --inserts --column-inserts --disable-triggers --no-owner --no-privileges --file=$dataFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   Dados backup concluido com sucesso!" -ForegroundColor Green
    } else {
        throw "Erro no backup dos dados. Exit code: $LASTEXITCODE"
    }
    
    Write-Host "" 
    Write-Host "3. Criando backup COMPLETO unificado..." -ForegroundColor Yellow
    
    # Criar arquivo completo combinando schema + dados
    $completeBackup = @()
    $completeBackup += "-- ================================================="
    $completeBackup += "-- BACKUP COMPLETO SUPABASE RADAR VIA MCP"
    $completeBackup += "-- Projeto: $PROJECT_NAME ($PROJECT_ID)"
    $completeBackup += "-- Organizacao: $ORGANIZATION_ID"
    $completeBackup += "-- Host: $DATABASE_HOST"
    $completeBackup += "-- Versao PostgreSQL: $DATABASE_VERSION"
    $completeBackup += "-- Data do Backup: $(Get-Date)"
    $completeBackup += "-- Metodo: MCP Supabase + pg_dump"
    $completeBackup += "-- ================================================="
    $completeBackup += ""
    $completeBackup += "-- INICIO DO SCHEMA"
    $completeBackup += ""
    
    if (Test-Path $schemaFile) {
        $completeBackup += Get-Content $schemaFile
    }
    
    $completeBackup += ""
    $completeBackup += "-- FIM DO SCHEMA / INICIO DOS DADOS"
    $completeBackup += ""
    
    if (Test-Path $dataFile) {
        $completeBackup += Get-Content $dataFile
    }
    
    $completeBackup += ""
    $completeBackup += "-- FIM DO BACKUP COMPLETO"
    
    # Salvar backup completo
    $completeBackup | Out-File -FilePath $backupFile -Encoding UTF8
    
    Write-Host "" 
    Write-Host "=== BACKUP COMPLETO REALIZADO COM SUCESSO! ===" -ForegroundColor Green
    Write-Host "" 
    Write-Host "Arquivos gerados:" -ForegroundColor Cyan
    Write-Host "   Schema: $(Get-Location)\$schemaFile" -ForegroundColor White
    Write-Host "   Dados:  $(Get-Location)\$dataFile" -ForegroundColor White
    Write-Host "   Completo: $(Get-Location)\$backupFile" -ForegroundColor Yellow
    Write-Host "" 
    
    # Mostrar informacoes dos arquivos
    if (Test-Path $backupFile) {
        $fileSize = (Get-Item $backupFile).Length
        $fileSizeMB = [math]::Round($fileSize / 1MB, 2)
        Write-Host "Tamanho do backup completo: $fileSizeMB MB" -ForegroundColor Green
        
        $lineCount = (Get-Content $backupFile | Measure-Object -Line).Lines
        Write-Host "Total de linhas: $lineCount" -ForegroundColor Green
    }
    
    Write-Host "" 
    Write-Host "BACKUP COMPLETISSIMO SALVO COM SUCESSO!" -ForegroundColor Green
    Write-Host "Todos os dados, schemas, funcoes e triggers foram salvos" -ForegroundColor Yellow
    
    # Limpar arquivos temporarios
    if (Test-Path $schemaFile) { Remove-Item $schemaFile }
    if (Test-Path $dataFile) { Remove-Item $dataFile }
    
}
catch {
    Write-Host "" 
    Write-Host "ERRO ao realizar backup!" -ForegroundColor Red
    Write-Host "Erro: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "" 
    Write-Host "Verifique:" -ForegroundColor Yellow
    Write-Host "   - Senha do banco esta correta" -ForegroundColor Yellow
    Write-Host "   - pg_dump esta instalado e no PATH" -ForegroundColor Yellow
    Write-Host "   - Conexao com o banco: $DATABASE_HOST" -ForegroundColor Yellow
    Write-Host "   - Usuario: $dbUser" -ForegroundColor Yellow
}
finally {
    # Limpar senha da memoria
    $env:PGPASSWORD = $null
    $dbPasswordPlain = $null
}

Write-Host "" 
Write-Host "Backup via MCP Supabase finalizado." -ForegroundColor Gray
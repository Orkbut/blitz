@echo off
echo.
echo 🚀 RADAR DETRAN - Setup + Start
echo.

cd radar-detran

echo ⚡ Verificando dependências...
if not exist "node_modules\concurrently" (
    echo 📦 Instalando concurrently...
    npm install
)

echo.
echo 🎯 Iniciando todos os servidores no terminal integrado...
echo.
echo 📋 SERVIÇOS:
echo   • NEXT         = Next.js (http://localhost:3000)
echo   • SUPABASE     = MCP Supabase (conectado)
echo   • PLAYWRIGHT   = MCP Playwright (automação)
echo   • CONTEXT7     = MCP Context7 (documentação libs)
echo.

npm run dev:all 
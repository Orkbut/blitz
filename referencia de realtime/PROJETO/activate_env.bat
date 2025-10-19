@echo off
echo Ativando ambiente virtual...

if exist "%~dp0venv\Scripts\activate.bat" (
    call "%~dp0venv\Scripts\activate.bat"
    echo Ambiente virtual ativado com sucesso!
) else (
    echo Ambiente virtual não encontrado.
    echo Verificando se é necessário criar um novo ambiente virtual...
    
    where python >nul 2>nul
    if %ERRORLEVEL% neq 0 (
        echo Python não encontrado! Por favor, instale o Python e tente novamente.
        exit /b 1
    )
    
    echo Criando novo ambiente virtual...
    python -m venv venv
    
    if exist "%~dp0venv\Scripts\activate.bat" (
        call "%~dp0venv\Scripts\activate.bat"
        echo Novo ambiente virtual criado e ativado com sucesso!
        
        REM Instalar dependências, se houver um requirements.txt
        if exist "%~dp0requirements.txt" (
            echo Instalando dependências do projeto...
            pip install -r requirements.txt
            echo Dependências instaladas com sucesso!
        )
    ) else (
        echo Falha ao criar o ambiente virtual.
    )
)

echo.
echo Bem-vindo ao ambiente de desenvolvimento!
echo. 
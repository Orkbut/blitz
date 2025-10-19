# Configuração de Ambiente Virtual Automático

Este projeto está configurado para ativar automaticamente o ambiente virtual Python sempre que você abrir um terminal no VS Code ou Cursor IDE.

## Como funciona

1. Um arquivo `.vscode/settings.json` foi criado para configurar o terminal integrado do VS Code/Cursor IDE.
2. Um script `activate_env.bat` foi adicionado ao projeto para gerenciar a ativação do ambiente virtual.

## Funcionalidades

- **Ativação automática**: O ambiente virtual é ativado automaticamente ao abrir um terminal.
- **Criação automática**: Se o ambiente virtual não existir, ele será criado automaticamente.
- **Instalação de dependências**: Se existir um arquivo `requirements.txt`, as dependências serão instaladas automaticamente após a criação do ambiente.

## Solução de problemas

Se a ativação automática não funcionar:

1. Verifique se o Python está instalado e acessível pelo PATH do sistema.
2. Certifique-se de que o VS Code/Cursor IDE esteja usando o terminal Command Prompt no Windows.
3. Reinicie o VS Code/Cursor IDE após as mudanças nas configurações.

## Modificação manual

Caso precise ativar o ambiente manualmente, execute:

```
.\venv\Scripts\activate
```

ou no Command Prompt:

```
.\venv\Scripts\activate.bat
``` 
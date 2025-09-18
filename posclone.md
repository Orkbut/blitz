# 🚀 Guia de Configuração Pós-Clone - Radar DETRAN

Este documento contém todas as instruções necessárias para configurar e executar o projeto **Radar DETRAN** após clonar o repositório.

## 📋 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Node.js** (versão 18 ou superior) - [Download](https://nodejs.org/)
- **npm** (geralmente vem com Node.js)
- **Git** - [Download](https://git-scm.com/)

## 🔧 Configuração Inicial

### 1. Clone do Repositório

```bash
git clone https://github.com/Orkbut/blitz.git
cd blitz
```

### 2. Instalação das Dependências

```bash
npm install
```

**⚠️ Importante:** Se houver erros de dependências, tente:

```bash
npm install --legacy-peer-deps
```

### 3. Configuração das Variáveis de Ambiente

O arquivo `.env.local` já está configurado no repositório, mas você pode precisar ajustar algumas configurações:

#### 3.1. Verificar o arquivo `.env.local`

O arquivo deve conter:

```env
# Configurações do Supabase
NEXT_PUBLIC_SUPABASE_URL=https://umcejyqkfhvxaiyvmqac.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2OTcyODcsImV4cCI6MjA2NTI3MzI4N30.Jsbdm3GMKHBvTuWkQWKP1vEIgiDBWeq5wJtwjdlydeU

# Configurações de desenvolvimento
NODE_ENV=development

# Feature Flags
NEXT_PUBLIC_USE_CIRCULAR_INDICATORS=true
NEXT_PUBLIC_USE_OPTIMIZED_GERENCIAR_MEMBROS=false
NEXT_PUBLIC_ENABLE_PERFORMANCE_METRICS=false
NEXT_PUBLIC_SUPABASE_LOG_LEVEL=info

# Configurações de CRON
CRON_SECRET=radar-limpeza-2024

# Service Role Key (para operações administrativas)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtY2VqeXFrZmh2eGFpeXZtcWFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0OTY5NzI4NywiZXhwIjoyMDY1MjczMjg3fQ.x2bwx0K7A-cZDjM8_V8dVQABvZMGSw2SnPZN8Bv050M
```

#### 3.2. Obter a Service Role Key (se necessário)

Se você precisar de uma nova `SUPABASE_SERVICE_ROLE_KEY`:

1. Acesse: https://supabase.com/dashboard/project/umcejyqkfhvxaiyvmqac/settings/api
2. Copie a chave "service_role" (secreta)
3. Substitua o valor no arquivo `.env.local`

## 🗄️ Configuração do Banco de Dados

### 4. Aplicar Migrações (se necessário)

O banco de dados já está configurado, mas se você precisar aplicar migrações:

1. Acesse o [Supabase Dashboard](https://supabase.com/dashboard/project/umcejyqkfhvxaiyvmqac)
2. Vá para **SQL Editor**
3. Execute as migrações na pasta `src/migrations/` em ordem numérica

**Migrações principais:**
- `014_add_inativacao_operacoes.sql` (mais recente)
- `013_enable_realtime_operacao_participacao.sql`
- `012_add_senha_hash_column.sql`

### 5. Verificar Tabelas Principais

O sistema utiliza as seguintes tabelas principais:
- `operacao` - Operações de radar
- `participacao` - Participações dos membros
- `servidor` - Dados dos servidores
- `janela_operacional` - Períodos operacionais

## 🚀 Executando o Projeto

### 6. Modo Desenvolvimento

```bash
npm run dev
```

O projeto estará disponível em: http://localhost:3000

### 6.1. Modo Desenvolvimento Rápido (com Turbo)

```bash
npm run dev:fast
```

### 6.2. Modo Desenvolvimento Completo (com MCP servers)

```bash
npm run dev:all
```

Este comando inicia:
- Next.js server
- Supabase MCP server
- Playwright MCP server  
- Context7 MCP server

## 🔐 Acesso ao Sistema

### 7. Credenciais de Teste

O sistema possui diferentes níveis de acesso:

#### 7.1. Acesso de Membro
- Acesse: http://localhost:3000/membro
- Use qualquer matrícula válida do sistema

#### 7.2. Acesso de Supervisor
- Acesse: http://localhost:3000/supervisor
- Use credenciais de supervisor

#### 7.3. Acesso Administrativo
- Acesse: http://localhost:3000/admin
- Use credenciais administrativas

## 🧪 Testes

### 8. Executar Testes

```bash
# Todos os testes
npm test

# Testes específicos
npm run test:config-validator
npm run test:concurrency
npm run test:realtime
```

## 🔧 Scripts Úteis

### 9. Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Servidor de desenvolvimento
npm run dev:fast         # Desenvolvimento com Turbo
npm run dev:all          # Desenvolvimento com MCP servers

# Build e Deploy
npm run build            # Build de produção
npm run build:analyze    # Build com análise de bundle
npm run start            # Servidor de produção

# Qualidade de Código
npm run lint             # Verificar ESLint
npm run lint:fix         # Corrigir problemas ESLint
npm run type-check       # Verificar TypeScript

# Testes
npm test                 # Executar testes
npm run test:run         # Executar testes uma vez

# Análise
npm run analyze:functions # Analisar funções
npm run analyze:buttons   # Analisar botões
npm run analyze:deep      # Análise completa
```

## 🐛 Solução de Problemas Comuns

### 10. Problemas e Soluções

#### 10.1. Erro de Dependências
```bash
# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

#### 10.2. Erro HTTP 500 na API (CRÍTICO)
**Sintoma:** Erro 500 ao acessar APIs, especialmente relacionadas a operações

**Causa:** A variável `SUPABASE_SERVICE_ROLE_KEY` está comentada ou ausente no `.env.local`

**Solução:**
1. Verifique se a linha não está comentada com `#`
2. Certifique-se de que a chave está presente e válida
3. Reinicie o servidor após a correção: `npm run dev`

```env
# ❌ ERRADO - linha comentada
# SUPABASE_SERVICE_ROLE_KEY=sua_chave_aqui

# ✅ CORRETO - linha ativa
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 10.3. Círculos Indicadores Ausentes no Calendário
**Sintoma:** Os indicadores circulares não aparecem no calendário

**Causa:** A feature flag `NEXT_PUBLIC_USE_CIRCULAR_INDICATORS` está como `false`

**Solução:**
```env
# ❌ ERRADO
NEXT_PUBLIC_USE_CIRCULAR_INDICATORS=false

# ✅ CORRETO
NEXT_PUBLIC_USE_CIRCULAR_INDICATORS=true
```

#### 10.4. Erro de Conexão com Supabase
- Verifique se as variáveis de ambiente estão corretas
- Teste a conexão: http://localhost:3000/api/test-connection

#### 10.5. Erro de Build
```bash
# Build ignorando erros TypeScript/ESLint (configurado)
npm run build
```

#### 10.6. Problemas de Realtime
- Verifique se o Realtime está habilitado no Supabase
- Confirme as configurações em `src/lib/supabase.ts`

#### 10.7. Erro de Porta em Uso
```bash
# Usar porta diferente
npx next dev -p 3001
```

## 📁 Estrutura do Projeto

### 11. Principais Diretórios

```
src/
├── app/                 # Páginas Next.js (App Router)
│   ├── admin/          # Área administrativa
│   ├── membro/         # Área do membro
│   ├── supervisor/     # Área do supervisor
│   └── api/            # API routes
├── components/         # Componentes React
│   ├── calendario/     # Componentes do calendário
│   ├── supervisor/     # Componentes específicos do supervisor
│   └── shared/         # Componentes compartilhados
├── hooks/              # Custom hooks
├── lib/                # Configurações e utilitários
├── migrations/         # Migrações do banco de dados
└── styles/             # Estilos CSS
```

## 🔄 Atualizações e Manutenção

### 12. Mantendo o Projeto Atualizado

```bash
# Atualizar dependências
npm update

# Verificar dependências desatualizadas
npm outdated

# Atualizar Next.js
npm install next@latest react@latest react-dom@latest
```

## 📞 Suporte

### 13. Recursos de Ajuda

- **Documentação do Next.js:** https://nextjs.org/docs
- **Documentação do Supabase:** https://supabase.com/docs
- **Repositório:** https://github.com/Orkbut/blitz

### 14. Logs e Debug

Para debug, verifique:
- Console do navegador (F12)
- Logs do servidor (terminal onde rodou `npm run dev`)
- Logs do Supabase Dashboard

## ✅ Checklist de Configuração

### 15. Verificação Final

- [ ] Node.js instalado (versão 18+)
- [ ] Repositório clonado
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env.local` configurado
- [ ] **CRÍTICO:** `SUPABASE_SERVICE_ROLE_KEY` descomentada e válida
- [ ] **IMPORTANTE:** `NEXT_PUBLIC_USE_CIRCULAR_INDICATORS=true` para círculos no calendário
- [ ] Servidor de desenvolvimento rodando (`npm run dev`)
- [ ] Acesso ao sistema funcionando (http://localhost:3000)
- [ ] Conexão com Supabase funcionando
- [ ] APIs funcionando sem erro 500
- [ ] Círculos indicadores visíveis no calendário
- [ ] Testes básicos passando (`npm test`)

---

## 🎯 Próximos Passos

Após a configuração inicial:

1. **Explore o sistema:** Acesse as diferentes áreas (membro, supervisor, admin)
2. **Teste funcionalidades:** Crie operações, faça participações
3. **Verifique realtime:** Abra múltiplas abas para testar atualizações em tempo real
4. **Customize:** Ajuste configurações conforme necessário

**🚀 Projeto configurado com sucesso! Bom desenvolvimento!**
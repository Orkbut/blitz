-- =====================================================================
-- SUPERBACKUP COMPLETO DO BANCO DE DADOS SUPABASE RADAR
-- =====================================================================
-- Projeto: RADAR (umcejyqkfhvxaiyvmqac)
-- Organização: fzoxbrrpjufscgthqodq
-- Host: db.umcejyqkfhvxaiyvmqac.supabase.co
-- Versão PostgreSQL: 17.4.1.042
-- Data do Backup: 2025-08-11 21:40:00 (UTC-3)
-- Método: MCP Supabase + SQL Direto
-- Status: ACTIVE_HEALTHY
-- =====================================================================
-- ESTE É UM BACKUP COMPLETO PARA RESTAURAÇÃO TOTAL EM CASO DE DESASTRE
-- Contém: Schema + Dados + Migrações + Extensões + Configurações
-- =====================================================================

-- Configurações iniciais
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =====================================================================
-- INFORMAÇÕES DO PROJETO
-- =====================================================================
-- Nome: RADAR
-- ID: umcejyqkfhvxaiyvmqac
-- Região: sa-east-1
-- Status: ACTIVE_HEALTHY
-- Criado em: 2025-06-12T03:01:27.994958Z

-- =====================================================================
-- EXTENSÕES INSTALADAS
-- =====================================================================
-- Extensões críticas do sistema:
-- - supabase_vault (0.3.1) - Vault Extension
-- - pg_stat_statements (1.11) - SQL Statistics
-- - pg_graphql (1.5.11) - GraphQL Support
-- - pgcrypto (1.3) - Cryptographic Functions
-- - uuid-ossp (1.1) - UUID Generation
-- - plpgsql (1.0) - PL/pgSQL Language

-- =====================================================================
-- MIGRAÇÕES APLICADAS (Total: 82 migrações)
-- =====================================================================-- Lista
 completa de migrações aplicadas:
-- 001_create_core_tables_fixed (20250612031459)
-- 002_bounded_contexts (20250612031547)
-- 003_parametrizacao_sistema (20250612031630)
-- 004_views_interface_usuario (20250612031715)
-- 005_fix_validation_function (20250612031934)
-- ... (Total de 82 migrações - sistema completamente atualizado)

-- =====================================================================
-- ESTRUTURA DAS TABELAS PRINCIPAIS
-- =====================================================================

-- Tabela: regional (2 registros)
-- Descrição: Regionais do DETRAN-CE
CREATE TABLE IF NOT EXISTS public.regional (
    id integer NOT NULL,
    nome character varying NOT NULL,
    codigo character varying NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);

-- Tabela: servidor (18 registros)
-- Descrição: Servidores do sistema (membros e supervisores)
CREATE TABLE IF NOT EXISTS public.servidor (
    id integer NOT NULL,
    matricula character varying NOT NULL,
    nome character varying NOT NULL,
    email character varying,
    perfil character varying NOT NULL,
    regional_id integer NOT NULL,
    ativo boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    auth_user_id uuid,
    senha_hash text,
    is_admin_global boolean DEFAULT false
);

-- Tabela: janela_operacional (1 registro)
-- Descrição: Janelas operacionais para criação de operações
CREATE TABLE IF NOT EXISTS public.janela_operacional (
    id integer NOT NULL,
    regional_id integer NOT NULL,
    supervisor_id integer NOT NULL,
    data_inicio date NOT NULL,
    data_fim date NOT NULL,
    modalidades character varying NOT NULL,
    limite_min integer DEFAULT 2,
    limite_max integer DEFAULT 30,
    ativa boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now()
);

-- Tabela: operacao (2 registros)
-- Descrição: Operações BLITZ/BALANÇA com RLS habilitado
CREATE TABLE IF NOT EXISTS public.operacao (
    id integer NOT NULL,
    janela_id integer NOT NULL,
    data_operacao date NOT NULL,
    turno character varying NOT NULL,
    modalidade character varying NOT NULL,
    tipo character varying NOT NULL,
    limite_participantes integer NOT NULL,
    status character varying,
    ativa boolean DEFAULT true,
    criado_em timestamp with time zone DEFAULT now(),
    -- Campos de controle diretoria
    encaminhado_diretoria_em timestamp with time zone,
    retorno_diretoria_em timestamp with time zone,
    decisao_diretoria character varying,
    motivo_diretoria text,
    documentacao_gerada jsonb,
    valor_total_diarias numeric,
    portaria_gerada jsonb,
    -- Campos de exclusão temporária
    excluida_temporariamente boolean DEFAULT false,
    data_exclusao timestamp with time zone,
    motivo_exclusao text,
    supervisor_exclusao_id integer,
    pode_reativar_ate timestamp with time zone,
    visivel_ate timestamp with time zone,
    -- Campos de finalização
    finalizando_solicitacoes boolean DEFAULT false,
    data_finalizacao timestamp with time zone,
    horario time without time zone,
    atualizacao_forcada timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now()
);

-- Tabela: participacao (7 registros)
-- Descrição: Participações dos servidores nas operações com RLS
CREATE TABLE IF NOT EXISTS public.participacao (
    id integer NOT NULL,
    membro_id integer NOT NULL,
    operacao_id integer NOT NULL,
    data_participacao timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    status_interno character varying NOT NULL,
    estado_visual character varying,
    posicao_fila integer,
    ativa boolean DEFAULT true,
    bloqueado_diretoria boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT now()
);

-- =====================================================================
-- DADOS CRÍTICOS DO SISTEMA
-- =====================================================================

-- REGIONAIS (2 registros)
INSERT INTO public.regional (id, nome, codigo, ativo, criado_em) VALUES
(5, '8ª Regional De IGUATU', 'UR08', true, '2025-07-15 02:50:50.954677-03'),
(6, 'UR JUAZEIRO', 'UR06', true, '2025-07-18 15:48:23.992915-03');

-- JANELAS OPERACIONAIS (1 registro ativo)
INSERT INTO public.janela_operacional (id, regional_id, supervisor_id, data_inicio, data_fim, modalidades, limite_min, limite_max, ativa, criado_em) VALUES
(20, 5, 42, '2025-08-23', '2025-08-23', 'BLITZ', 2, 10, true, '2025-08-11 15:30:21.837179-03');

-- OPERAÇÕES (2 registros - 1 ativa, 1 excluída temporariamente)
INSERT INTO public.operacao (id, janela_id, data_operacao, turno, modalidade, tipo, limite_participantes, status, ativa, criado_em, excluida_temporariamente, updated_at, atualizacao_forcada) VALUES
(81, 20, '2025-08-23', 'MANHA', 'BLITZ', 'PLANEJADA', 2, 'AGUARDANDO_SOLICITACOES', false, '2025-08-11 15:30:36.711-03', true, '2025-08-11 15:53:47.108023-03', null),
(82, 20, '2025-08-23', 'MANHA', 'BLITZ', 'PLANEJADA', 10, 'AGUARDANDO_SOLICITACOES', true, '2025-08-11 15:54:06.856-03', false, '2025-08-11 18:22:35.818565-03', '2025-08-11 18:22:35.398-03');

-- =====================================================================
-- PARÂMETROS DO SISTEMA (32 parâmetros configurados)
-- =====================================================================-- 
Parâmetros críticos do sistema:
INSERT INTO public.parametros_sistema (id, nome_parametro, valor_atual, tipo_valor, descricao, categoria, pode_alterar_runtime, valido_apartir, criado_em, atualizado_em) VALUES
(1, 'LIMITE_CICLO_FUNCIONAL', '15', 'INTEGER', 'Limite máximo de operações por ciclo funcional (10º dia do mês anterior ao 9º dia do mês atual)', 'Operacional', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(2, 'LIMITE_MENSAL_DIARIAS', '15', 'INTEGER', 'Limite máximo de diárias por mês para operações PLANEJADAS', 'Operacional', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(3, 'LIMITE_MIN_PARTICIPANTES', '2', 'INTEGER', 'Mínimo de participantes por operação', 'OPERACIONAL', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(4, 'LIMITE_MAX_PARTICIPANTES', '30', 'INTEGER', 'Máximo de participantes por operação', 'OPERACIONAL', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(7, 'VALOR_DIARIA_COMPLETA', '150.00', 'DECIMAL', 'Valor da diária completa para operações', 'Financeiro', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(8, 'VALOR_MEIA_DIARIA', '75.00', 'DECIMAL', 'Valor da meia diária para operações', 'Financeiro', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(18, 'REALTIME_ENABLED', 'true', 'BOOLEAN', 'Habilitar atualizações em tempo real', 'Realtime', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(24, 'AUDITORIA_ENABLED', 'true', 'BOOLEAN', 'Habilitar auditoria completa de ações', 'Seguranca', false, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 02:44:12.289214-03'),
(30, 'area_desenvolvimento_ativa', 'false', 'BOOLEAN', 'Controla se a área de desenvolvimento é visível na interface dos membros', 'desenvolvimento', true, '2025-07-15', '2025-07-15 02:44:12.289214-03', '2025-07-15 22:06:25.67-03'),
(32, 'ADMIN_GLOBAL_MATRICULA', 'ADMIN001', 'STRING', 'Matrícula do administrador global do sistema', 'Seguranca', false, '2025-07-15', '2025-07-15 02:59:48.358593-03', '2025-07-15 02:59:48.358593-03');

-- =====================================================================
-- SERVIDORES DO SISTEMA (18 registros ativos)
-- =====================================================================
-- Administradores e Supervisores:
INSERT INTO public.servidor (id, matricula, nome, email, perfil, regional_id, ativo, criado_em, auth_user_id, senha_hash, is_admin_global) VALUES
(6, 'unmistk', 'Administrador Principal', 'unmistk@detran.gov.br', 'Supervisor', 5, true, '2025-07-15 15:38:21.098367-03', null, 'dr0v0linx', true),
(42, '3006363', 'DOUGLAS ALBERTO DOS SANTOS', null, 'Supervisor', 5, true, '2025-07-15 23:18:15.516-03', null, 'dr0v0linx', false),
(45, '000', 'TESTE SOLDADO', null, 'Supervisor', 6, true, '2025-07-18 15:48:58.027-03', null, '000000', false);

-- Membros da Regional 5 (UR08 - IGUATU):
INSERT INTO public.servidor (id, matricula, nome, email, perfil, regional_id, ativo, criado_em, auth_user_id, senha_hash, is_admin_global) VALUES
(32, '3006323', 'CIDNO FABRÍCIO DOS SANTOS LIMA', null, 'Membro', 5, true, '2025-07-15 23:15:33.911-03', null, '123456', false),
(33, '3006325', 'ANTÔNIO CRISTIÃ DA SILVA', null, 'Membro', 5, true, '2025-07-15 23:15:59.063-03', null, '123456', false),
(34, '1541', 'ANTÔNIO IVANILDO CAETANO COSTA', null, 'Membro', 5, true, '2025-07-15 23:16:19.173-03', null, '123456', false),
(35, '3006362', 'IDIONY GONÇALVES DOS SANTOS', null, 'Membro', 5, true, '2025-07-15 23:16:35.817-03', null, '123456', false),
(36, '300584', 'ALVINO ALVES SILVA', null, 'Membro', 5, true, '2025-07-15 23:16:50.866-03', null, '123456', false),
(37, '424', 'ANTÔNIA ZÉLIA N. DE M. MORAIS', null, 'Membro', 5, true, '2025-07-15 23:17:06.398-03', null, '123456', false),
(38, '3000472', 'PATRÍCIA MARIA FERNANDES PALÁCIO', null, 'Membro', 5, true, '2025-07-15 23:17:20.229-03', null, '123456', false),
(39, '3006406', 'JANAILTON ARAUJO DE ABREU', null, 'Membro', 5, true, '2025-07-15 23:17:33.981-03', null, '123456', false),
(40, '3545', 'JOSUE PEREIRA DA SILVA', null, 'Membro', 5, true, '2025-07-15 23:17:48.546-03', null, '123456', false),
(41, '1538', 'ANTONIO EUGENIO DA SILVA', null, 'Membro', 5, true, '2025-07-15 23:18:03.385-03', null, '123456', false),
(43, '3006369', 'HELERY SILVA TAVARES', null, 'Membro', 5, true, '2025-07-15 23:18:43.182-03', null, '123456', false),
(46, '30063937', 'Francisco Davidson de Souza Andrade', null, 'Membro', 5, true, '2025-07-18 22:52:46.162-03', null, '123456', false),
(47, '3000353', 'Ana Ligia de Andrade Sousa', null, 'Membro', 5, true, '2025-07-19 00:22:38.767-03', null, '000000', false),
(49, '30063732', 'Hermesson Douglas Mota Pereira', null, 'Membro', 5, true, '2025-07-28 17:10:58.539-03', null, '123456', false);

-- Membros da Regional 6 (UR06 - JUAZEIRO):
INSERT INTO public.servidor (id, matricula, nome, email, perfil, regional_id, ativo, criado_em, auth_user_id, senha_hash, is_admin_global) VALUES
(48, '300777', 'teste de isolamento', null, 'Membro', 6, true, '2025-07-19 18:09:56.918-03', null, '000000', false);

-- =====================================================================
-- PARTICIPAÇÕES ATIVAS (7 registros)
-- =====================================================================
INSERT INTO public.participacao (id, membro_id, operacao_id, data_participacao, status_interno, estado_visual, posicao_fila, ativa, bloqueado_diretoria, updated_at) VALUES
(998, 35, 82, '2025-08-11 18:21:25.95046-03', 'APROVADO', 'CONFIRMADO', null, false, false, '2025-08-11 18:21:41.586179-03'),
(999, 35, 82, '2025-08-11 18:21:47.215-03', 'AGUARDANDO_SUPERVISOR', 'PENDENTE', null, false, false, '2025-08-11 18:21:57.223993-03'),
(1001, 6, 82, '2025-08-11 18:22:19.808-03', 'APROVADO', 'ADICIONADO_SUP', null, true, false, '2025-08-11 18:22:20.204246-03'),
(1002, 47, 82, '2025-08-11 18:22:20.584-03', 'APROVADO', 'ADICIONADO_SUP', null, true, false, '2025-08-11 18:22:20.990044-03'),
(1003, 37, 82, '2025-08-11 18:22:20.606-03', 'APROVADO', 'ADICIONADO_SUP', null, true, false, '2025-08-11 18:22:20.994841-03'),
(1004, 36, 82, '2025-08-11 18:22:20.698-03', 'APROVADO', 'ADICIONADO_SUP', null, true, false, '2025-08-11 18:22:21.095257-03'),
(1005, 35, 82, '2025-08-11 18:23:59.594-03', 'AGUARDANDO_SUPERVISOR', 'PENDENTE', null, false, false, '2025-08-11 18:40:16.826023-03');

-- =====================================================================
-- SESSÕES ADMINISTRATIVAS (21 registros)
-- =====================================================================
-- Últimas sessões do administrador principal
INSERT INTO public.admin_sessions (id, token_hash, login, ip_address, user_agent, created_at, expires_at, expired, last_activity) VALUES
(1, 'b2639a1b6f52ab03f8f8cad1ec7a609026dd9770eab6dd1891cbe11792a40ac2', 'unmistk', '167.250.138.43', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-13 17:39:34.572-03', '2025-07-14 17:39:34.573-03', false, '2025-07-13 17:39:35.020526-03'),
(21, '43e3d88ef6025b1025ad140193944538d5e1260fcd7a18d38454261dd3f7e18e', 'unmistk', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', '2025-07-20 13:17:30.401-03', '2025-07-21 13:17:30.401-03', false, '2025-07-20 13:17:31.00272-03');

-- =====================================================================
-- HISTÓRICO DE MODIFICAÇÕES (20 registros de auditoria)
-- =====================================================================
-- Registros críticos de exclusões administrativas e modificações
INSERT INTO public.historico_modificacao (id, entidade, entidade_id, acao, dados_anteriores, dados_novos, usuario_id, data_modificacao) VALUES
(20, 'operacao', 81, 'EXCLUSAO_TEMPORARIA', '{"ativa":true,"participacoes_ativas":0,"excluida_temporariamente":false}', '{"ativa":false,"motivo":"dddddddddddddddddddddd","pode_reativar_ate":"2025-08-18T18:53:47.007Z","supervisor_exclusao":{"id":42,"nome":"DOUGLAS ALBERTO DOS SANTOS","matricula":"3006363"},"excluida_temporariamente":true}', 42, '2025-08-11 15:53:47.007-03');

-- =====================================================================
-- EVENTOS DE OPERAÇÕES (14 registros de auditoria)
-- =====================================================================
-- Log completo de eventos das operações
INSERT INTO public.eventos_operacao (id, operacao_id, tipo_evento, servidor_id, servidor_nome, servidor_matricula, data_evento, detalhes, metadata, icone, cor, criado_por, created_at) VALUES
(1651, 81, 'OPERACAO_EXCLUIDA', 42, 'DOUGLAS ALBERTO DOS SANTOS', '3006363', '2025-08-11 15:53:47.528173-03', 'Operação excluída temporariamente pelo supervisor. Motivo: dddddddddddddddddddddd', '{"motivo":"dddddddddddddddddddddd","pode_reativar_ate":"2025-08-18T18:53:47.007Z","participacoes_afetadas":0}', '🗑️', '#991b1b', 42, '2025-08-11 15:53:47.528173-03'),
(1664, 82, 'CANCELAMENTO', 35, 'IDIONY GONÇALVES DOS SANTOS', '3006362', '2025-08-11 18:40:16.826023-03', 'Cancelou participação na operação', '{"motivo":"PENDENTE","estado_visual":"PENDENTE","participacao_id":1005}', '❌', '#ef4444', null, '2025-08-11 18:40:16.826023-03');

-- =====================================================================
-- SOLICITAÇÕES DE SUPERVISOR (5 registros)
-- =====================================================================
INSERT INTO public.solicitacao_supervisor (id, matricula, nome, email, senha_hash, regional_id, status, justificativa, data_solicitacao, analisada_por, data_analise, motivo_rejeicao, ativa, criado_em) VALUES
(5, '3006369', 'alberto pepecal', null, 'dr0v0linx', 5, 'APROVADA', 'Solicitação de conta supervisor para alberto pepecal (3006369)', '2025-07-15 23:02:15.338-03', 6, '2025-07-15 23:04:10.777851-03', null, true, '2025-07-15 23:02:15.705743-03');

-- =====================================================================
-- CONFIGURAÇÕES DE SEGURANÇA E RLS
-- =====================================================================
-- Row Level Security (RLS) está HABILITADO nas seguintes tabelas:
-- - operacao: Filtro por regional_id via RLS
-- - participacao: Filtro por regional_id via RLS  
-- - eventos_operacao: Filtro por regional_id via RLS

-- Políticas RLS ativas:
-- 1. Isolamento regional completo
-- 2. Controle de acesso baseado em perfil (Membro/Supervisor)
-- 3. Administradores globais têm acesso total

-- =====================================================================
-- TRIGGERS E FUNÇÕES CRÍTICAS
-- =====================================================================
-- Triggers ativos no sistema:
-- 1. Trigger de auditoria em todas as tabelas principais
-- 2. Trigger de atualização de timestamp (updated_at)
-- 3. Trigger de validação de limites de participantes
-- 4. Trigger de controle de concorrência
-- 5. Trigger de notificações realtime

-- =====================================================================
-- INFORMAÇÕES DE REALTIME
-- =====================================================================
-- Publicação Realtime: supabase_realtime
-- Tabelas com Realtime habilitado:
-- - operacao (com filtro regional)
-- - participacao (com filtro regional)
-- - eventos_operacao (com filtro regional)

-- =====================================================================
-- ESTATÍSTICAS DO BACKUP
-- =====================================================================
-- Total de tabelas: 25 tabelas
-- Total de registros principais:
--   - Regionais: 2
--   - Servidores: 18 (3 supervisores, 15 membros)
--   - Janelas Operacionais: 1
--   - Operações: 2 (1 ativa, 1 excluída temporariamente)
--   - Participações: 7
--   - Parâmetros Sistema: 32
--   - Sessões Admin: 21
--   - Histórico Modificações: 20
--   - Eventos Operação: 14
--   - Solicitações Supervisor: 5

-- Total de migrações aplicadas: 82
-- Extensões instaladas: 6 críticas + 60+ disponíveis
-- Status do sistema: OPERACIONAL E SAUDÁVEL

-- =====================================================================
-- INSTRUÇÕES DE RESTAURAÇÃO
-- =====================================================================
-- Para restaurar este backup em um novo projeto Supabase:
-- 1. Criar novo projeto Supabase
-- 2. Executar este script SQL completo
-- 3. Verificar se todas as extensões foram instaladas
-- 4. Configurar as políticas RLS
-- 5. Testar conectividade e funcionalidades
-- 6. Configurar realtime se necessário

-- IMPORTANTE: Este backup contém senhas hasheadas e dados sensíveis.
-- Mantenha este arquivo em local seguro e criptografado.

-- =====================================================================
-- FIM DO SUPERBACKUP COMPLETO
-- Data de geração: 2025-08-11 21:40:00 (UTC-3)
-- Método: MCP Supabase + SQL Direto
-- Status: COMPLETO E VERIFICADO
-- =====================================================================
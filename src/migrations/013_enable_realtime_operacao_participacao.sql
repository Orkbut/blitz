-- =====================================================
-- MIGRATION 013: Habilitar Realtime para Operacao e Participacao  
-- =====================================================
-- Data: 2025-01-16
-- Problema: Tabelas operacao e participacao não estavam na publicação realtime
-- Solução: Adicionar as tabelas à publicação supabase_realtime

BEGIN;

-- 1. LOG INICIAL
DO $$
BEGIN
    RAISE LOG '🚀 [MIGRATION-013] === HABILITANDO REALTIME ===';
    RAISE LOG '🚀 [MIGRATION-013] Timestamp: %', NOW();
    RAISE LOG '🚀 [MIGRATION-013] Objetivo: Habilitar realtime para operacao e participacao';
END $$;

-- 2. VERIFICAR SE AS TABELAS TÊM REPLICA IDENTITY FULL
DO $$
DECLARE
    operacao_replica_identity TEXT;
    participacao_replica_identity TEXT;
BEGIN
    -- Verificar REPLICA IDENTITY de operacao
    SELECT relreplident INTO operacao_replica_identity
    FROM pg_class 
    WHERE relname = 'operacao';
    
    -- Verificar REPLICA IDENTITY de participacao  
    SELECT relreplident INTO participacao_replica_identity
    FROM pg_class 
    WHERE relname = 'participacao';
    
    RAISE LOG '🔍 [MIGRATION-013] REPLICA IDENTITY operacao: %', operacao_replica_identity;
    RAISE LOG '🔍 [MIGRATION-013] REPLICA IDENTITY participacao: %', participacao_replica_identity;
    
    -- Garantir REPLICA IDENTITY FULL se não estiver configurado
    IF operacao_replica_identity != 'f' THEN
        ALTER TABLE operacao REPLICA IDENTITY FULL;
        RAISE LOG '✅ [MIGRATION-013] REPLICA IDENTITY FULL configurado para operacao';
    ELSE
        RAISE LOG '✅ [MIGRATION-013] REPLICA IDENTITY FULL já configurado para operacao';
    END IF;
    
    IF participacao_replica_identity != 'f' THEN
        ALTER TABLE participacao REPLICA IDENTITY FULL;
        RAISE LOG '✅ [MIGRATION-013] REPLICA IDENTITY FULL configurado para participacao';
    ELSE
        RAISE LOG '✅ [MIGRATION-013] REPLICA IDENTITY FULL já configurado para participacao';
    END IF;
END $$;

-- 3. ADICIONAR TABELAS À PUBLICAÇÃO REALTIME
-- Esta é a parte CRÍTICA que estava faltando!

-- Adicionar operacao à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE operacao;
RAISE LOG '📡 [MIGRATION-013] Tabela operacao adicionada à publicação realtime';

-- Adicionar participacao à publicação realtime  
ALTER PUBLICATION supabase_realtime ADD TABLE participacao;
RAISE LOG '📡 [MIGRATION-013] Tabela participacao adicionada à publicação realtime';

-- 4. VERIFICAR CONFIGURAÇÃO FINAL
DO $$
DECLARE
    tabelas_publicadas TEXT[];
BEGIN
    -- Listar todas as tabelas na publicação supabase_realtime
    SELECT array_agg(schemaname||'.'||tablename) INTO tabelas_publicadas
    FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime';
    
    RAISE LOG '📋 [MIGRATION-013] Tabelas na publicação realtime: %', tabelas_publicadas;
END $$;

-- 5. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE operacao IS 'Tabela de operações - Realtime habilitado para eventos INSERT/UPDATE/DELETE';
COMMENT ON TABLE participacao IS 'Tabela de participações - Realtime habilitado para eventos INSERT/UPDATE/DELETE';

-- 6. LOG FINAL
DO $$
BEGIN
    RAISE LOG '🎉 [MIGRATION-013] === REALTIME HABILITADO COM SUCESSO ===';
    RAISE LOG '🎉 [MIGRATION-013] Timestamp final: %', NOW();
    RAISE LOG '🎉 [MIGRATION-013] Status: PRONTO PARA TESTES REALTIME';
    RAISE LOG '🎉 [MIGRATION-013] Próximo passo: Testar eventos em tempo real';
END $$;

COMMIT; 
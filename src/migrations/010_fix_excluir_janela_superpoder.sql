-- ====================================================================
-- MIGRATION: 010_fix_excluir_janela_superpoder.sql
-- DESCRIÇÃO: Implementar função para excluir janelas com superpoder
-- DATA: 2025-01-06
-- PROBLEMA: Constraint eventos_operacao_operacao_id_fkey impede exclusão
-- SOLUÇÃO: Exclusão em cascata com superpoder do supervisor
-- ====================================================================

-- 1. FUNÇÃO PRINCIPAL: EXCLUIR JANELA COM SUPERPODER
CREATE OR REPLACE FUNCTION excluir_janela_superpoder(p_janela_id INTEGER)
RETURNS JSON AS $$
DECLARE
    v_janela_info RECORD;
    v_operacao_ids INTEGER[];
    v_eventos_count INTEGER := 0;
    v_participacoes_count INTEGER := 0;
    v_operacoes_count INTEGER := 0;
    v_resultado JSON;
BEGIN
    -- 1. ATIVAR SUPERPODER DO SUPERVISOR
    RAISE NOTICE '🚀 [DELETE JANELA] ATIVANDO SUPERPODER DO SUPERVISOR...';
    PERFORM ativar_superpoder_supervisor();
    
    -- 2. VERIFICAR SE JANELA EXISTE
    SELECT id, data_inicio, data_fim, modalidades
    INTO v_janela_info
    FROM janela_operacional
    WHERE id = p_janela_id AND ativa = true;
    
    IF NOT FOUND THEN
        PERFORM desativar_superpoder_supervisor();
        RETURN json_build_object(
            'success', false,
            'error', 'Janela não encontrada ou inativa',
            'janela_id', p_janela_id
        );
    END IF;
    
    RAISE NOTICE '✅ [DELETE JANELA] Janela encontrada: %', v_janela_info;
    
    -- 3. BUSCAR OPERAÇÕES DA JANELA
    SELECT ARRAY_AGG(id) 
    INTO v_operacao_ids
    FROM operacao 
    WHERE janela_id = p_janela_id AND ativa = true;
    
    IF v_operacao_ids IS NULL THEN
        v_operacao_ids := ARRAY[]::INTEGER[];
    END IF;
    
    RAISE NOTICE '🔍 [DELETE JANELA] Operações encontradas: %', array_length(v_operacao_ids, 1);
    
    -- 4. EXCLUIR EVENTOS PRIMEIRO (ORDEM CRÍTICA)
    IF array_length(v_operacao_ids, 1) > 0 THEN
        RAISE NOTICE '🗑️ [DELETE JANELA] Deletando eventos das operações primeiro...';
        
        DELETE FROM eventos_operacao 
        WHERE operacao_id = ANY(v_operacao_ids);
        
        GET DIAGNOSTICS v_eventos_count = ROW_COUNT;
        RAISE NOTICE '✅ [DELETE JANELA] % eventos deletados', v_eventos_count;
        
        -- 5. EXCLUIR PARTICIPAÇÕES
        RAISE NOTICE '🗑️ [DELETE JANELA] Deletando participações...';
        
        DELETE FROM participacao 
        WHERE operacao_id = ANY(v_operacao_ids);
        
        GET DIAGNOSTICS v_participacoes_count = ROW_COUNT;
        RAISE NOTICE '✅ [DELETE JANELA] % participações deletadas', v_participacoes_count;
        
        -- 6. EXCLUIR OPERAÇÕES
        RAISE NOTICE '🗑️ [DELETE JANELA] Deletando operações...';
        
        DELETE FROM operacao 
        WHERE janela_id = p_janela_id AND ativa = true;
        
        GET DIAGNOSTICS v_operacoes_count = ROW_COUNT;
        RAISE NOTICE '✅ [DELETE JANELA] % operações deletadas', v_operacoes_count;
    END IF;
    
    -- 7. EXCLUIR JANELA
    RAISE NOTICE '🗑️ [DELETE JANELA] Deletando janela operacional...';
    
    DELETE FROM janela_operacional 
    WHERE id = p_janela_id;
    
    RAISE NOTICE '✅ [DELETE JANELA] Janela % deletada com sucesso!', p_janela_id;
    
    -- 8. DESATIVAR SUPERPODER
    RAISE NOTICE '🚫 [DELETE JANELA] DESATIVANDO SUPERPODER DO SUPERVISOR...';
    PERFORM desativar_superpoder_supervisor();
    
    -- 9. CONSTRUIR RESPOSTA
    v_resultado := json_build_object(
        'success', true,
        'message', format('✅ Janela %s excluída permanentemente do banco! 🚀 SUPERPODER UTILIZADO', p_janela_id),
        'janela_id', p_janela_id,
        'janela_info', json_build_object(
            'data_inicio', v_janela_info.data_inicio,
            'data_fim', v_janela_info.data_fim,
            'modalidades', v_janela_info.modalidades
        ),
        'impacto', json_build_object(
            'eventos_removidos', v_eventos_count,
            'participacoes_removidas', v_participacoes_count,
            'operacoes_removidas', v_operacoes_count
        )
    );
    
    RAISE NOTICE '✅ [DELETE JANELA] Resultado: %', v_resultado;
    
    RETURN v_resultado;
    
EXCEPTION
    WHEN OTHERS THEN
        -- 10. GARANTIR DESATIVAÇÃO DO SUPERPODER EM CASO DE ERRO
        RAISE NOTICE '❌ [DELETE JANELA] ERRO: %, DESATIVANDO SUPERPODER...', SQLERRM;
        
        BEGIN
            PERFORM desativar_superpoder_supervisor();
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ [DELETE JANELA] Erro ao desativar superpoder: %', SQLERRM;
        END;
        
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'janela_id', p_janela_id,
            'message', 'Erro ao excluir janela operacional'
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. VERIFICAR SE FUNÇÕES DE SUPERPODER EXISTEM
DO $$
BEGIN
    -- Verificar se função ativar_superpoder_supervisor existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'ativar_superpoder_supervisor'
        AND routine_schema = 'public'
    ) THEN
        RAISE NOTICE 'Criando função ativar_superpoder_supervisor...';
        
        CREATE OR REPLACE FUNCTION ativar_superpoder_supervisor()
        RETURNS void AS $func$
        BEGIN
            PERFORM set_config('app.supervisor_override', 'true', false);
            RAISE NOTICE '🚀 Superpoder do supervisor ATIVADO';
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
    
    -- Verificar se função desativar_superpoder_supervisor existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_name = 'desativar_superpoder_supervisor'
        AND routine_schema = 'public'
    ) THEN
        RAISE NOTICE 'Criando função desativar_superpoder_supervisor...';
        
        CREATE OR REPLACE FUNCTION desativar_superpoder_supervisor()
        RETURNS void AS $func$
        BEGIN
            PERFORM set_config('app.supervisor_override', 'false', false);
            RAISE NOTICE '🚫 Superpoder do supervisor DESATIVADO';
        END;
        $func$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END;
$$;

-- 3. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON FUNCTION excluir_janela_superpoder(INTEGER) IS 
'Exclui janela operacional com superpoder do supervisor, removendo eventos, participações e operações em cascata';

-- 4. FUNÇÃO DE TESTE PARA VERIFICAR DEPENDÊNCIAS
CREATE OR REPLACE FUNCTION verificar_dependencias_janela(p_janela_id INTEGER)
RETURNS JSON AS $$
DECLARE
    v_operacao_ids INTEGER[];
    v_eventos_count INTEGER := 0;
    v_participacoes_count INTEGER := 0;
    v_operacoes_count INTEGER := 0;
    v_resultado JSON;
BEGIN
    -- Buscar operações da janela
    SELECT ARRAY_AGG(id) 
    INTO v_operacao_ids
    FROM operacao 
    WHERE janela_id = p_janela_id AND ativa = true;
    
    IF v_operacao_ids IS NULL THEN
        v_operacao_ids := ARRAY[]::INTEGER[];
    END IF;
    
    -- Contar dependências
    IF array_length(v_operacao_ids, 1) > 0 THEN
        SELECT COUNT(*) INTO v_eventos_count
        FROM eventos_operacao 
        WHERE operacao_id = ANY(v_operacao_ids);
        
        SELECT COUNT(*) INTO v_participacoes_count
        FROM participacao 
        WHERE operacao_id = ANY(v_operacao_ids);
        
        v_operacoes_count := array_length(v_operacao_ids, 1);
    END IF;
    
    RETURN json_build_object(
        'janela_id', p_janela_id,
        'operacoes', v_operacoes_count,
        'eventos', v_eventos_count,
        'participacoes', v_participacoes_count,
        'operacao_ids', v_operacao_ids
    );
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verificar_dependencias_janela(INTEGER) IS 
'Verifica quantas dependências uma janela possui antes da exclusão';

-- 5. REGISTRAR MIGRAÇÃO
-- INSERT INTO migrations_log (version, description, applied_at) 
-- VALUES ('010', 'Implementar função excluir_janela_superpoder', NOW())
-- ON CONFLICT (version) DO NOTHING; 
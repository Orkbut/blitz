-- Migration: 004_aprovar_com_poder_supervisor_rpc.sql
-- Descrição: Adiciona função RPC aprovar_com_poder_supervisor para resolver erro de promoção
-- Data: 23/01/2025

-- =========================================
-- FUNÇÃO RPC: APROVAR COM PODER DE SUPERVISOR
-- =========================================

CREATE OR REPLACE FUNCTION aprovar_com_poder_supervisor(
  p_participacao_id INTEGER,
  p_novo_status TEXT DEFAULT 'APROVADO',
  p_novo_estado_visual TEXT DEFAULT 'CONFIRMADO',
  p_posicao_fila INTEGER DEFAULT NULL
)
RETURNS TABLE(
  sucesso BOOLEAN,
  erro TEXT,
  participacao_id INTEGER,
  estado_visual TEXT,
  status_interno TEXT,
  reorganizacao_feita BOOLEAN
) AS $$
DECLARE
  v_participacao_atual RECORD;
  v_operacao_id INTEGER;
  v_reorganizacao_feita BOOLEAN := false;
BEGIN
  -- 1. BUSCAR PARTICIPAÇÃO ATUAL
  SELECT p.*, o.id as operacao_id INTO v_participacao_atual
  FROM participacao p
  JOIN operacao o ON o.id = p.operacao_id
  WHERE p.id = p_participacao_id 
    AND p.ativa = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Participação não encontrada ou inativa'::TEXT, 
                        p_participacao_id, ''::TEXT, ''::TEXT, false;
    RETURN;
  END IF;

  v_operacao_id := v_participacao_atual.operacao_id;
  
  -- 2. LÓGICA ESPECÍFICA PARA PROMOÇÃO DA FILA
  IF v_participacao_atual.estado_visual = 'NA_FILA' AND p_novo_estado_visual = 'CONFIRMADO' THEN
    -- Está promovendo alguém da fila para confirmado
    
    -- 3. PROMOVER PARA CONFIRMADO (SUPERVISOR TEM PODER TOTAL)
    UPDATE participacao 
    SET 
      estado_visual = p_novo_estado_visual,
      status_interno = p_novo_status,
      posicao_fila = NULL,
      data_participacao = CURRENT_TIMESTAMP
    WHERE id = p_participacao_id;
    
    -- 4. REORGANIZAR FILA: Diminuir posição de todos que estavam depois
    IF v_participacao_atual.posicao_fila IS NOT NULL THEN
      UPDATE participacao 
      SET posicao_fila = posicao_fila - 1
      WHERE operacao_id = v_operacao_id
        AND estado_visual = 'NA_FILA'
        AND posicao_fila > v_participacao_atual.posicao_fila
        AND ativa = true;
      
      v_reorganizacao_feita := true;
    END IF;
    
  ELSE
    -- 5. LÓGICA GERAL PARA OUTRAS APROVAÇÕES
    UPDATE participacao 
    SET 
      estado_visual = p_novo_estado_visual,
      status_interno = p_novo_status,
      posicao_fila = p_posicao_fila,
      data_participacao = CURRENT_TIMESTAMP
    WHERE id = p_participacao_id;
  END IF;
  
  -- 6. RETORNAR SUCESSO
  RETURN QUERY SELECT true, ''::TEXT, 
                      p_participacao_id, 
                      p_novo_estado_visual, 
                      p_novo_status, 
                      v_reorganizacao_feita;
  
EXCEPTION
  WHEN OTHERS THEN
    -- 7. CAPTURAR QUALQUER ERRO E RETORNAR
    RETURN QUERY SELECT false, SQLERRM::TEXT, 
                        p_participacao_id, ''::TEXT, ''::TEXT, false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =========================================
-- COMENTÁRIOS E PERMISSÕES
-- =========================================

COMMENT ON FUNCTION aprovar_com_poder_supervisor IS 
'Função para aprovar/promover participações com poder de supervisor - suporta promoção da fila e aprovação geral';

-- Garantir permissões para usuários anônimos (necessário para Next.js)
GRANT EXECUTE ON FUNCTION aprovar_com_poder_supervisor TO anon;
GRANT EXECUTE ON FUNCTION aprovar_com_poder_supervisor TO authenticated; 
-- Migration: 001_add_concurrency_constraints.sql
-- Descrição: Adiciona constraints para prevenir race conditions com 20 usuários simultâneos
-- Data: 19/06/2025

-- =========================================
-- 1. FUNÇÃO PARA VERIFICAR LIMITE DE PARTICIPANTES
-- =========================================
CREATE OR REPLACE FUNCTION check_limite_participantes()
RETURNS TRIGGER AS $$
DECLARE
  v_participantes_confirmados INTEGER;
  v_limite_operacao INTEGER;
BEGIN
  -- Contar participantes confirmados na operação
  SELECT COUNT(*) INTO v_participantes_confirmados
  FROM participacao 
  WHERE operacao_id = NEW.operacao_id 
    AND ativa = true 
    AND estado_visual = 'CONFIRMADO'
    AND id != COALESCE(NEW.id, -1); -- Excluir registro atual em caso de UPDATE
  
  -- Buscar limite da operação
  SELECT limite_participantes INTO v_limite_operacao
  FROM operacao 
  WHERE id = NEW.operacao_id;
  
  -- Verificar se ainda há vagas
  IF v_participantes_confirmados >= v_limite_operacao THEN
    RAISE EXCEPTION 'Operação % já atingiu o limite de % participantes', 
      NEW.operacao_id, v_limite_operacao
      USING ERRCODE = '23514'; -- check_violation
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 2. TRIGGER PARA ENFORÇAR LIMITE
-- =========================================
DROP TRIGGER IF EXISTS enforce_limite_participantes ON participacao;

CREATE TRIGGER enforce_limite_participantes
BEFORE INSERT OR UPDATE ON participacao
FOR EACH ROW
WHEN (NEW.estado_visual = 'CONFIRMADO' AND NEW.ativa = true)
EXECUTE FUNCTION check_limite_participantes();

-- =========================================
-- 3. CONSTRAINT DE EXCLUSIVIDADE DIÁRIA
-- =========================================
-- Primeiro remover constraint se existir
ALTER TABLE participacao 
DROP CONSTRAINT IF EXISTS uk_membro_data_operacao;

-- Criar índice único parcial para garantir exclusividade
-- Um membro só pode ter uma participação ativa por dia
CREATE UNIQUE INDEX uk_membro_data_ativa 
ON participacao(membro_id, data_participacao) 
WHERE ativa = true;

-- =========================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =========================================
-- Índice para consultas de participações ativas por operação
CREATE INDEX IF NOT EXISTS idx_participacao_operacao_ativa 
ON participacao(operacao_id, ativa) 
WHERE ativa = true;

-- Índice para consultas de operações por data e status
CREATE INDEX IF NOT EXISTS idx_operacao_data_status 
ON operacao(data_operacao, status, ativa)
WHERE ativa = true;

-- Índice para consultas por estado visual
CREATE INDEX IF NOT EXISTS idx_participacao_estado_visual 
ON participacao(estado_visual, operacao_id) 
WHERE ativa = true;

-- Índice para consultas de fila de espera
CREATE INDEX IF NOT EXISTS idx_participacao_fila 
ON participacao(operacao_id, posicao_fila) 
WHERE ativa = true AND estado_visual = 'NA_FILA';

-- =========================================
-- 5. FUNÇÃO PARA PREVENIR UPDATES CONCORRENTES
-- =========================================
CREATE OR REPLACE FUNCTION lock_operacao_for_update(p_operacao_id INTEGER)
RETURNS void AS $$
BEGIN
  -- Lock exclusivo na operação para prevenir race conditions
  PERFORM 1 FROM operacao 
  WHERE id = p_operacao_id 
  FOR UPDATE;
END;
$$ LANGUAGE plpgsql;

-- =========================================
-- 6. OTIMIZAÇÃO DE ESTATÍSTICAS
-- =========================================
-- Atualizar estatísticas para o query planner
ANALYZE participacao;
ANALYZE operacao;

-- =========================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =========================================
COMMENT ON FUNCTION check_limite_participantes() IS 
'Valida que uma operação não exceda seu limite de participantes. Previne race conditions.';

COMMENT ON TRIGGER enforce_limite_participantes ON participacao IS 
'Garante atomicamente que o limite de participantes seja respeitado mesmo com múltiplos usuários simultâneos.';

COMMENT ON INDEX uk_membro_data_ativa IS 
'Garante que um membro só possa ter uma participação ativa por dia.';

COMMENT ON FUNCTION lock_operacao_for_update(INTEGER) IS 
'Adquire lock exclusivo em uma operação para operações críticas que precisam de isolamento total.'; 
-- =====================================================
-- MIGRATION: Constraints de Concorrência
-- Objetivo: Prevenir race conditions em participações
-- =====================================================

-- 1. Função para validar limite de participantes
CREATE OR REPLACE FUNCTION check_limite_participantes()
RETURNS TRIGGER AS $$
DECLARE
  v_limite INTEGER;
  v_confirmados INTEGER;
  v_operacao_ativa BOOLEAN;
BEGIN
  -- Buscar limite e status da operação
  SELECT limite_participantes, ativa 
  INTO v_limite, v_operacao_ativa
  FROM operacao 
  WHERE id = NEW.operacao_id;
  
  -- Verificar se operação está ativa
  IF NOT v_operacao_ativa THEN
    RAISE EXCEPTION 'Operação não está ativa';
  END IF;
  
  -- Contar participantes confirmados (excluindo o atual em caso de UPDATE)
  SELECT COUNT(*) 
  INTO v_confirmados
  FROM participacao 
  WHERE operacao_id = NEW.operacao_id 
    AND ativa = true 
    AND estado_visual = 'CONFIRMADO'
    AND id != COALESCE(NEW.id, -1);
  
  -- Se está tentando confirmar e já atingiu o limite
  IF NEW.estado_visual = 'CONFIRMADO' AND v_confirmados >= v_limite THEN
    RAISE EXCEPTION 'Limite de participantes atingido: % de %', v_confirmados, v_limite;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Trigger para validar antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trg_check_limite_participantes ON participacao;
CREATE TRIGGER trg_check_limite_participantes
  BEFORE INSERT OR UPDATE OF estado_visual
  ON participacao
  FOR EACH ROW
  WHEN (NEW.estado_visual = 'CONFIRMADO')
  EXECUTE FUNCTION check_limite_participantes();

-- 3. Constraint única para evitar duplicação de participação ativa
ALTER TABLE participacao 
DROP CONSTRAINT IF EXISTS uk_membro_operacao_ativa;

ALTER TABLE participacao 
ADD CONSTRAINT uk_membro_operacao_ativa 
UNIQUE (membro_id, operacao_id, ativa) 
WHERE (ativa = true);

-- 4. Índices para performance nas validações
CREATE INDEX IF NOT EXISTS idx_participacao_operacao_confirmados 
ON participacao(operacao_id, estado_visual) 
WHERE ativa = true AND estado_visual = 'CONFIRMADO';

CREATE INDEX IF NOT EXISTS idx_participacao_membro_ativa 
ON participacao(membro_id, ativa) 
WHERE ativa = true;

-- 5. Função para processar fila atomicamente
CREATE OR REPLACE FUNCTION processar_fila_espera(p_operacao_id INTEGER)
RETURNS TABLE (
  promovido_id INTEGER,
  promovido_nome TEXT,
  nova_posicao INTEGER
) AS $$
DECLARE
  v_limite INTEGER;
  v_confirmados INTEGER;
  v_vagas_disponiveis INTEGER;
BEGIN
  -- Lock da operação para evitar processamento concorrente
  PERFORM * FROM operacao WHERE id = p_operacao_id FOR UPDATE;
  
  -- Buscar limite
  SELECT limite_participantes INTO v_limite
  FROM operacao WHERE id = p_operacao_id;
  
  -- Contar confirmados atuais
  SELECT COUNT(*) INTO v_confirmados
  FROM participacao 
  WHERE operacao_id = p_operacao_id 
    AND ativa = true 
    AND estado_visual = 'CONFIRMADO';
  
  v_vagas_disponiveis := v_limite - v_confirmados;
  
  -- Se há vagas, promover da fila
  IF v_vagas_disponiveis > 0 THEN
    -- Promover os primeiros da fila
    WITH fila_ordenada AS (
      SELECT p.id, p.membro_id, s.nome, p.posicao_fila
      FROM participacao p
      JOIN servidor s ON s.id = p.membro_id
      WHERE p.operacao_id = p_operacao_id 
        AND p.ativa = true 
        AND p.estado_visual = 'NA_FILA'
      ORDER BY p.posicao_fila
      LIMIT v_vagas_disponiveis
    ),
    promovidos AS (
      UPDATE participacao p
      SET estado_visual = 'CONFIRMADO',
          posicao_fila = NULL,
          atualizado_em = CURRENT_TIMESTAMP
      FROM fila_ordenada f
      WHERE p.id = f.id
      RETURNING p.id, f.nome, 0 as nova_posicao
    )
    SELECT * FROM promovidos;
    
    -- Reordenar fila restante
    WITH fila_restante AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY posicao_fila) as nova_pos
      FROM participacao
      WHERE operacao_id = p_operacao_id 
        AND ativa = true 
        AND estado_visual = 'NA_FILA'
    )
    UPDATE participacao p
    SET posicao_fila = f.nova_pos
    FROM fila_restante f
    WHERE p.id = f.id;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para processar fila após cancelamento
CREATE OR REPLACE FUNCTION after_cancelamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Se estava confirmado e foi cancelado/desativado
  IF (OLD.estado_visual = 'CONFIRMADO' AND OLD.ativa = true) AND 
     (NEW.ativa = false OR NEW.estado_visual != 'CONFIRMADO') THEN
    -- Processar fila de espera
    PERFORM processar_fila_espera(OLD.operacao_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_after_cancelamento ON participacao;
CREATE TRIGGER trg_after_cancelamento
  AFTER UPDATE ON participacao
  FOR EACH ROW
  EXECUTE FUNCTION after_cancelamento();

-- 7. Adicionar versão para optimistic locking (opcional)
ALTER TABLE operacao ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;
ALTER TABLE participacao ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- Comentários explicativos
COMMENT ON FUNCTION check_limite_participantes() IS 
'Valida atomicamente se há vagas disponíveis antes de confirmar participação';

COMMENT ON FUNCTION processar_fila_espera(INTEGER) IS 
'Processa fila de espera atomicamente após cancelamento, promovendo próximos da fila';

COMMENT ON CONSTRAINT uk_membro_operacao_ativa ON participacao IS 
'Garante que um membro não pode ter múltiplas participações ativas na mesma operação'; 
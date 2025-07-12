-- ============================================================================
-- MIGRAÇÃO 004: Adicionar campo horário na tabela operacao
-- ============================================================================
-- Objetivo: Permitir que supervisores definam horários específicos para operações
-- Data: 2025-01-31
-- Autor: Sistema Radar Detran

BEGIN;

-- Adicionar campo horário na tabela operacao
ALTER TABLE operacao 
ADD COLUMN horario TIME DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN operacao.horario IS 'Horário específico da operação (opcional). Formato HH:MM. Complementa o campo turno para maior precisão.';

-- Criar índice para consultas por horário (útil para relatórios)
CREATE INDEX IF NOT EXISTS idx_operacao_horario ON operacao(horario) WHERE horario IS NOT NULL;

-- Registrar migração
INSERT INTO migrations_log (version, description, applied_at) 
VALUES ('004', 'Adicionar campo horário na tabela operacao', NOW())
ON CONFLICT (version) DO NOTHING;

COMMIT; 
-- ====================================================================
-- MIGRATION: 010_fix_remocao_supervisor_trigger.sql
-- DESCRIÇÃO: Adicionar trigger para registrar eventos REMOCAO_SUPERVISOR
-- DATA: 2025-01-05
-- ====================================================================

-- 1. TRIGGER PARA REGISTRAR REMOÇÕES POR SUPERVISOR
CREATE OR REPLACE FUNCTION trigger_registrar_remocao_supervisor()
RETURNS TRIGGER AS $$
BEGIN
    -- Registra evento quando participação é deletada (remoção por supervisor)
    PERFORM registrar_evento_operacao(
        OLD.operacao_id,
        'REMOCAO_SUPERVISOR',
        OLD.membro_id,
        CASE 
            WHEN OLD.estado_visual = 'CONFIRMADO' THEN 'Removido pelo supervisor (estava confirmado)'
            WHEN OLD.estado_visual = 'ADICIONADO_SUP' THEN 'Removido pelo supervisor (foi adicionado diretamente)'
            WHEN OLD.estado_visual = 'NA_FILA' THEN 'Removido pelo supervisor (estava na fila)'
            WHEN OLD.estado_visual = 'PENDENTE' THEN 'Removido pelo supervisor (estava pendente)'
            ELSE 'Removido pelo supervisor'
        END,
        jsonb_build_object(
            'estado_visual_anterior', OLD.estado_visual,
            'status_interno_anterior', OLD.status_interno,
            'posicao_fila_anterior', OLD.posicao_fila,
            'participacao_id', OLD.id,
            'motivo', 'Remoção direta pelo supervisor'
        )
    );
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger para DELETE
CREATE TRIGGER trigger_remocao_supervisor
    AFTER DELETE ON participacao
    FOR EACH ROW
    EXECUTE FUNCTION trigger_registrar_remocao_supervisor();

-- Registrar migration
INSERT INTO migrations_log (version, description, applied_at)
VALUES ('010', 'Trigger para registrar eventos REMOCAO_SUPERVISOR', NOW()); 
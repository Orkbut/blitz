-- ====================================================================
-- MIGRATION: 006_eventos_operacao_auditoria.sql
-- DESCRIÇÃO: Sistema de eventos completo para auditoria de operações
-- DATA: 2025-01-05
-- ====================================================================

-- 1. CRIAR TABELA DE EVENTOS (Histórico Permanente)
CREATE TABLE IF NOT EXISTS eventos_operacao (
    id BIGSERIAL PRIMARY KEY,
    operacao_id INTEGER NOT NULL REFERENCES operacao(id),
    tipo_evento VARCHAR(50) NOT NULL CHECK (tipo_evento IN (
        'SOLICITACAO',
        'APROVACAO',
        'CANCELAMENTO',
        'ADICAO_SUPERVISOR',
        'REMOCAO_SUPERVISOR',
        'REJEICAO',
        'ENTRADA_FILA',
        'PROMOCAO_FILA',
        'LIMITE_EXPANDIDO',
        'OPERACAO_EXCLUIDA',
        'OPERACAO_REATIVADA'
    )),
    servidor_id INTEGER NOT NULL REFERENCES servidor(id),
    servidor_nome VARCHAR(255) NOT NULL, -- Desnormalizado para performance
    servidor_matricula VARCHAR(50) NOT NULL, -- Desnormalizado para performance
    data_evento TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    detalhes TEXT,
    metadata JSONB DEFAULT '{}', -- Dados adicionais do evento
    
    -- Campos para UI
    icone VARCHAR(10),
    cor VARCHAR(20),
    
    -- Auditoria
    criado_por INTEGER REFERENCES servidor(id),
    ip_origem VARCHAR(45),
    user_agent TEXT,
    
    -- Índices para performance
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_eventos_operacao_operacao_id ON eventos_operacao(operacao_id);
CREATE INDEX idx_eventos_operacao_servidor_id ON eventos_operacao(servidor_id);
CREATE INDEX idx_eventos_operacao_tipo_evento ON eventos_operacao(tipo_evento);
CREATE INDEX idx_eventos_operacao_data_evento ON eventos_operacao(data_evento DESC);
CREATE INDEX idx_eventos_operacao_composite ON eventos_operacao(operacao_id, data_evento DESC);

-- 3. HABILITAR RLS (Row Level Security)
ALTER TABLE eventos_operacao ENABLE ROW LEVEL SECURITY;

-- 4. POLÍTICA DE LEITURA (Todos podem ler eventos)
CREATE POLICY "Eventos são públicos para leitura" ON eventos_operacao
    FOR SELECT USING (true);

-- 5. POLÍTICA DE INSERÇÃO (Sistema pode inserir)
CREATE POLICY "Sistema pode inserir eventos" ON eventos_operacao
    FOR INSERT WITH CHECK (true);

-- 6. FUNÇÃO HELPER PARA REGISTRAR EVENTOS
CREATE OR REPLACE FUNCTION registrar_evento_operacao(
    p_operacao_id INTEGER,
    p_tipo_evento VARCHAR(50),
    p_servidor_id INTEGER,
    p_detalhes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_criado_por INTEGER DEFAULT NULL
)
RETURNS eventos_operacao AS $$
DECLARE
    v_servidor RECORD;
    v_evento eventos_operacao;
    v_icone VARCHAR(10);
    v_cor VARCHAR(20);
BEGIN
    -- Buscar dados do servidor
    SELECT nome, matricula INTO v_servidor
    FROM servidor WHERE id = p_servidor_id;
    
    -- Definir ícone e cor baseado no tipo
    CASE p_tipo_evento
        WHEN 'SOLICITACAO' THEN
            v_icone := '📝';
            v_cor := '#3b82f6';
        WHEN 'APROVACAO' THEN
            v_icone := '✅';
            v_cor := '#10b981';
        WHEN 'CANCELAMENTO' THEN
            v_icone := '❌';
            v_cor := '#ef4444';
        WHEN 'ADICAO_SUPERVISOR' THEN
            v_icone := '👨‍💼';
            v_cor := '#7c3aed';
        WHEN 'REMOCAO_SUPERVISOR' THEN
            v_icone := '🚫';
            v_cor := '#dc2626';
        WHEN 'REJEICAO' THEN
            v_icone := '⛔';
            v_cor := '#f59e0b';
        WHEN 'ENTRADA_FILA' THEN
            v_icone := '⏳';
            v_cor := '#f59e0b';
        WHEN 'PROMOCAO_FILA' THEN
            v_icone := '📈';
            v_cor := '#22c55e';
        WHEN 'LIMITE_EXPANDIDO' THEN
            v_icone := '📊';
            v_cor := '#6366f1';
        WHEN 'OPERACAO_EXCLUIDA' THEN
            v_icone := '🗑️';
            v_cor := '#991b1b';
        WHEN 'OPERACAO_REATIVADA' THEN
            v_icone := '♻️';
            v_cor := '#059669';
        ELSE
            v_icone := '📌';
            v_cor := '#6b7280';
    END CASE;
    
    -- Inserir evento
    INSERT INTO eventos_operacao (
        operacao_id,
        tipo_evento,
        servidor_id,
        servidor_nome,
        servidor_matricula,
        detalhes,
        metadata,
        icone,
        cor,
        criado_por
    ) VALUES (
        p_operacao_id,
        p_tipo_evento,
        p_servidor_id,
        v_servidor.nome,
        v_servidor.matricula,
        p_detalhes,
        p_metadata,
        v_icone,
        v_cor,
        p_criado_por
    ) RETURNING * INTO v_evento;
    
    RETURN v_evento;
END;
$$ LANGUAGE plpgsql;

-- 7. TRIGGER PARA REGISTRAR SOLICITAÇÕES
CREATE OR REPLACE FUNCTION trigger_registrar_solicitacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Só registra se for uma nova participação ativa
    IF NEW.ativa = true AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.ativa = false)) THEN
        PERFORM registrar_evento_operacao(
            NEW.operacao_id,
            CASE 
                WHEN NEW.estado_visual = 'ADICIONADO_SUP' THEN 'ADICAO_SUPERVISOR'
                ELSE 'SOLICITACAO'
            END,
            NEW.membro_id,
            CASE 
                WHEN NEW.estado_visual = 'ADICIONADO_SUP' THEN 'Adicionado diretamente pelo supervisor'
                ELSE 'Solicitou participação na operação'
            END,
            jsonb_build_object(
                'estado_visual', NEW.estado_visual,
                'status_interno', NEW.status_interno,
                'participacao_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_nova_solicitacao
    AFTER INSERT OR UPDATE ON participacao
    FOR EACH ROW
    EXECUTE FUNCTION trigger_registrar_solicitacao();

-- 8. TRIGGER PARA REGISTRAR APROVAÇÕES
CREATE OR REPLACE FUNCTION trigger_registrar_aprovacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Detecta mudança para CONFIRMADO
    IF NEW.estado_visual = 'CONFIRMADO' AND 
       (OLD.estado_visual IS NULL OR OLD.estado_visual != 'CONFIRMADO') THEN
        PERFORM registrar_evento_operacao(
            NEW.operacao_id,
            'APROVACAO',
            NEW.membro_id,
            'Participação aprovada pelo supervisor',
            jsonb_build_object(
                'estado_anterior', OLD.estado_visual,
                'participacao_id', NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_aprovacao_participacao
    AFTER UPDATE ON participacao
    FOR EACH ROW
    WHEN (NEW.estado_visual = 'CONFIRMADO')
    EXECUTE FUNCTION trigger_registrar_aprovacao();

-- 9. TRIGGER PARA REGISTRAR CANCELAMENTOS
CREATE OR REPLACE FUNCTION trigger_registrar_cancelamento()
RETURNS TRIGGER AS $$
BEGIN
    -- Detecta quando participação é desativada
    IF OLD.ativa = true AND NEW.ativa = false THEN
        PERFORM registrar_evento_operacao(
            NEW.operacao_id,
            'CANCELAMENTO',
            NEW.membro_id,
            'Cancelou participação na operação',
            jsonb_build_object(
                'estado_visual', OLD.estado_visual,
                'participacao_id', NEW.id,
                'motivo', COALESCE(NEW.estado_visual, 'Cancelamento voluntário')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cancelamento_participacao
    AFTER UPDATE ON participacao
    FOR EACH ROW
    WHEN (OLD.ativa = true AND NEW.ativa = false)
    EXECUTE FUNCTION trigger_registrar_cancelamento();

-- 10. TRIGGER PARA MUDANÇAS DE LIMITE
CREATE OR REPLACE FUNCTION trigger_registrar_limite_expandido()
RETURNS TRIGGER AS $$
DECLARE
    v_supervisor_id INTEGER;
BEGIN
    -- Buscar supervisor da operação
    SELECT j.supervisor_id INTO v_supervisor_id
    FROM operacao o
    JOIN janela_operacional j ON o.janela_id = j.id
    WHERE o.id = NEW.operacao_id;
    
    PERFORM registrar_evento_operacao(
        NEW.operacao_id,
        'LIMITE_EXPANDIDO',
        v_supervisor_id,
        format('Limite expandido de %s para %s vagas', NEW.limite_original, NEW.limite_expandido),
        jsonb_build_object(
            'limite_original', NEW.limite_original,
            'limite_expandido', NEW.limite_expandido,
            'justificativa', NEW.justificativa
        ),
        NEW.supervisor_id
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_limite_expandido
    AFTER INSERT ON limite_temporario
    FOR EACH ROW
    EXECUTE FUNCTION trigger_registrar_limite_expandido();

-- 11. FUNÇÃO PARA MIGRAR DADOS HISTÓRICOS EXISTENTES
CREATE OR REPLACE FUNCTION migrar_eventos_historicos()
RETURNS void AS $$
DECLARE
    v_participacao RECORD;
    v_tipo_evento VARCHAR(50);
    v_detalhes TEXT;
BEGIN
    -- Migrar participações existentes
    FOR v_participacao IN 
        SELECT p.*, s.nome, s.matricula
        FROM participacao p
        JOIN servidor s ON p.membro_id = s.id
        ORDER BY p.data_participacao
    LOOP
        -- Determinar tipo de evento baseado no estado
        IF v_participacao.estado_visual = 'ADICIONADO_SUP' THEN
            v_tipo_evento := 'ADICAO_SUPERVISOR';
            v_detalhes := 'Adicionado diretamente pelo supervisor';
        ELSIF v_participacao.estado_visual = 'CONFIRMADO' THEN
            -- Inserir solicitação primeiro
            INSERT INTO eventos_operacao (
                operacao_id, tipo_evento, servidor_id, servidor_nome, 
                servidor_matricula, data_evento, detalhes, icone, cor
            ) VALUES (
                v_participacao.operacao_id, 'SOLICITACAO', v_participacao.membro_id,
                v_participacao.nome, v_participacao.matricula,
                v_participacao.data_participacao, 'Solicitou participação', '📝', '#3b82f6'
            );
            
            -- Depois inserir aprovação
            v_tipo_evento := 'APROVACAO';
            v_detalhes := 'Aprovado pelo supervisor';
        ELSIF NOT v_participacao.ativa THEN
            -- Inserir solicitação primeiro
            INSERT INTO eventos_operacao (
                operacao_id, tipo_evento, servidor_id, servidor_nome, 
                servidor_matricula, data_evento, detalhes, icone, cor
            ) VALUES (
                v_participacao.operacao_id, 'SOLICITACAO', v_participacao.membro_id,
                v_participacao.nome, v_participacao.matricula,
                v_participacao.data_participacao, 'Solicitou participação', '📝', '#3b82f6'
            );
            
            -- Depois inserir cancelamento
            v_tipo_evento := 'CANCELAMENTO';
            v_detalhes := 'Cancelou participação';
        ELSE
            v_tipo_evento := 'SOLICITACAO';
            v_detalhes := 'Solicitou participação';
        END IF;
        
        -- Inserir evento principal
        PERFORM registrar_evento_operacao(
            v_participacao.operacao_id,
            v_tipo_evento,
            v_participacao.membro_id,
            v_detalhes,
            jsonb_build_object(
                'estado_visual', v_participacao.estado_visual,
                'migrado', true
            )
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar migração (comentado para execução manual)
-- SELECT migrar_eventos_historicos();

-- 12. HABILITAR REALTIME PARA A TABELA
ALTER PUBLICATION supabase_realtime ADD TABLE eventos_operacao;

-- 13. COMENTÁRIOS DE DOCUMENTAÇÃO
COMMENT ON TABLE eventos_operacao IS 'Histórico completo e permanente de todos os eventos das operações para auditoria';
COMMENT ON COLUMN eventos_operacao.tipo_evento IS 'Tipo do evento ocorrido na operação';
COMMENT ON COLUMN eventos_operacao.metadata IS 'Dados adicionais do evento em formato JSON';
COMMENT ON COLUMN eventos_operacao.servidor_nome IS 'Nome do servidor (desnormalizado para performance)';
COMMENT ON COLUMN eventos_operacao.servidor_matricula IS 'Matrícula do servidor (desnormalizado para performance)';

-- Registrar migration
INSERT INTO migrations_log (version, description, applied_at)
VALUES ('006', 'Sistema de eventos para auditoria de operações', NOW()); 
-- =====================================================
-- MIGRATION 014: Adicionar campos de inativação na tabela operacao
-- Data: 12/08/2025
-- Descrição: Adiciona campos para permitir supervisores inativarem operações específicas
-- Requirements: 1.4, 2.2
-- =====================================================

-- Adicionar campos de inativação na tabela operacao
ALTER TABLE public.operacao 
ADD COLUMN IF NOT EXISTS inativa_pelo_supervisor boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS data_inativacao timestamp with time zone,
ADD COLUMN IF NOT EXISTS motivo_inativacao text,
ADD COLUMN IF NOT EXISTS supervisor_inativacao_id integer;

-- Adicionar foreign key para supervisor_inativacao_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_operacao_supervisor_inativacao'
    ) THEN
        ALTER TABLE public.operacao 
        ADD CONSTRAINT fk_operacao_supervisor_inativacao 
        FOREIGN KEY (supervisor_inativacao_id) REFERENCES public.servidor(id);
    END IF;
END $$;

-- Adicionar índice para performance em consultas de operações inativas
CREATE INDEX IF NOT EXISTS idx_operacao_inativa_supervisor 
ON public.operacao(inativa_pelo_supervisor) 
WHERE inativa_pelo_supervisor = true;

-- Adicionar comentários explicativos
COMMENT ON COLUMN public.operacao.inativa_pelo_supervisor IS 'Indica se a operação foi inativada por um supervisor (marcada como histórica)';
COMMENT ON COLUMN public.operacao.data_inativacao IS 'Data e hora em que a operação foi inativada pelo supervisor';
COMMENT ON COLUMN public.operacao.motivo_inativacao IS 'Motivo opcional fornecido pelo supervisor para a inativação';
COMMENT ON COLUMN public.operacao.supervisor_inativacao_id IS 'ID do supervisor que inativou a operação';

-- Garantir que campos de inativação sejam consistentes
-- Se inativa_pelo_supervisor = true, deve ter data_inativacao e supervisor_inativacao_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'chk_inativacao_consistente'
    ) THEN
        ALTER TABLE public.operacao 
        ADD CONSTRAINT chk_inativacao_consistente 
        CHECK (
            (inativa_pelo_supervisor = false) OR 
            (inativa_pelo_supervisor = true AND data_inativacao IS NOT NULL AND supervisor_inativacao_id IS NOT NULL)
        );
    END IF;
END $$;
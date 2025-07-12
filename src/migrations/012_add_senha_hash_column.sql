-- =====================================================
-- MIGRATION 012: Adicionar campo senha_hash na tabela servidor
-- Data: 16/01/2025
-- Descrição: Adiciona campo para armazenar senhas escolhidas pelos usuários
-- =====================================================

-- Adicionar campo senha_hash na tabela servidor
ALTER TABLE public.servidor 
ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(255);

-- Comentário explicativo
COMMENT ON COLUMN public.servidor.senha_hash IS 'Hash da senha escolhida pelo usuário durante o cadastro';

-- Para usuários existentes, manter compatibilidade com padrão antigo (matrícula + "123")
-- Isso será tratado na lógica da aplicação para backward compatibility 
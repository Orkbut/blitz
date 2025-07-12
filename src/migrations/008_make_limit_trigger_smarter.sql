-- Passo 1: Remover explicitamente AMBOS os gatilhos da tabela de participação.
-- O IF EXISTS evita erros se os gatilhos já foram removidos ou nunca existiram.
DROP TRIGGER IF EXISTS trg_validate_participant_limit ON public.participacao;
DROP TRIGGER IF EXISTS trg_validate_participant_limit_update ON public.participacao;

-- Passo 2: Agora que nada mais depende da função, remover a função antiga.
DROP FUNCTION IF EXISTS public.validate_participant_limit();

-- Passo 3: Criar a nova função de validação com "superpoder" para o supervisor e lógica de transição.
CREATE OR REPLACE FUNCTION public.validate_participant_limit()
RETURNS TRIGGER AS $$
DECLARE
    v_limite_participantes INTEGER;
    v_total_confirmados INTEGER;
    v_contexto_supervisor TEXT;
BEGIN
    -- Verifica se a sessão atual está com o "superpoder" de supervisor ativado.
    SELECT current_setting('app.supervisor_override', true) INTO v_contexto_supervisor;
    IF v_contexto_supervisor = 'true' THEN
        RETURN NEW; -- Permite a operação, ignorando o limite.
    END IF;

    -- A validação só deve ocorrer quando um participante está SENDO confirmado.
    -- Condição: (É uma nova inserção OU o estado mudou) E o novo estado é CONFIRMADO.
    IF (TG_OP = 'INSERT' OR NEW.estado_visual IS DISTINCT FROM OLD.estado_visual) AND NEW.estado_visual = 'CONFIRMADO' THEN
        
        -- Busca o limite da operação e a contagem atual de participantes confirmados.
        SELECT
            o.limite_participantes,
            COUNT(p.id)
        INTO
            v_limite_participantes,
            v_total_confirmados
        FROM public.operacao o
        LEFT JOIN public.participacao p ON o.id = p.operacao_id AND p.estado_visual = 'CONFIRMADO' AND p.ativa = true
        WHERE o.id = NEW.operacao_id
        GROUP BY o.id;

        -- Se o número de confirmados já atingiu ou excedeu o limite, bloqueia a ação.
        IF v_total_confirmados >= v_limite_participantes THEN
            RAISE EXCEPTION 'Limite de participantes atingido. Atual: %, Limite: %', v_total_confirmados, v_limite_participantes;
        END IF;
    END IF;

    -- Para todas as outras operações (ex: cancelar, ir para a fila, etc.), permite a atualização.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Passo 4: Criar um único gatilho novo que lida com INSERT e UPDATE.
CREATE TRIGGER trg_validate_participant_limit
BEFORE INSERT OR UPDATE ON public.participacao
FOR EACH ROW EXECUTE FUNCTION public.validate_participant_limit(); 
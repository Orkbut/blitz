-- ====================================================================
-- TESTE: Sistema de Eventos Realtime
-- Execute este script no Supabase SQL Editor para testar
-- ====================================================================

-- 1. Verificar eventos existentes para operação 431
SELECT 
  id,
  tipo_evento,
  servidor_nome,
  data_evento,
  detalhes
FROM eventos_operacao 
WHERE operacao_id = 431
ORDER BY data_evento ASC;

-- 2. Simular novo evento (Ana Carolina solicitando)
SELECT registrar_evento_operacao(
  431,                    -- operacao_id
  'SOLICITACAO',         -- tipo_evento
  3,                     -- servidor_id (Ana Carolina)
  'Ana Carolina solicitou participação na operação'
);

-- 3. Aguardar 2 segundos e aprovar Ana
-- Execute após ver o evento aparecer no tooltip
SELECT pg_sleep(2);

SELECT registrar_evento_operacao(
  431,
  'APROVACAO',
  3,
  'Participação de Ana Carolina aprovada pelo supervisor'
);

-- 4. Simular Carla solicitando
SELECT pg_sleep(1);

SELECT registrar_evento_operacao(
  431,
  'SOLICITACAO',
  6,                     -- servidor_id (Carla)
  'Carla Mendes solicitou participação'
);

-- 5. Verificar todos os eventos
SELECT 
  id,
  tipo_evento,
  servidor_nome,
  TO_CHAR(data_evento AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY HH24:MI:SS') as data_formatada,
  detalhes
FROM eventos_operacao 
WHERE operacao_id = 431
ORDER BY data_evento ASC;

-- 6. Verificar contagem total
SELECT 
  COUNT(*) as total_eventos,
  COUNT(DISTINCT servidor_id) as servidores_unicos,
  array_agg(DISTINCT tipo_evento ORDER BY tipo_evento) as tipos_evento
FROM eventos_operacao 
WHERE operacao_id = 431; 
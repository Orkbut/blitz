'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, getMonth, getYear, addMonths, subMonths } from 'date-fns';
import { useRealtimeUnified } from './useRealtimeUnified';

// Estados considerados para contagem
const ESTADOS_INCLUIDOS = [
  'CONFIRMADO',
  'ADICIONADO_SUP',
  'PENDENTE',
  'SOLICITADO',
  'NA_FILA',
  'APROVADO'
];

const ESTADOS_EXCLUIDOS = [
  'REJEITADO',
  'RECUSADO',
  'CANCELADO'
];

// Limites padrão (fallback)
const LIMITE_OPERACOES_PADRAO = 15;
const LIMITE_DIARIAS_PADRAO = 15;

interface Participacao {
  id: number;
  membro_id: number;
  operacao_id: number;
  status_interno: string;
  estado_visual: string;
  data_participacao: string;
  ativa: boolean;
  operacao?: {
    id: number;
    data_operacao: string;
    tipo: 'PLANEJADA' | 'VOLUNTARIA';
    modalidade: string;
    status: string;
    ativa?: boolean;
    excluida_temporariamente?: boolean;
    inativa_pelo_supervisor?: boolean;
  };
}

interface LimitesData {
  // Operações - ciclo anterior (10→09)
  operacoesCicloAnterior: {
    atual: number;
    limite: number;
    percentual: number;
    todasOperacoesArquivadas: boolean; // Nova propriedade
  };

  // Operações - ciclo corrente (10→09)
  operacoesCicloCorrente: {
    atual: number;
    limite: number;
    percentual: number;
    todasOperacoesArquivadas: boolean; // Nova propriedade
  };

  // Diárias equivalentes - mês civil (01→último dia)
  diariasEquivalentes: {
    atual: number;
    limite: number;
    percentual: number;
  };

  loading: boolean;
  error: string | null;
}

interface UseLimitesCalendarioProps {
  membroId: string;
  currentDate: Date;
  debug?: boolean;
}

/**
 * Hook para calcular limites de operações e diárias para o calendário
 * Implementa as regras específicas definidas na tarefa
 */
export function useLimitesCalendario({
  membroId,
  currentDate,
  debug = false
}: UseLimitesCalendarioProps): LimitesData {
  
  // Log para debug de re-criações
  if (debug) {
    console.log('[useLimitesCalendario] Hook executado', { 
      membroId, 
      currentDate: currentDate.toISOString(), 
      timestamp: Date.now() 
    });
  }


  const [limitesData, setLimitesData] = useState<LimitesData>({
    operacoesCicloAnterior: { atual: 0, limite: LIMITE_OPERACOES_PADRAO, percentual: 0, todasOperacoesArquivadas: false },
    operacoesCicloCorrente: { atual: 0, limite: LIMITE_OPERACOES_PADRAO, percentual: 0, todasOperacoesArquivadas: false },
    diariasEquivalentes: { atual: 0, limite: LIMITE_DIARIAS_PADRAO, percentual: 0 },
    loading: true,
    error: null
  });

  // Evitar piscar: após primeira carga, não alternar para loading em recarregamentos
  const hasLoadedOnceRef = useRef(false);

  // Calcular períodos baseado na data atual
  const periodos = useMemo(() => {
    const anoAtual = getYear(currentDate);
    const mesAtual = getMonth(currentDate); // 0-based

    // Ciclo anterior: 10 do mês anterior até 09 do mês atual
    // Ex: visualizando outubro → set→out (10/09 a 09/10)
    const cicloAnteriorInicio = new Date(anoAtual, mesAtual - 1, 10);
    const cicloAnteriorFim = new Date(anoAtual, mesAtual, 9, 23, 59, 59);

    // Ciclo corrente: 10 do mês atual até 09 do próximo mês
    // Ex: visualizando outubro → out→nov (10/10 a 09/11)
    const cicloCorrenteInicio = new Date(anoAtual, mesAtual, 10);
    const cicloCorrenteFim = new Date(anoAtual, mesAtual + 1, 9, 23, 59, 59);

    // Mês civil atual
    const mesCivilInicio = startOfMonth(currentDate);
    const mesCivilFim = endOfMonth(currentDate);

    return {
      cicloAnterior: {
        inicio: format(cicloAnteriorInicio, 'yyyy-MM-dd'),
        fim: format(cicloAnteriorFim, 'yyyy-MM-dd')
      },
      cicloCorrente: {
        inicio: format(cicloCorrenteInicio, 'yyyy-MM-dd'),
        fim: format(cicloCorrenteFim, 'yyyy-MM-dd')
      },
      mesCivil: {
        inicio: format(mesCivilInicio, 'yyyy-MM-dd'),
        fim: format(mesCivilFim, 'yyyy-MM-dd')
      }
    };
  }, [currentDate]);

  // Extrair strings dos períodos para estabilizar dependências
  const dataInicio = periodos.cicloAnterior.inicio;
  const dataFim = periodos.cicloCorrente.fim;

  // Buscar participações do membro
  const fetchParticipacoes = useCallback(async () => {
    if (!membroId) return;

    try {
      setLimitesData(prev => ({ ...prev, loading: hasLoadedOnceRef.current ? false : true, error: null }));

      const params = new URLSearchParams({
        membroId,
        dataInicio,
        dataFim,
        includeOperacao: 'true',
        _t: Date.now().toString()
      });

      const response = await fetch(`/api/membro/${membroId}/participacoes?${params}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const participacoes: Participacao[] = data.data || [];

        // Calcular limites
        const limites = calcularLimites(participacoes, periodos, debug);

        setLimitesData(prev => ({
          ...prev,
          ...limites,
          loading: false
        }));

        // Marcar que já carregou ao menos uma vez
        if (!hasLoadedOnceRef.current) {
          hasLoadedOnceRef.current = true;
        }
      } else {
        throw new Error(data.error || 'Erro ao buscar participações');
      }
    } catch (error) {
      console.error('[useLimitesCalendario] Erro:', error);
      setLimitesData(prev => ({
        ...prev,
        loading: false,
        error: (error as Error).message
      }));
    }
  }, [membroId, dataInicio, dataFim, periodos, debug]);

  // Ref para manter uma referência estável da função de recarregamento
  const fetchParticipacaoesRef = useRef(fetchParticipacoes);
  fetchParticipacaoesRef.current = fetchParticipacoes;

  // Callback estável para recarregamento
  const reloadData = useCallback(() => {
    fetchParticipacaoesRef.current();
  }, []);

  // Carregar dados inicialmente
  useEffect(() => {
    fetchParticipacoes();
  }, [fetchParticipacoes]);

  // Realtime: recarregar quando houver mudanças nas participações ou operações
  useRealtimeUnified({
    channelId: `limites-calendario-${membroId}`,
    tables: ['participacao', 'operacao'],
    enableRealtime: true,
    enablePolling: false,
    enableFetch: false,
    filters: {
      participacao: `membro_id.eq.${membroId}`
      // Não filtrar operacao para capturar todas as mudanças que podem afetar os limites
    },
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType } = event;
      
      if (debug) {
        console.log(`[useLimitesCalendario] Realtime event:`, { table, eventType, event });
      }
      
      if (table === 'participacao') {
        // Recarregar apenas se for do membro atual
        if (event.new?.membro_id?.toString() === membroId ||
          event.old?.membro_id?.toString() === membroId) {
          if (debug) {
            console.log(`[useLimitesCalendario] Recarregando por mudança em participacao do membro ${membroId}`);
          }
          reloadData();
        }
      } else if (table === 'operacao') {
        // Para operações, sempre recarregar pois pode afetar os cálculos
        // (ex: operação sendo arquivada, status mudando, etc.)
        if (debug) {
          console.log(`[useLimitesCalendario] Recarregando por mudança em operacao`);
        }
        reloadData();
      }
    }, [reloadData, membroId])
  });

  return limitesData;
}

/**
 * Função para calcular os limites baseado nas participações
 */
function calcularLimites(
  participacoes: Participacao[],
  periodos: any,
  debug: boolean = false
) {
  // Filtrar apenas participações válidas
  const participacoesValidas = participacoes.filter(p => {
    // Verificar se o estado está incluído (usar estado_visual da API)
    if (!ESTADOS_INCLUIDOS.includes(p.estado_visual)) {
      return false;
    }

    // Verificar se a participação está ativa (participações inativas não contam)
    if (!p.ativa) {
      return false;
    }

    // Verificar se a operação não está temporariamente excluída
    if (p.operacao && p.operacao.excluida_temporariamente) {
      return false;
    }

    // IMPORTANTE: Operações inativas pelo supervisor (arquivadas) DEVEM contar para o histórico
    // Não filtrar por inativa_pelo_supervisor - essas operações já aconteceram e devem contar

    return true;
  });

  // Função auxiliar para verificar se todas as operações de um período estão arquivadas
  // NOVA LÓGICA: Períodos podem ser "fechados" administrativamente pelo supervisor
  const verificarOperacoesArquivadas = (inicioPeríodo: string, fimPeríodo: string): boolean => {
    // Buscar todas as operações únicas do período (com ou sem participações)
    const operacoesUnicasDoPeriodo = new Set<number>();

    // Adicionar operações que têm participações válidas no período
    participacoesValidas.forEach(p => {
      if (p.operacao) {
        const dataOp = p.operacao.data_operacao.substring(0, 10);
        if (dataOp >= inicioPeríodo && dataOp <= fimPeríodo) {
          operacoesUnicasDoPeriodo.add(p.operacao.id);
        }
      }
    });

    // Adicionar operações que têm qualquer participação (mesmo inválida) no período
    // Isso garante que operações com eventos (solicitações, etc.) sejam consideradas
    participacoes.forEach(p => {
      if (p.operacao) {
        const dataOp = p.operacao.data_operacao.substring(0, 10);
        if (dataOp >= inicioPeríodo && dataOp <= fimPeríodo) {
          operacoesUnicasDoPeriodo.add(p.operacao.id);
        }
      }
    });

    // Se não há operações no período, considerar como "fechado" (todas arquivadas)
    if (operacoesUnicasDoPeriodo.size === 0) {
      if (debug) console.log(`[verificarOperacoesArquivadas] Período ${inicioPeríodo} → ${fimPeríodo}: Sem operações, considerado fechado`);
      return true;
    }

    // Verificar se todas as operações únicas estão arquivadas
    let todasArquivadas = true;
    let operacoesAtivas = 0;
    let operacoesArquivadas = 0;

    operacoesUnicasDoPeriodo.forEach(operacaoId => {
      // Buscar qualquer participação desta operação para verificar o status
      const participacaoOperacao = participacoes.find(p => p.operacao?.id === operacaoId);
      if (participacaoOperacao?.operacao) {
        if (participacaoOperacao.operacao.inativa_pelo_supervisor) {
          operacoesArquivadas++;
        } else {
          operacoesAtivas++;
          todasArquivadas = false;
        }
      }
    });

    if (debug) {
      console.log(`[verificarOperacoesArquivadas] Período ${inicioPeríodo} → ${fimPeríodo}:`);
      console.log(`  - Total operações: ${operacoesUnicasDoPeriodo.size}`);
      console.log(`  - Operações ativas: ${operacoesAtivas}`);
      console.log(`  - Operações arquivadas: ${operacoesArquivadas}`);
      console.log(`  - Todas arquivadas: ${todasArquivadas}`);
    }

    return todasArquivadas;
  };

  // 1. OPERAÇÕES - CICLO ANTERIOR (10→09)
  const operacoesCicloAnterior = participacoesValidas.filter(p => {
    if (!p.operacao) return false;
    const dataOp = p.operacao.data_operacao.substring(0, 10);
    return dataOp >= periodos.cicloAnterior.inicio && dataOp <= periodos.cicloAnterior.fim;
  }).length;

  const todasOperacoesArquivadasAnterior = verificarOperacoesArquivadas(
    periodos.cicloAnterior.inicio,
    periodos.cicloAnterior.fim
  );

  // 2. OPERAÇÕES - CICLO CORRENTE (10→09)
  const operacoesCicloCorrente = participacoesValidas.filter(p => {
    if (!p.operacao) return false;
    const dataOp = p.operacao.data_operacao.substring(0, 10);
    return dataOp >= periodos.cicloCorrente.inicio && dataOp <= periodos.cicloCorrente.fim;
  }).length;

  const todasOperacoesArquivadasCorrente = verificarOperacoesArquivadas(
    periodos.cicloCorrente.inicio,
    periodos.cicloCorrente.fim
  );

  // 3. DIÁRIAS EQUIVALENTES - MÊS CIVIL (apenas PLANEJADA)
  const participacoesPlanejadas = participacoesValidas.filter(p => {
    if (!p.operacao) return false;
    return p.operacao.tipo === 'PLANEJADA';
  });

  // Calcular diárias equivalentes com lógica de meias diárias
  let diariasEquivalentes = 0;

  // Agrupar por data para detectar sequências consecutivas
  const participacoesPorData = new Map<string, Participacao[]>();
  participacoesPlanejadas.forEach(p => {
    const dataOp = p.operacao!.data_operacao.substring(0, 10);
    if (!participacoesPorData.has(dataOp)) {
      participacoesPorData.set(dataOp, []);
    }
    participacoesPorData.get(dataOp)!.push(p);
  });

  // Ordenar datas para detectar sequências
  const datasOrdenadas = Array.from(participacoesPorData.keys()).sort();

  // Detectar sequências consecutivas
  const sequencias: string[][] = [];
  let sequenciaAtual: string[] = [];

  for (let i = 0; i < datasOrdenadas.length; i++) {
    const dataAtual = datasOrdenadas[i];

    if (sequenciaAtual.length === 0) {
      // Primeira data da sequência
      sequenciaAtual = [dataAtual];
    } else {
      const dataAnterior = sequenciaAtual[sequenciaAtual.length - 1];
      const dataAnteriorObj = new Date(dataAnterior + 'T00:00:00');
      const dataAtualObj = new Date(dataAtual + 'T00:00:00');
      const diffDias = (dataAtualObj.getTime() - dataAnteriorObj.getTime()) / (1000 * 60 * 60 * 24);

      if (diffDias === 1) {
        // Dia consecutivo - continua a sequência
        sequenciaAtual.push(dataAtual);
      } else {
        // Quebra na sequência - salva a atual e inicia nova
        sequencias.push([...sequenciaAtual]);
        sequenciaAtual = [dataAtual];
      }
    }
  }

  // Adicionar última sequência
  if (sequenciaAtual.length > 0) {
    sequencias.push(sequenciaAtual);
  }

  // Calcular diárias para cada sequência
  sequencias.forEach(sequencia => {
    // Diárias completas = quantidade de dias na sequência que estão no mês civil
    const diasNoMesCivil = sequencia.filter(data =>
      data >= periodos.mesCivil.inicio && data <= periodos.mesCivil.fim
    ).length;

    diariasEquivalentes += diasNoMesCivil;

    // Meia diária: se há sequência, verificar se o retorno (+1) cai no mês civil
    if (sequencia.length > 0) {
      const ultimaData = sequencia[sequencia.length - 1];
      const dataRetorno = new Date(ultimaData + 'T00:00:00');
      dataRetorno.setDate(dataRetorno.getDate() + 1);
      const dataRetornoStr = dataRetorno.toISOString().substring(0, 10);

      // Se o retorno cai no mês civil, adicionar meia diária
      if (dataRetornoStr >= periodos.mesCivil.inicio && dataRetornoStr <= periodos.mesCivil.fim) {
        diariasEquivalentes += 0.5;
      }
    }
  });





  return {
    operacoesCicloAnterior: {
      atual: operacoesCicloAnterior,
      limite: LIMITE_OPERACOES_PADRAO,
      percentual: Math.round((operacoesCicloAnterior / LIMITE_OPERACOES_PADRAO) * 100),
      todasOperacoesArquivadas: todasOperacoesArquivadasAnterior
    },
    operacoesCicloCorrente: {
      atual: operacoesCicloCorrente,
      limite: LIMITE_OPERACOES_PADRAO,
      percentual: Math.round((operacoesCicloCorrente / LIMITE_OPERACOES_PADRAO) * 100),
      todasOperacoesArquivadas: todasOperacoesArquivadasCorrente
    },
    diariasEquivalentes: {
      atual: diariasEquivalentes,
      limite: LIMITE_DIARIAS_PADRAO,
      percentual: Math.round((diariasEquivalentes / LIMITE_DIARIAS_PADRAO) * 100)
    }
  };
}
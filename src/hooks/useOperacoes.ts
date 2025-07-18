import { useState, useEffect, useCallback, useMemo } from 'react';
// @ts-ignore - date-fns será instalado
import { format } from 'date-fns';

interface UseOperacoesParams {
  startDate: Date;
  endDate: Date;
}

interface Operacao {
  id: number;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limite_participantes: number;
  participantes_confirmados?: number;
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'NA_FILA' | 'DISPONIVEL';
    posicao_fila?: number;
  };
}

export const useOperacoes = ({ startDate, endDate }: UseOperacoesParams) => {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 🔧 CORREÇÃO: Contador para forçar re-renderização no realtime
  const [refetchCounter, setRefetchCounter] = useState(0);

  // Memorizar as datas de forma estável
  const startDateStr = useMemo(() => format(startDate, 'yyyy-MM-dd'), [startDate]);
  const endDateStr = useMemo(() => format(endDate, 'yyyy-MM-dd'), [endDate]);

  // Função fetch robusta
  const fetchOperacoes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Garantir que membroId está disponível
      const membroId = localStorage.getItem('membroId') || '1';
      
      // ✅ OTIMIZADO: Logs de fetch removidos (performance)
      
      const params = new URLSearchParams({
        startDate: startDateStr,
        endDate: endDateStr,
        membroId,
        // Timestamp para evitar cache
        _t: Date.now().toString()
      });

      const url = `/api/unified/operacoes?${params}`;

      const response = await fetch(url, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // ✅ OTIMIZADO: Logs detalhados removidos (performance)

      if (data.success) {
        // Dados recebidos da API
        //   total: data.data?.length || 0,
        //   timestamp: new Date().toLocaleTimeString(),
        //   counterId: refetchCounter
        // });
        setOperacoes(data.data || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar operações');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      // Erro silencioso
      setError(errorMessage);
      setOperacoes([]);
    } finally {
      setLoading(false);
    }
  }, [startDateStr, endDateStr, refetchCounter]); // ✅ CORREÇÃO: Incluir refetchCounter

  // 🔧 CORREÇÃO: Refetch que força re-renderização através do contador
  const refetch = useCallback(() => {
    // Incrementar contador para forçar re-renderização (que dispara useEffect -> fetchOperacoes)
    setRefetchCounter(prev => {
      return prev + 1;
    });
  }, []);

  // useEffect limpo
  useEffect(() => {
    // ✅ OTIMIZADO: Log removido (performance)
    fetchOperacoes();
  }, [fetchOperacoes]); // ✅ CORREÇÃO: fetchOperacoes já inclui refetchCounter

  return {
    operacoes,
    loading,
    error,
    refetch
  };
}; 
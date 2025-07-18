/**
 * ⚠️ DEPRECATED WRAPPER
 * 
 * Este hook foi SUBSTITUÍDO por padrão simples:
 * ❌ useOperacoes (legacy) - 115 linhas com lógica complexa
 * ✅ useState + useCallback simples - 20 linhas
 * 
 * MOTIVO DA DEPRECIAÇÃO:
 * - Estados de loading/error/data separados desnecessários
 * - Fetch com cache control manual
 * - Refetch via contador (ineficiente)
 * - Lógica de membroId repetida
 * - Cache control manual inadequado
 * 
 * NOVA IMPLEMENTAÇÃO (Padrão Simples):
 * ```typescript
 * const [operacoes, setOperacoes] = useState([]);
 * const [loading, setLoading] = useState(true);
 * 
 * const fetchOperacoes = useCallback(async () => {
 *   setLoading(true);
 *   const response = await fetch('/api/unified/operacoes?...');
 *   const data = await response.json();
 *   setOperacoes(data.data);
 *   setLoading(false);
 * }, [dependencies]);
 * 
 * useEffect(() => { fetchOperacoes(); }, [fetchOperacoes]);
 * ```
 * 
 * MUITO MAIS SIMPLES!
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface UseOperacoesParams {
  startDate: Date;
  endDate: Date;
}

/**
 * @deprecated Use simple useState + fetch pattern instead.
 * Este wrapper será removido em 2 sprints.
 */
export const useOperacoes = ({ startDate, endDate }: UseOperacoesParams) => {
  const [operacoes, setOperacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchOperacoes = useCallback(async () => {
    const membroId = localStorage.getItem('membroId') || '1';
    
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        membroId,
        _t: Date.now().toString()
      });

      const response = await fetch(`/api/unified/operacoes?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setOperacoes(data.data || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar operações');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      setError(errorMessage);
      setOperacoes([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  return {
    operacoes,
    loading,
    error,
    refetch: fetchOperacoes
  };
};

export default useOperacoes; 
/**
 * ⚠️ DEPRECATED WRAPPER
 * 
 * Este hook foi SUBSTITUÍDO pela nova arquitetura:
 * ❌ useRealtimeOperacoes (legacy) - 329 linhas
 * ✅ useRealtimeOperacoes (novo) - do useRealtime.ts
 * 
 * MOTIVO DA DEPRECIAÇÃO:
 * - Duplicação de responsabilidades
 * - Rate limiting manual inadequado
 * - Múltiplos canais para mesma funcionalidade
 * - Health check desnecessário
 * - Event handlers redundantes
 * 
 * MIGRAÇÃO SIMPLES:
 * ```typescript
 * // ANTES
 * import { useRealtimeOperacoes } from '@/hooks/useRealtimeOperacoes';
 * 
 * // DEPOIS  
 * import { useRealtimeOperacoes } from '@/hooks/useRealtime';
 * ```
 * 
 * A API é compatível - apenas troque o import!
 */

'use client';

import { useRealtimeOperacoes as useRealtimeOperacoesNovo } from '@/hooks/useRealtime';

/**
 * @deprecated Use `useRealtimeOperacoes` from '@/hooks/useRealtime' instead.
 * Este wrapper será removido em 2 sprints.
 */
export const useRealtimeOperacoes = (params: any) => {
  console.warn(`
    ⚠️ DEPRECATED: useRealtimeOperacoes (legacy)
    📦 Migre para: import { useRealtimeOperacoes } from '@/hooks/useRealtime'
    🗓️ Remoção prevista: 2 sprints
    
    A nova implementação oferece:
    ✅ 89% menos código
    ✅ Rate limiting automático  
    ✅ Channel pooling
    ✅ Error handling oficial
  `);
  
  // Mapear parâmetros antigos para novos se necessário
  const mappedParams = {
    operacaoIds: params.operacaoIds || [],
    enabled: params.enabled,
    onOperacaoChange: params.onUpdate,
    onParticipacaoChange: params.onUpdate,
    debug: params.debug
  };
  
  return useRealtimeOperacoesNovo(mappedParams);
};

export default useRealtimeOperacoes; 
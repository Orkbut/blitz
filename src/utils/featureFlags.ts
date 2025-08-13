/**
 * Feature Flags para controle de migração gradual
 * 
 * Este arquivo centraliza o controle de feature flags para permitir
 * rollback fácil e migração gradual de funcionalidades otimizadas.
 */

export const FeatureFlags = {
  /**
   * Controla se deve usar a versão otimizada do modal Gerenciar Membros
   * 
   * @returns true se deve usar a versão otimizada
   */
  useOptimizedGerenciarMembros: (): boolean => {
    return process.env.NEXT_PUBLIC_USE_OPTIMIZED_GERENCIAR_MEMBROS === 'true';
  },

  /**
   * Controla se deve mostrar logs de debug em desenvolvimento
   * 
   * @returns true se deve mostrar logs de debug
   */
  enableDebugLogs: (): boolean => {
    return process.env.NODE_ENV === 'development' && 
           process.env.NEXT_PUBLIC_SUPABASE_LOG_LEVEL !== 'error';
  },

  /**
   * Controla se deve usar métricas de performance
   * 
   * @returns true se deve coletar métricas
   */
  enablePerformanceMetrics: (): boolean => {
    return process.env.NODE_ENV === 'development' || 
           process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_METRICS === 'true';
  }
} as const;

/**
 * Hook para usar feature flags em componentes React
 */
export const useFeatureFlags = () => {
  return {
    useOptimizedGerenciarMembros: FeatureFlags.useOptimizedGerenciarMembros(),
    enableDebugLogs: FeatureFlags.enableDebugLogs(),
    enablePerformanceMetrics: FeatureFlags.enablePerformanceMetrics()
  };
};

/**
 * Utilitário para logging condicional baseado em feature flags
 */
export const conditionalLog = {
  debug: (...args: any[]) => {
    if (FeatureFlags.enableDebugLogs()) {
      console.log('[DEBUG]', ...args);
    }
  },
  
  performance: (label: string, fn: () => void) => {
    if (FeatureFlags.enablePerformanceMetrics()) {
      console.time(`[PERFORMANCE] ${label}`);
      fn();
      console.timeEnd(`[PERFORMANCE] ${label}`);
    } else {
      fn();
    }
  }
};
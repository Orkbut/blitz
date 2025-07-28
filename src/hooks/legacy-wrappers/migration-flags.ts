/**
 * 🎛️ FEATURE FLAGS PARA MIGRAÇÃO GRADUAL
 * 
 * Controla a migração gradual dos hooks legados para o useRealtimeUnified.
 * Permite rollback seguro e teste A/B durante a transição.
 */

export interface MigrationFeatureFlags {
  // Controle global da migração
  enableUnifiedHooks: boolean;
  
  // Controle por hook específico
  useRealtimeOperacoes: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimePuro: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimeSimple: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimeEventos: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimeCentralized: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimeUnificado: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  useRealtimeCalendarioSupervisor: {
    useUnified: boolean;
    showDeprecationWarning: boolean;
  };
  
  // Configurações de debug e monitoramento
  debug: {
    logMigrationUsage: boolean;
    logPerformanceMetrics: boolean;
    enableMigrationAnalytics: boolean;
  };
}

// 🎯 CONFIGURAÇÃO PADRÃO DAS FEATURE FLAGS
export const MIGRATION_FEATURE_FLAGS: MigrationFeatureFlags = {
  enableUnifiedHooks: true,
  
  useRealtimeOperacoes: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimePuro: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimeSimple: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimeEventos: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimeCentralized: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimeUnificado: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  useRealtimeCalendarioSupervisor: {
    useUnified: true,
    showDeprecationWarning: process.env.NODE_ENV === 'development'
  },
  
  debug: {
    logMigrationUsage: process.env.NODE_ENV === 'development',
    logPerformanceMetrics: false,
    enableMigrationAnalytics: false
  }
};

/**
 * 🔧 FUNÇÃO PARA ATUALIZAR FEATURE FLAGS EM RUNTIME
 * 
 * Permite ajustar flags durante desenvolvimento ou para rollback de emergência.
 */
export function updateMigrationFlags(updates: Partial<MigrationFeatureFlags>): void {
  Object.assign(MIGRATION_FEATURE_FLAGS, updates);
  
  if (MIGRATION_FEATURE_FLAGS.debug.logMigrationUsage) {
    console.log('[Migration] Feature flags updated:', updates);
  }
}

/**
 * 🎯 HELPER PARA VERIFICAR SE DEVE USAR HOOK UNIFICADO
 */
export function shouldUseUnified(hookName: keyof Omit<MigrationFeatureFlags, 'enableUnifiedHooks' | 'debug'>): boolean {
  return MIGRATION_FEATURE_FLAGS.enableUnifiedHooks && 
         MIGRATION_FEATURE_FLAGS[hookName].useUnified;
}

/**
 * 🚨 HELPER PARA MOSTRAR AVISO DE DEPRECIAÇÃO
 */
export function showDeprecationWarning(hookName: string, migrationGuide?: string): void {
  const hookConfig = MIGRATION_FEATURE_FLAGS[hookName as keyof Omit<MigrationFeatureFlags, 'enableUnifiedHooks' | 'debug'>];
  
  if (hookConfig?.showDeprecationWarning) {
    const message = `⚠️ [DEPRECATED] ${hookName} está depreciado e será removido em uma versão futura. Use useRealtimeUnified em seu lugar.`;
    const guide = migrationGuide ? `\n📖 Guia de migração: ${migrationGuide}` : '';
    
    console.warn(message + guide);
    
    // Log para analytics se habilitado
    if (MIGRATION_FEATURE_FLAGS.debug.enableMigrationAnalytics) {
      // Aqui poderia ser enviado para um serviço de analytics
      console.log('[Migration Analytics]', {
        hookName,
        timestamp: new Date().toISOString(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server'
      });
    }
  }
}

/**
 * 📊 HELPER PARA LOG DE MÉTRICAS DE PERFORMANCE
 */
export function logPerformanceMetric(hookName: string, metric: string, value: number): void {
  if (MIGRATION_FEATURE_FLAGS.debug.logPerformanceMetrics) {
    console.log(`[Migration Performance] ${hookName}.${metric}:`, value);
  }
}
/**
 * 🎯 UTILITÁRIOS PARA HOOKS REALTIME
 * 
 * Exportações centralizadas dos utilitários do sistema realtime unificado.
 */

export * from './config-validator';
export * from './activity-tracker';
export * from './polling-manager';

// 🚨 SISTEMA DE TRATAMENTO DE ERROS
export * from './error-classifier';
export * from './error-recovery';
export * from './error-handler';
// export * from './error-boundary'; // Comentado devido a erro de JSX
export * from './rate-limiter';

// 🐛 SISTEMA DE DEBUG E MONITORAMENTO
export * from './debug-logger';
export * from './performance-monitor';
export * from './connection-health-monitor';
export * from './debug-info-collector';
export * from './debugging-utilities';
/**
 * 🔄 WRAPPERS DE COMPATIBILIDADE PARA HOOKS LEGADOS
 * 
 * Este arquivo exporta wrappers que mantêm compatibilidade com os hooks antigos
 * enquanto utilizam internamente o useRealtimeUnified.
 * 
 * Todos os wrappers incluem:
 * - Avisos de depreciação em modo desenvolvimento
 * - Mapeamento de interfaces antigas para a nova API
 * - Feature flags para migração gradual
 * - Compatibilidade total com comportamento anterior
 */

export { useRealtimeOperacoes } from './useRealtimeOperacoes.wrapper';
export { useRealtimePuro } from './useRealtimePuro.wrapper';
export { useRealtimeSimple } from './useRealtimeSimple.wrapper';
export { useRealtimeEventos } from './useRealtimeEventos.wrapper';
export { useRealtimeCentralized } from './useRealtimeCentralized.wrapper';
export { useRealtimeUnificado } from './useRealtimeUnificado.wrapper';
export { useRealtimeCalendarioSupervisor } from './useRealtimeCalendarioSupervisor.wrapper';

// Feature flags para controle de migração
export { MIGRATION_FEATURE_FLAGS } from './migration-flags';

// Utilitários de migração
export { createMigrationHelper, type MigrationHelper } from './migration-utils';
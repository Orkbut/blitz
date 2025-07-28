/**
 * 🧪 TESTE SIMPLES PARA O HOOK REALTIME UNIFICADO
 * 
 * Teste básico para validar a implementação do hook unificado
 * usando tsx para execução direta.
 */

import { configValidator } from '../hooks/utils/config-validator';
import type { UseRealtimeUnifiedConfig } from '../hooks/useRealtimeUnified';

// 🎯 FUNÇÃO DE TESTE SIMPLES
function runTest(testName: string, testFn: () => void) {
  try {
    testFn();
    console.log(`✅ ${testName}`);
  } catch (error) {
    console.error(`❌ ${testName}:`, error instanceof Error ? error.message : error);
  }
}

// 🎯 FUNÇÃO DE ASSERT SIMPLES
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

// 🎯 TESTES DE VALIDAÇÃO DE CONFIGURAÇÃO
console.log('🧪 Executando testes do Hook Realtime Unificado...\n');

// Teste 1: Validação de tabelas
runTest('Validação de tabelas válidas', () => {
  assert(configValidator.validateTables(['operacao', 'participacao']), 'Tabelas válidas devem passar');
  assert(!configValidator.validateTables(['invalid_table']), 'Tabelas inválidas devem falhar');
  assert(!configValidator.validateTables([]), 'Array vazio deve falhar');
});

// Teste 2: Validação de filtros
runTest('Validação de filtros', () => {
  const validFilters = {
    operacao: 'modalidade.eq.BLITZ',
    participacao: 'estado.eq.CONFIRMADO'
  };
  
  const invalidFilters = {
    invalid_table: 'some.filter'
  };
  
  assert(configValidator.validateFilters(validFilters), 'Filtros válidos devem passar');
  assert(!configValidator.validateFilters(invalidFilters), 'Filtros inválidos devem falhar');
  assert(configValidator.validateFilters({}), 'Filtros vazios devem passar (opcionais)');
});

// Teste 3: Validação de intervalos
runTest('Validação de intervalos de polling', () => {
  const validIntervals = {
    activeInterval: 5000,
    inactiveInterval: 30000
  };
  
  const invalidIntervals = {
    activeInterval: 500, // Muito baixo
    inactiveInterval: 500000 // Muito alto
  };
  
  assert(configValidator.validateIntervals(validIntervals), 'Intervalos válidos devem passar');
  assert(!configValidator.validateIntervals(invalidIntervals), 'Intervalos inválidos devem falhar');
});

// Teste 4: Sanitização de configuração
runTest('Sanitização de configuração', () => {
  const config: UseRealtimeUnifiedConfig = {
    tables: ['OPERACAO', ' participacao '], // Case insensitive e com espaços
    activeInterval: 500, // Será ajustado para mínimo
    enableRealtime: undefined // Será definido como true
  };
  
  const sanitized = configValidator.sanitizeConfig(config);
  
  assertEqual(sanitized.tables[0], 'operacao', 'Primeira tabela deve ser normalizada');
  assertEqual(sanitized.tables[1], 'participacao', 'Segunda tabela deve ser normalizada');
  assertEqual(sanitized.activeInterval, 1000, 'Intervalo deve ser ajustado para mínimo');
  assertEqual(sanitized.enableRealtime, true, 'enableRealtime deve ter valor padrão true');
});

// Teste 5: Configuração com valores padrão
runTest('Aplicação de valores padrão', () => {
  const config: UseRealtimeUnifiedConfig = {
    tables: ['operacao']
    // Não especifica outros valores
  };
  
  const sanitized = configValidator.sanitizeConfig(config);
  
  assertEqual(sanitized.enableRealtime, true, 'enableRealtime padrão deve ser true');
  assertEqual(sanitized.enablePolling, true, 'enablePolling padrão deve ser true');
  assertEqual(sanitized.enableFetch, true, 'enableFetch padrão deve ser true');
  assertEqual(sanitized.debug, false, 'debug padrão deve ser false');
  assert(sanitized.activeInterval! >= 1000, 'activeInterval deve ter valor mínimo válido');
});

// Teste 6: Validação de tabelas específicas
runTest('Validação de tabelas específicas do sistema', () => {
  const validTables = ['operacao', 'participacao', 'eventos_operacao', 'servidor', 'modalidade'];
  const invalidTables = ['users', 'posts', 'comments', 'invalid'];
  
  validTables.forEach(table => {
    assert(configValidator.validateTables([table]), `Tabela ${table} deve ser válida`);
  });
  
  invalidTables.forEach(table => {
    assert(!configValidator.validateTables([table]), `Tabela ${table} deve ser inválida`);
  });
});

// Teste 7: Filtros com sintaxe PostgREST
runTest('Validação de sintaxe de filtros PostgREST', () => {
  const validFilters = {
    operacao: 'id.eq.123',
    participacao: 'estado.in.(CONFIRMADO,NA_FILA)',
    eventos_operacao: 'data_evento.gte.2024-01-01'
  };
  
  assert(configValidator.validateFilters(validFilters), 'Filtros com sintaxe PostgREST devem ser válidos');
});

// Teste 8: Configuração completa
runTest('Configuração completa com todos os campos', () => {
  const config: UseRealtimeUnifiedConfig = {
    channelId: 'test-channel',
    tables: ['operacao', 'participacao'],
    filters: {
      operacao: 'modalidade.eq.BLITZ'
    },
    enableRealtime: true,
    enablePolling: true,
    enableFetch: true,
    activeInterval: 3000,
    inactiveInterval: 15000,
    focusInterval: 2000,
    blurInterval: 30000,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    debug: true
  };
  
  const sanitized = configValidator.sanitizeConfig(config);
  
  assertEqual(sanitized.channelId, 'test-channel', 'channelId deve ser preservado');
  assertEqual(sanitized.tables.length, 2, 'Deve ter 2 tabelas');
  assertEqual(sanitized.activeInterval, 3000, 'activeInterval deve ser preservado');
  assertEqual(sanitized.debug, true, 'debug deve ser preservado');
  assert(sanitized.startDate instanceof Date, 'startDate deve ser uma instância de Date');
  assert(sanitized.endDate instanceof Date, 'endDate deve ser uma instância de Date');
});

console.log('\n🎉 Todos os testes concluídos!');

// 🎯 TESTE DE PERFORMANCE SIMPLES
console.log('\n⚡ Teste de performance da validação...');

const startTime = Date.now();
const iterations = 1000;

for (let i = 0; i < iterations; i++) {
  const config: UseRealtimeUnifiedConfig = {
    tables: ['operacao', 'participacao'],
    activeInterval: 5000,
    enableRealtime: true
  };
  
  configValidator.sanitizeConfig(config);
}

const endTime = Date.now();
const avgTime = (endTime - startTime) / iterations;

console.log(`✅ ${iterations} sanitizações em ${endTime - startTime}ms (${avgTime.toFixed(2)}ms por operação)`);

if (avgTime < 1) {
  console.log('🚀 Performance excelente!');
} else if (avgTime < 5) {
  console.log('✅ Performance boa');
} else {
  console.log('⚠️ Performance pode ser melhorada');
}

console.log('\n✨ Teste completo do Hook Realtime Unificado finalizado!');
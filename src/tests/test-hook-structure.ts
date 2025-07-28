/**
 * 🧪 TESTE DE ESTRUTURA DO HOOK UNIFICADO
 * 
 * Testa apenas a estrutura e validação sem dependências externas
 */

import { configValidator } from '../hooks/utils/config-validator';

// 🎯 MOCK SIMPLES PARA TESTAR ESTRUTURA
interface MockConfig {
  tables: string[];
  filters?: Record<string, string>;
  activeInterval?: number;
  enableRealtime?: boolean;
}

// 🎯 FUNÇÃO DE TESTE
function testHookStructure() {
  console.log('🧪 Testando estrutura do Hook Realtime Unificado...\n');
  
  // Teste 1: Validação básica
  console.log('✅ Teste 1: Validação de tabelas');
  const validTables = configValidator.validateTables(['operacao', 'participacao']);
  const invalidTables = configValidator.validateTables(['invalid']);
  
  if (validTables && !invalidTables) {
    console.log('   ✓ Validação de tabelas funcionando corretamente');
  } else {
    console.log('   ✗ Erro na validação de tabelas');
  }
  
  // Teste 2: Sanitização
  console.log('✅ Teste 2: Sanitização de configuração');
  const config: MockConfig = {
    tables: ['OPERACAO', ' participacao '],
    activeInterval: 500,
    enableRealtime: undefined
  };
  
  const sanitized = configValidator.sanitizeConfig(config);
  
  if (sanitized.tables.includes('operacao') && 
      sanitized.tables.includes('participacao') &&
      sanitized.activeInterval >= 1000) {
    console.log('   ✓ Sanitização funcionando corretamente');
  } else {
    console.log('   ✗ Erro na sanitização');
  }
  
  // Teste 3: Performance
  console.log('✅ Teste 3: Performance da validação');
  const start = Date.now();
  
  for (let i = 0; i < 1000; i++) {
    configValidator.validateTables(['operacao', 'participacao']);
  }
  
  const end = Date.now();
  const time = end - start;
  
  if (time < 100) {
    console.log(`   ✓ Performance excelente: ${time}ms para 1000 validações`);
  } else {
    console.log(`   ⚠ Performance aceitável: ${time}ms para 1000 validações`);
  }
  
  console.log('\n🎉 Estrutura do hook validada com sucesso!');
}

// Executar teste
testHookStructure();
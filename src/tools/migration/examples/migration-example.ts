/**
 * Exemplo de uso das ferramentas de migração
 */

import { 
  MigrationTools, 
  MigrationCLI, 
  migrateLegacyHooks, 
  analyzeLegacyHooks 
} from '../index';

/**
 * Exemplo 1: Análise rápida de um arquivo
 */
async function analyzeFileExample() {
  console.log('🔍 Exemplo 1: Análise de arquivo único\n');
  
  try {
    const analysis = await MigrationTools.analyzeFile('./src/components/Calendar.tsx');
    
    console.log(`📄 Arquivo: ${analysis.filePath}`);
    console.log(`🔢 Hooks encontrados: ${analysis.totalHookUsages}`);
    console.log(`📊 Complexidade: ${analysis.complexity}`);
    console.log(`💡 Estratégia recomendada: ${analysis.migrationRecommendation.strategy}`);
    
    if (analysis.hookPatterns.length > 0) {
      console.log('\n📋 Hooks detectados:');
      analysis.hookPatterns.forEach(pattern => {
        console.log(`  • ${pattern.hookName} (linha ${pattern.lineNumber})`);
      });
    }
    
    if (analysis.migrationRecommendation.warnings.length > 0) {
      console.log('\n⚠️ Avisos:');
      analysis.migrationRecommendation.warnings.forEach(warning => {
        console.log(`  • ${warning}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 2: Análise de diretório completo
 */
async function analyzeDirectoryExample() {
  console.log('🔍 Exemplo 2: Análise de diretório\n');
  
  try {
    const analyses = await MigrationTools.analyzeDirectory('./src/components');
    
    console.log(`📁 Diretório analisado: ./src/components`);
    console.log(`📄 Arquivos com hooks legados: ${analyses.length}`);
    
    if (analyses.length > 0) {
      const totalHooks = analyses.reduce((sum, a) => sum + a.totalHookUsages, 0);
      const complexFiles = analyses.filter(a => a.complexity === 'complex').length;
      
      console.log(`🔢 Total de hooks legados: ${totalHooks}`);
      console.log(`⚠️ Arquivos complexos: ${complexFiles}`);
      
      console.log('\n📋 Resumo por arquivo:');
      analyses.forEach(analysis => {
        const fileName = analysis.filePath.split('/').pop();
        console.log(`  • ${fileName}: ${analysis.totalHookUsages} hooks (${analysis.complexity})`);
      });
      
      // Estatísticas de hooks
      const hookCounts: Record<string, number> = {};
      analyses.forEach(analysis => {
        analysis.hookPatterns.forEach(pattern => {
          hookCounts[pattern.hookName] = (hookCounts[pattern.hookName] || 0) + 1;
        });
      });
      
      console.log('\n📊 Hooks mais utilizados:');
      Object.entries(hookCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([hook, count]) => {
          console.log(`  • ${hook}: ${count} ocorrências`);
        });
    } else {
      console.log('✅ Nenhum hook legado encontrado!');
    }
    
  } catch (error) {
    console.error('❌ Erro na análise:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 3: Migração com dry-run
 */
async function dryRunMigrationExample() {
  console.log('🧪 Exemplo 3: Migração em modo dry-run\n');
  
  try {
    console.log('Executando migração em modo dry-run (sem aplicar mudanças)...\n');
    
    await MigrationTools.migrate('./src/components/calendario', {
      dryRun: true,
      skipValidation: false,
      force: true
    });
    
    console.log('✅ Dry-run concluído! Verifique o relatório gerado.');
    console.log('📄 Relatório: ./migration-reports/migration-analysis.html');
    
  } catch (error) {
    console.error('❌ Erro no dry-run:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 4: Migração completa com CLI avançado
 */
async function advancedMigrationExample() {
  console.log('🚀 Exemplo 4: Migração completa com CLI avançado\n');
  
  try {
    const cli = new MigrationCLI({
      includePatterns: ['**/components/**/*.tsx', '**/hooks/**/*.ts'],
      excludePatterns: ['**/*.test.*', '**/*.spec.*', '**/node_modules/**'],
      createBackups: true,
      validateAfterMigration: true,
      runTests: false,
      outputDir: './migration-reports',
      reportFormat: 'html'
    });
    
    // 1. Análise inicial
    console.log('📊 Executando análise inicial...');
    const analyses = await cli.analyze('./src/components');
    
    if (analyses.length === 0) {
      console.log('✅ Nenhum hook legado encontrado para migração.');
      return;
    }
    
    console.log(`📋 Encontrados ${analyses.length} arquivos com hooks legados`);
    
    // 2. Migração
    console.log('\n⚡ Executando migração...');
    await cli.migrate('./src/components', {
      dryRun: false,
      skipValidation: false,
      force: true // Para exemplo, pular confirmação
    });
    
    // 3. Validação adicional
    console.log('\n✅ Executando validação adicional...');
    const validations = await cli.validate('./src/components');
    
    const validFiles = validations.filter(v => v.isValid).length;
    const invalidFiles = validations.length - validFiles;
    
    console.log(`✅ Arquivos válidos: ${validFiles}`);
    console.log(`⚠️ Arquivos com problemas: ${invalidFiles}`);
    
    if (invalidFiles > 0) {
      console.log('\n⚠️ Alguns arquivos apresentaram problemas na validação.');
      console.log('📄 Verifique o relatório detalhado: ./migration-reports/validation-report.html');
    }
    
    console.log('\n🎉 Migração concluída!');
    console.log('📄 Relatórios gerados em: ./migration-reports/');
    
  } catch (error) {
    console.error('❌ Erro na migração avançada:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 5: Validação de arquivos já migrados
 */
async function validationExample() {
  console.log('✅ Exemplo 5: Validação de arquivos migrados\n');
  
  try {
    const validations = await MigrationTools.validate('./src/components');
    
    if (validations.length === 0) {
      console.log('ℹ️ Nenhum arquivo migrado encontrado para validação.');
      return;
    }
    
    console.log(`📄 Arquivos validados: ${validations.length}`);
    
    const validCount = validations.filter(v => v.isValid).length;
    const invalidCount = validations.length - validCount;
    
    console.log(`✅ Válidos: ${validCount}`);
    console.log(`❌ Com problemas: ${invalidCount}`);
    
    if (invalidCount > 0) {
      console.log('\n⚠️ Problemas encontrados:');
      validations.forEach((validation, index) => {
        if (!validation.isValid) {
          console.log(`\n📄 Arquivo ${index + 1}:`);
          validation.errors.forEach(error => {
            console.log(`  ❌ ${error.type}: ${error.message}`);
          });
        }
      });
    }
    
    // Verificar resultados de testes
    const testsRun = validations.filter(v => v.testResults && v.testResults.length > 0);
    if (testsRun.length > 0) {
      console.log('\n🧪 Resultados dos testes:');
      testsRun.forEach(validation => {
        validation.testResults?.forEach(test => {
          const status = test.passed ? '✅' : '❌';
          console.log(`  ${status} ${test.testName} (${test.duration}ms)`);
        });
      });
    }
    
  } catch (error) {
    console.error('❌ Erro na validação:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 6: Rollback usando backups
 */
async function rollbackExample() {
  console.log('🔄 Exemplo 6: Rollback usando backups\n');
  
  try {
    console.log('⚠️ ATENÇÃO: Este exemplo irá reverter arquivos migrados!');
    console.log('Certifique-se de que deseja continuar...\n');
    
    // Em um cenário real, você pediria confirmação do usuário aqui
    
    await MigrationTools.rollback('./src/components');
    
    console.log('✅ Rollback concluído!');
    console.log('📄 Arquivos revertidos para versões anteriores usando backups.');
    
  } catch (error) {
    console.error('❌ Erro no rollback:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Exemplo 7: Uso das funções utilitárias
 */
async function utilityFunctionsExample() {
  console.log('🛠️ Exemplo 7: Funções utilitárias\n');
  
  try {
    // Análise rápida usando função utilitária
    console.log('📊 Análise rápida com analyzeLegacyHooks:');
    const quickAnalysis = await analyzeLegacyHooks('./src/components');
    console.log(`Arquivos analisados: ${quickAnalysis.length}`);
    
    // Migração rápida usando função utilitária
    console.log('\n🚀 Migração rápida com migrateLegacyHooks:');
    await migrateLegacyHooks('./src/components', {
      dryRun: true, // Sempre usar dry-run em exemplos
      skipValidation: false,
      force: true
    });
    
    console.log('✅ Funções utilitárias executadas com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro nas funções utilitárias:', error);
  }
  
  console.log('\n' + '='.repeat(50) + '\n');
}

/**
 * Função principal que executa todos os exemplos
 */
async function runAllExamples() {
  console.log('🎯 Exemplos de Uso das Ferramentas de Migração\n');
  console.log('Este script demonstra como usar as ferramentas de migração de hooks realtime.\n');
  
  // Executar exemplos em sequência
  await analyzeFileExample();
  await analyzeDirectoryExample();
  await dryRunMigrationExample();
  await advancedMigrationExample();
  await validationExample();
  // await rollbackExample(); // Comentado para evitar reversões acidentais
  await utilityFunctionsExample();
  
  console.log('🎉 Todos os exemplos foram executados!');
  console.log('\n📚 Para mais informações, consulte:');
  console.log('  • Guia de Migração: ./MIGRATION_GUIDE.md');
  console.log('  • Documentação da API: ./README.md');
  console.log('  • Testes: ./tests/');
}

/**
 * Exemplo de configuração personalizada
 */
function customConfigurationExample() {
  console.log('⚙️ Exemplo de configuração personalizada:\n');
  
  const customConfig = {
    includePatterns: [
      '**/components/**/*.tsx',
      '**/pages/**/*.tsx',
      '**/hooks/**/*.ts'
    ],
    excludePatterns: [
      '**/*.test.*',
      '**/*.spec.*',
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**'
    ],
    createBackups: true,
    validateAfterMigration: true,
    runTests: true,
    targetHook: 'useRealtimeUnified',
    legacyHooks: [
      'useRealtimePuro',
      'useRealtimeSimple',
      'useRealtimeOperacoes',
      'useRealtimeEventos'
    ],
    outputDir: './custom-migration-reports',
    reportFormat: 'html' as const
  };
  
  console.log('Configuração personalizada:');
  console.log(JSON.stringify(customConfig, null, 2));
  
  console.log('\nUso com configuração personalizada:');
  console.log(`
const cli = new MigrationCLI(customConfig);
await cli.migrate('./src');
  `);
}

// Executar exemplos se este arquivo for executado diretamente
if (require.main === module) {
  runAllExamples().catch(console.error);
}

// Exportar funções para uso em outros arquivos
export {
  analyzeFileExample,
  analyzeDirectoryExample,
  dryRunMigrationExample,
  advancedMigrationExample,
  validationExample,
  rollbackExample,
  utilityFunctionsExample,
  customConfigurationExample,
  runAllExamples
};
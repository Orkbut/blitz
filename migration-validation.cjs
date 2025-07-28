#!/usr/bin/env node

/**
 * Script de validação da migração dos hooks de realtime
 * 
 * Verifica se todos os componentes foram migrados para usar o hook unificado
 */

const fs = require('fs');
const path = require('path');

const COMPONENTS_DIR = './src/components';
const LEGACY_HOOKS = [
  'useRealtimeCentralized',
  'useRealtimeEventos', 
  'useRealtimePuro',
  'useRealtimeSimple',
  'useRealtimeOperacoes',
  'useRealtimeUnificado',
  'useRealtimeCalendarioSupervisor'
];

function findFilesRecursively(dir, extension = '.tsx') {
  const files = [];
  
  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item.endsWith(extension) || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function checkFileForLegacyHooks(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  for (const hook of LEGACY_HOOKS) {
    // Verificar importações
    const importRegex = new RegExp(`import.*${hook}.*from`, 'g');
    if (importRegex.test(content)) {
      issues.push(`❌ Importação legada encontrada: ${hook}`);
    }
    
    // Verificar uso direto
    const useRegex = new RegExp(`${hook}\\s*\\(`, 'g');
    if (useRegex.test(content)) {
      issues.push(`❌ Uso direto encontrado: ${hook}`);
    }
  }
  
  // Verificar se usa o hook unificado
  const hasUnifiedHook = content.includes('useRealtimeUnified');
  
  return {
    hasIssues: issues.length > 0,
    issues,
    hasUnifiedHook,
    filePath
  };
}

function main() {
  console.log('🔍 Validando migração dos hooks de realtime...\n');
  
  if (!fs.existsSync(COMPONENTS_DIR)) {
    console.error(`❌ Diretório ${COMPONENTS_DIR} não encontrado`);
    process.exit(1);
  }
  
  const componentFiles = findFilesRecursively(COMPONENTS_DIR);
  console.log(`📁 Encontrados ${componentFiles.length} arquivos de componentes\n`);
  
  let totalIssues = 0;
  let migratedFiles = 0;
  
  for (const file of componentFiles) {
    const result = checkFileForLegacyHooks(file);
    
    if (result.hasIssues) {
      console.log(`📄 ${result.filePath}:`);
      result.issues.forEach(issue => console.log(`  ${issue}`));
      console.log('');
      totalIssues += result.issues.length;
    } else if (result.hasUnifiedHook) {
      console.log(`✅ ${result.filePath}: Migrado para useRealtimeUnified`);
      migratedFiles++;
    }
  }
  
  console.log('\n📊 Resumo da migração:');
  console.log(`✅ Arquivos migrados: ${migratedFiles}`);
  console.log(`❌ Issues encontradas: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log('\n🎉 Migração concluída com sucesso! Todos os componentes estão usando o hook unificado.');
    process.exit(0);
  } else {
    console.log('\n⚠️  Migração incompleta. Corrija as issues acima antes de prosseguir.');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
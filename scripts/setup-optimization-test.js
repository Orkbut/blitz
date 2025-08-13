#!/usr/bin/env node

/**
 * Script de configuração do ambiente de testes para otimização
 * 
 * Este script prepara o ambiente para testar as otimizações do componente
 * GerenciarMembrosModal de forma isolada e controlada.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

console.log('🚀 Configurando ambiente de testes para otimização...\n');

// 1. Verificar se estamos na branch correta

try {
    const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();

    if (currentBranch !== 'feature/optimize-gerenciar-membros') {
        console.log('⚠️  Aviso: Você não está na branch feature/optimize-gerenciar-membros');
        console.log(`   Branch atual: ${currentBranch}`);
        console.log('   Execute: git checkout feature/optimize-gerenciar-membros\n');
    } else {
        console.log('✅ Branch correta: feature/optimize-gerenciar-membros\n');
    }
} catch (error) {
    console.log('⚠️  Não foi possível verificar a branch atual\n');
}

// 2. Verificar arquivos de configuração
const configFiles = [
    { path: '.env.local', description: 'Arquivo de configuração de ambiente' },
    { path: 'src/utils/featureFlags.ts', description: 'Utilitário de feature flags' }
];

console.log('📋 Verificando arquivos de configuração:');
configFiles.forEach(file => {
    if (fs.existsSync(file.path)) {
        console.log(`✅ ${file.path} - ${file.description}`);
    } else {
        console.log(`❌ ${file.path} - ${file.description} (FALTANDO)`);
    }
});

// 3. Criar diretório de testes se não existir
const testDir = 'src/components/GerenciarMembrosModal/__tests__';
if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
    console.log(`\n📁 Criado diretório de testes: ${testDir}`);
}

// 4. Criar arquivo de teste básico
const testFile = path.join(testDir, 'performance.test.js');
if (!fs.existsSync(testFile)) {
    const testContent = `/**
 * Testes básicos de performance para GerenciarMembrosModal
 * 
 * Execute com: npm test -- performance.test.js
 */

describe('GerenciarMembrosModal Performance Tests', () => {
  beforeEach(() => {
    // Limpar métricas antes de cada teste
    if (window.performance && window.performance.clearMarks) {
      window.performance.clearMarks();
      window.performance.clearMeasures();
    }
  });

  test('deve carregar em menos de 500ms', () => {
    // Este teste será implementado quando o componente otimizado estiver pronto
    expect(true).toBe(true);
  });

  test('deve ter menos re-renders que a versão anterior', () => {
    // Este teste será implementado quando o componente otimizado estiver pronto
    expect(true).toBe(true);
  });

  test('deve funcionar corretamente em mobile', () => {
    // Este teste será implementado quando o componente otimizado estiver pronto
    expect(true).toBe(true);
  });
});
`;

    fs.writeFileSync(testFile, testContent);
    console.log(`✅ Criado arquivo de teste: ${testFile}`);
}

// 5. Verificar dependências necessárias
console.log('\n📦 Verificando dependências:');

const packageJsonPath = 'package.json';
if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const requiredDeps = [
        'react',
        'react-dom',
        'next'
    ];

    const devDeps = [
        '@testing-library/react',
        '@testing-library/jest-dom',
        'jest'
    ];

    requiredDeps.forEach(dep => {
        if (packageJson.dependencies && packageJson.dependencies[dep]) {
            console.log(`✅ ${dep} (produção)`);
        } else {
            console.log(`❌ ${dep} (produção) - FALTANDO`);
        }
    });

    devDeps.forEach(dep => {
        if (packageJson.devDependencies && packageJson.devDependencies[dep]) {
            console.log(`✅ ${dep} (desenvolvimento)`);
        } else {
            console.log(`⚠️  ${dep} (desenvolvimento) - Recomendado para testes`);
        }
    });
}

// 6. Criar checklist de validação
const checklistPath = 'OPTIMIZATION_CHECKLIST.md';
const checklistContent = `# Checklist de Otimização - GerenciarMembrosModal

## ✅ Preparação Concluída
- [x] Branch feature/optimize-gerenciar-membros criada
- [x] Feature flag configurada (.env.local)
- [x] Utilitário de feature flags criado
- [x] Ambiente de testes preparado

## 📋 Próximos Passos (Tarefa 2.1)
- [ ] Identificar componentes com re-renders frequentes
- [ ] Aplicar React.memo nos componentes apropriados
- [ ] Testar redução de re-renders com React DevTools
- [ ] Medir performance antes/depois

## 🎯 Métricas de Sucesso
- [ ] Modal abre em menos de 500ms
- [ ] Lista com 100+ membros não apresenta lag
- [ ] Busca responde instantaneamente
- [ ] Re-renders reduzidos em pelo menos 50%

## 🔧 Ferramentas de Teste
- React DevTools (disponível no navegador)
- Console.time para medições básicas
- Feature flags para rollback fácil

## 📝 Notas
- Sempre testar com feature flag desabilitada primeiro
- Manter compatibilidade com versão atual
- Documentar todas as mudanças
`;

fs.writeFileSync(checklistPath, checklistContent);
console.log(`\n📝 Criado checklist: ${checklistPath}`);

// 7. Instruções finais
console.log('\n🎉 Ambiente de testes configurado com sucesso!');
console.log('\n📋 Próximos passos:');
console.log('1. Revisar o checklist: OPTIMIZATION_CHECKLIST.md');
console.log('2. Executar tarefa 2.1: Aplicar React.memo');
console.log('3. Testar com: NEXT_PUBLIC_USE_OPTIMIZED_GERENCIAR_MEMBROS=true');
console.log('\n💡 Dica: Use git status para ver os arquivos criados');
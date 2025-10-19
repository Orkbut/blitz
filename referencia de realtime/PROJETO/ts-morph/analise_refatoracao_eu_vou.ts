import { Project, Node } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ANÁLISE COMPLETA DA ARQUITETURA "EU VOU"
 * 
 * Objetivo: Mapear TODA a estrutura antes da refatoração
 * - O que cada componente faz?
 * - Quem chama o quê?
 * - Quais contratos públicos existem?
 * - Onde estão os pontos de impacto?
 */

interface ComponenteAnalise {
  arquivo: string;
  tipo: 'API' | 'Service' | 'Repository' | 'Hook' | 'Component' | 'Type';
  funcoes: string[];
  dependencias: string[];
  exportacoes: string[];
  chamadoPor: string[];
  contratoPublico: boolean;
  impactoUsuario: 'ALTO' | 'MEDIO' | 'BAIXO';
}

interface MapeamentoCompleto {
  componentes: ComponenteAnalise[];
  fluxoEuVou: string[];
  fluxoCancelar: string[];
  apisPublicas: string[];
  tiposExportados: string[];
  pontosDeRisco: string[];
  dependenciasExternas: string[];
}

class AnalisadorRefatoracao {
  private project: Project;
  private mapeamento: MapeamentoCompleto;
  private baseDir: string;

  constructor() {
    // Configurar projeto ts-morph apontando para o radar-detran
    this.baseDir = path.resolve(process.cwd(), 'radar-detran');
    this.project = new Project({
      tsConfigFilePath: path.join(this.baseDir, 'tsconfig.json'),
    });

    this.mapeamento = {
      componentes: [],
      fluxoEuVou: [],
      fluxoCancelar: [],
      apisPublicas: [],
      tiposExportados: [],
      pontosDeRisco: [],
      dependenciasExternas: []
    };
  }

  async executarAnalise(): Promise<void> {
    console.log('🔍 INICIANDO ANÁLISE COMPLETA DA ARQUITETURA EU VOU...');

    // 1. Mapear todos os arquivos relacionados ao "Eu Vou"
    await this.mapearComponentesEuVou();

    // 2. Analisar APIs públicas
    await this.analisarAPIsPublicas();

    // 3. Analisar fluxos de dados
    await this.analisarFluxosDados();

    // 4. Identificar dependências e riscos
    await this.identificarRiscos();

    // 5. Gerar relatórios
    await this.gerarRelatorios();

    console.log('✅ ANÁLISE COMPLETA FINALIZADA!');
  }

  private async mapearComponentesEuVou(): Promise<void> {
    console.log('🔍 Mapeando componentes relacionados ao "Eu Vou"...');

    // Arquivos-chave do sistema Eu Vou
    const arquivosChave = [
      // APIs
      'src/app/api/eu-vou/route.ts',
      'src/app/api/agendamento/operacoes/[id]/eu-vou/route.ts',
      'src/app/api/agendamento/cancelar/route.ts',
      
      // Services de Domínio
      'src/core/domain/services/EuVouOrchestrator.ts',
      'src/core/domain/services/ValidadorParticipacao.ts',
      'src/core/domain/services/CalculadoraDiaria.ts',
      
      // Repositories
      'src/core/infrastructure/repositories/SupabaseOperacaoRepository.ts',
      'src/core/infrastructure/repositories/SupabaseServidorRepository.ts',
      
      // Use Cases
      'src/core/application/use-cases/membro/EuVouUseCase.ts',
      
      // Hooks
      'src/hooks/useOperacoes.ts',
      'src/hooks/useRealtimeOperacoes.ts',
      
      // Components
      'src/components/calendario/CalendarioMembro.tsx',
      'src/components/supervisor/CalendarioSupervisor.tsx',
      
      // Types
      'src/shared/types/index.ts'
    ];

    for (const arquivo of arquivosChave) {
      await this.analisarArquivo(arquivo);
    }
  }

  private async analisarArquivo(caminhoArquivo: string): Promise<void> {
    const caminhoCompleto = path.join(this.baseDir, caminhoArquivo);
    
    if (!fs.existsSync(caminhoCompleto)) {
      console.log(`⚠️ Arquivo não encontrado: ${caminhoArquivo}`);
      return;
    }

    try {
      const sourceFile = this.project.addSourceFileAtPath(caminhoCompleto);
      
      const componente: ComponenteAnalise = {
        arquivo: caminhoArquivo,
        tipo: this.determinarTipoArquivo(caminhoArquivo),
        funcoes: [],
        dependencias: [],
        exportacoes: [],
        chamadoPor: [],
        contratoPublico: this.isContratoPublico(caminhoArquivo),
        impactoUsuario: this.determinarImpactoUsuario(caminhoArquivo)
      };

      // Extrair funções/métodos
      sourceFile.getFunctions().forEach(func => {
        componente.funcoes.push(func.getName() || 'anonymous');
      });

      sourceFile.getClasses().forEach(classe => {
        classe.getMethods().forEach(metodo => {
          componente.funcoes.push(`${classe.getName()}.${metodo.getName()}`);
        });
      });

      // Extrair imports (dependências)
      sourceFile.getImportDeclarations().forEach(importDecl => {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        if (moduleSpecifier.startsWith('.') || moduleSpecifier.startsWith('@/')) {
          componente.dependencias.push(moduleSpecifier);
        }
      });

      // Extrair exports
      sourceFile.getExportDeclarations().forEach(exportDecl => {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        if (moduleSpecifier) {
          componente.exportacoes.push(moduleSpecifier);
        }
      });

      // Identificar exports nomeados
      sourceFile.getExportedDeclarations().forEach((declarations, name) => {
        componente.exportacoes.push(name);
      });

      this.mapeamento.componentes.push(componente);
      
    } catch (error) {
      console.log(`❌ Erro ao analisar ${caminhoArquivo}:`, error);
    }
  }

  private determinarTipoArquivo(caminho: string): ComponenteAnalise['tipo'] {
    if (caminho.includes('/api/')) return 'API';
    if (caminho.includes('/services/')) return 'Service';
    if (caminho.includes('/repositories/')) return 'Repository';
    if (caminho.includes('/hooks/')) return 'Hook';
    if (caminho.includes('/components/')) return 'Component';
    if (caminho.includes('/types/')) return 'Type';
    return 'Service';
  }

  private isContratoPublico(caminho: string): boolean {
    // APIs são sempre contratos públicos
    if (caminho.includes('/api/')) return true;
    // Hooks são contratos públicos
    if (caminho.includes('/hooks/')) return true;
    // Components são contratos públicos
    if (caminho.includes('/components/')) return true;
    // Types exportados são contratos públicos
    if (caminho.includes('/types/')) return true;
    return false;
  }

  private determinarImpactoUsuario(caminho: string): ComponenteAnalise['impactoUsuario'] {
    // APIs e Components têm alto impacto
    if (caminho.includes('/api/') || caminho.includes('/components/')) return 'ALTO';
    // Hooks têm médio impacto
    if (caminho.includes('/hooks/')) return 'MEDIO';
    // Services internos têm baixo impacto direto
    return 'BAIXO';
  }

  private async analisarAPIsPublicas(): Promise<void> {
    console.log('🔍 Analisando APIs públicas...');

    const apisEuVou = this.mapeamento.componentes.filter(c => 
      c.tipo === 'API' && c.arquivo.includes('eu-vou')
    );

    for (const api of apisEuVou) {
      this.mapeamento.apisPublicas.push(api.arquivo);
      
      // Estas são APIs que usuários finais consomem diretamente
      this.mapeamento.pontosDeRisco.push(
        `API PÚBLICA: ${api.arquivo} - Mudanças podem quebrar o frontend`
      );
    }
  }

  private async analisarFluxosDados(): Promise<void> {
    console.log('🔍 Analisando fluxos de dados...');

    // Mapear fluxo "Eu Vou"
    this.mapeamento.fluxoEuVou = [
      'CalendarioMembro.tsx → botão "Eu Vou"',
      'Hook useOperacoes → chama API',
      'API /api/agendamento/operacoes/[id]/eu-vou',
      'EuVouOrchestrator.executar()',
      'ValidadorParticipacao.validar()',
      'SupabaseOperacaoRepository + SupabaseServidorRepository',
      'Banco de dados (insert/update)',
      'Real-time trigger',
      'CalendarioSupervisor.tsx + CalendarioMembro.tsx (atualização)'
    ];

    // Mapear fluxo "Cancelar"
    this.mapeamento.fluxoCancelar = [
      'CalendarioMembro.tsx → botão "Cancelar"',
      'API /api/agendamento/cancelar',
      'EuVouOrchestrator.cancelarParticipacao()',
      'Banco de dados (soft delete)',
      'Real-time trigger',
      'Interfaces atualizadas'
    ];
  }

  private async identificarRiscos(): Promise<void> {
    console.log('🔍 Identificando riscos de refatoração...');

    // Riscos de APIs públicas
    this.mapeamento.pontosDeRisco.push(
      'RISCO ALTO: Mudança em /api/eu-vou pode quebrar CalendarioMembro',
      'RISCO ALTO: Mudança em EuVouOrchestrator pode afetar múltiplas APIs',
      'RISCO MÉDIO: Alteração em ValidadorParticipacao pode afetar fluxo de aprovação supervisor',
      'RISCO MÉDIO: Mudanças em repositories podem afetar outras funcionalidades',
      'RISCO BAIXO: Real-time precisa continuar funcionando após refatoração'
    );

    // Dependências externas críticas
    this.mapeamento.dependenciasExternas = [
      'Banco Supabase - estrutura da tabela participacao',
      'Real-time Supabase - triggers automáticos',
      'Frontend - contratos de API',
      'Supervisor - dependente das mesmas APIs'
    ];
  }

  private async gerarRelatorios(): Promise<void> {
    console.log('📊 Gerando relatórios...');

    // Relatório de componentes
    const relatorioComponentes = {
      timestamp: new Date().toISOString(),
      totalComponentes: this.mapeamento.componentes.length,
      componentesPorTipo: this.agruparPorTipo(),
      componentesAltoRisco: this.mapeamento.componentes.filter(c => 
        c.contratoPublico && c.impactoUsuario === 'ALTO'
      ),
      mapeamentoCompleto: this.mapeamento
    };

    // Salvar relatório
    const caminhoRelatorio = path.join(process.cwd(), 'ts-morph', 'relatorio_analise_refatoracao.json');
    fs.writeFileSync(caminhoRelatorio, JSON.stringify(relatorioComponentes, null, 2));

    // Relatório executivo
    await this.gerarRelatorioExecutivo();
  }

  private agruparPorTipo(): Record<string, number> {
    const grupos: Record<string, number> = {};
    this.mapeamento.componentes.forEach(c => {
      grupos[c.tipo] = (grupos[c.tipo] || 0) + 1;
    });
    return grupos;
  }

  private async gerarRelatorioExecutivo(): Promise<void> {
    const relatorioExecutivo = `
# RELATÓRIO EXECUTIVO - ANÁLISE PARA REFATORAÇÃO "EU VOU"

## 📊 RESUMO GERAL
- **Total de componentes analisados:** ${this.mapeamento.componentes.length}
- **APIs públicas identificadas:** ${this.mapeamento.apisPublicas.length}
- **Pontos de risco mapeados:** ${this.mapeamento.pontosDeRisco.length}

## 🔥 COMPONENTES DE ALTO RISCO
${this.mapeamento.componentes
  .filter(c => c.contratoPublico && c.impactoUsuario === 'ALTO')
  .map(c => `- **${c.arquivo}** (${c.tipo}) - Contrato público com alto impacto`)
  .join('\n')}

## 🔄 FLUXO ATUAL "EU VOU"
${this.mapeamento.fluxoEuVou.map((etapa, i) => `${i + 1}. ${etapa}`).join('\n')}

## 🔄 FLUXO ATUAL "CANCELAR"
${this.mapeamento.fluxoCancelar.map((etapa, i) => `${i + 1}. ${etapa}`).join('\n')}

## ⚠️ PONTOS DE RISCO IDENTIFICADOS
${this.mapeamento.pontosDeRisco.map(risco => `- ${risco}`).join('\n')}

## 🔗 DEPENDÊNCIAS EXTERNAS CRÍTICAS
${this.mapeamento.dependenciasExternas.map(dep => `- ${dep}`).join('\n')}

## 📋 RECOMENDAÇÕES PARA REFATORAÇÃO

### ✅ PODE SER ALTERADO COM SEGURANÇA:
- Services internos (ValidadorParticipacao, CalculadoraDiaria)
- Repositories (desde que mantidos os contratos)
- Lógica interna do EuVouOrchestrator

### ⚠️ REQUER CUIDADO ESPECIAL:
- APIs públicas (/api/eu-vou, /api/agendamento/*)
- Hooks (useOperacoes, useRealtimeOperacoes)
- Components (CalendarioMembro, CalendarioSupervisor)

### 🚫 NÃO ALTERAR SEM ANÁLISE PROFUNDA:
- Estrutura do banco de dados
- Contratos de API existentes
- Real-time triggers

## 🎯 ESTRATÉGIA DE REFATORAÇÃO SUGERIDA

1. **FASE 1:** Simplificar lógica interna (EuVouOrchestrator)
2. **FASE 2:** Unificar validações (ValidadorParticipacao única)
3. **FASE 3:** Otimizar APIs (manter contratos, simplificar implementação)
4. **FASE 4:** Testar real-time e interfaces

---
*Análise gerada em: ${new Date().toISOString()}*
`;

    const caminhoExecutivo = path.join(process.cwd(), 'ts-morph', 'relatorio_executivo_refatoracao.md');
    fs.writeFileSync(caminhoExecutivo, relatorioExecutivo);

    console.log(`✅ Relatórios salvos em:`);
    console.log(`📄 ${caminhoExecutivo}`);
    console.log(`📊 ${path.join(process.cwd(), 'ts-morph', 'relatorio_analise_refatoracao.json')}`);
  }
}

// Executar análise
async function main() {
  const analisador = new AnalisadorRefatoracao();
  await analisador.executarAnalise();
}

main().catch(console.error); 
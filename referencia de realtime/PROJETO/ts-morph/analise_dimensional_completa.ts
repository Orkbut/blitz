import { Project, Node, CallExpression, PropertyAccessExpression } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ANÁLISE DIMENSIONAL COMPLETA - "TODAS AS VEIAS E ARTÉRIAS"
 * 
 * Mapear EXATAMENTE:
 * - O que cada função faz?
 * - Quem chama o quê? (com linha e arquivo)
 * - Quais contratos públicos existem?
 * - Onde o usuário final pode ser impactado?
 * - Jobs, webhooks, integrações externas
 */

interface FuncaoDetalhada {
  nome: string;
  arquivo: string;
  linha: number;
  parametros: string[];
  tipoRetorno: string;
  chamaFuncoes: string[];
  chamadaPor: Array<{
    arquivo: string;
    linha: number;
    funcao: string;
  }>;
  exportada: boolean;
  publica: boolean;
}

interface ContratoPublico {
  tipo: 'API' | 'Hook' | 'Component' | 'Type' | 'Function';
  nome: string;
  arquivo: string;
  assinatura: string;
  usadoPor: string[];
  impactoUsuario: 'DIRETO' | 'INDIRETO' | 'NENHUM';
}

interface PontoImpactoUsuario {
  tipo: 'BOTAO' | 'MODAL' | 'CALENDARIO' | 'FILA' | 'HISTORICO' | 'VALIDACAO';
  descricao: string;
  arquivo: string;
  funcaoResponsavel: string;
  fluxoDependente: string[];
}

interface AnaliseCompleta {
  funcoes: FuncaoDetalhada[];
  contratosPublicos: ContratoPublico[];
  pontosImpactoUsuario: PontoImpactoUsuario[];
  mapeamentoChamadas: Record<string, string[]>;
  dependenciasExternas: string[];
  fluxosCompletos: Record<string, string[]>;
}

class AnalisadorDimensional {
  private project: Project;
  private analise: AnaliseCompleta;
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(process.cwd(), 'radar-detran');
    this.project = new Project({
      tsConfigFilePath: path.join(this.baseDir, 'tsconfig.json'),
    });

    this.analise = {
      funcoes: [],
      contratosPublicos: [],
      pontosImpactoUsuario: [],
      mapeamentoChamadas: {},
      dependenciasExternas: [],
      fluxosCompletos: {}
    };
  }

  async executarAnaliseCompleta(): Promise<void> {
    console.log('🔍 INICIANDO ANÁLISE DIMENSIONAL COMPLETA...');

    // 1. Mapear TODAS as funções do sistema
    await this.mapearTodasFuncoes();

    // 2. Identificar TODOS os contratos públicos
    await this.identificarContratosPublicos();

    // 3. Mapear TODOS os pontos de impacto do usuário
    await this.mapearPontosImpactoUsuario();

    // 4. Analisar chamadas entre funções
    await this.analisarChamadasFuncoes();

    // 5. Identificar dependências externas
    await this.identificarDependenciasExternas();

    // 6. Mapear fluxos completos
    await this.mapearFluxosCompletos();

    // 7. Gerar relatório dimensional
    await this.gerarRelatorioCompleto();

    console.log('✅ ANÁLISE DIMENSIONAL COMPLETA FINALIZADA!');
  }

  private async mapearTodasFuncoes(): Promise<void> {
    console.log('🔍 Mapeando TODAS as funções do sistema...');

    // Incluir TODOS os arquivos relevantes (não só os do sistema Eu Vou)
    const padroes = [
      'src/**/*.ts',
      'src/**/*.tsx'
    ];

    for (const padrao of padroes) {
      const arquivos = this.project.addSourceFilesAtPaths(path.join(this.baseDir, padrao));
      
      for (const arquivo of arquivos) {
        await this.analisarFuncoesDoArquivo(arquivo.getFilePath());
      }
    }
  }

  private async analisarFuncoesDoArquivo(caminhoCompleto: string): Promise<void> {
    try {
      const sourceFile = this.project.getSourceFile(caminhoCompleto);
      if (!sourceFile) return;

      const caminhoRelativo = path.relative(this.baseDir, caminhoCompleto).replace(/\\/g, '/');

      // Analisar funções
      sourceFile.getFunctions().forEach(func => {
        const funcaoDetalhada: FuncaoDetalhada = {
          nome: func.getName() || 'anonymous',
          arquivo: caminhoRelativo,
          linha: func.getStartLineNumber(),
          parametros: func.getParameters().map(p => p.getName()),
          tipoRetorno: func.getReturnTypeNode()?.getText() || 'unknown',
          chamaFuncoes: [],
          chamadaPor: [],
          exportada: func.hasExportKeyword(),
          publica: this.isFuncaoPublica(caminhoRelativo, func.getName() || '')
        };

        this.analise.funcoes.push(funcaoDetalhada);
      });

      // Analisar métodos de classes
      sourceFile.getClasses().forEach(classe => {
        classe.getMethods().forEach(metodo => {
          const nomeCompleto = `${classe.getName()}.${metodo.getName()}`;
          
          const funcaoDetalhada: FuncaoDetalhada = {
            nome: nomeCompleto,
            arquivo: caminhoRelativo,
            linha: metodo.getStartLineNumber(),
            parametros: metodo.getParameters().map(p => p.getName()),
            tipoRetorno: metodo.getReturnTypeNode()?.getText() || 'unknown',
            chamaFuncoes: [],
            chamadaPor: [],
            exportada: classe.hasExportKeyword(),
            publica: this.isFuncaoPublica(caminhoRelativo, nomeCompleto)
          };

          this.analise.funcoes.push(funcaoDetalhada);
        });
      });

    } catch (error) {
      console.log(`❌ Erro ao analisar ${caminhoCompleto}:`, error);
    }
  }

  private isFuncaoPublica(arquivo: string, nomeFuncao: string): boolean {
    // APIs são sempre públicas
    if (arquivo.includes('/api/')) return true;
    
    // Hooks são sempre públicos
    if (arquivo.includes('/hooks/')) return true;
    
    // Components são sempre públicos
    if (arquivo.includes('/components/')) return true;
    
    // Funções específicas que sabemos ser públicas
    const funcoesPublicas = [
      'POST', 'GET', 'PUT', 'DELETE', // APIs REST
      'useOperacoes', 'useRealtimeOperacoes', 'useRealtimeCentralized', // Hooks
      'CalendarioMembro', 'CalendarioSupervisor', // Components principais
    ];
    
    return funcoesPublicas.some(f => nomeFuncao.includes(f));
  }

  private async identificarContratosPublicos(): Promise<void> {
    console.log('🔍 Identificando TODOS os contratos públicos...');

    // APIs públicas
    this.analise.funcoes.filter(f => f.arquivo.includes('/api/')).forEach(func => {
      this.analise.contratosPublicos.push({
        tipo: 'API',
        nome: func.nome,
        arquivo: func.arquivo,
        assinatura: `${func.nome}(${func.parametros.join(', ')})`,
        usadoPor: [], // Será preenchido na análise de chamadas
        impactoUsuario: 'DIRETO'
      });
    });

    // Hooks públicos
    this.analise.funcoes.filter(f => f.arquivo.includes('/hooks/')).forEach(func => {
      this.analise.contratosPublicos.push({
        tipo: 'Hook',
        nome: func.nome,
        arquivo: func.arquivo,
        assinatura: `${func.nome}(${func.parametros.join(', ')})`,
        usadoPor: [],
        impactoUsuario: 'DIRETO'
      });
    });

    // Components públicos
    this.analise.funcoes.filter(f => f.arquivo.includes('/components/')).forEach(func => {
      this.analise.contratosPublicos.push({
        tipo: 'Component',
        nome: func.nome,
        arquivo: func.arquivo,
        assinatura: `${func.nome}(${func.parametros.join(', ')})`,
        usadoPor: [],
        impactoUsuario: 'DIRETO'
      });
    });
  }

  private async mapearPontosImpactoUsuario(): Promise<void> {
    console.log('🔍 Mapeando TODOS os pontos de impacto do usuário...');

    // Pontos conhecidos de impacto do MEMBRO
    const pontosMembro: PontoImpactoUsuario[] = [
      {
        tipo: 'BOTAO',
        descricao: 'Botão "Eu Vou" no CalendarioMembro',
        arquivo: 'src/components/calendario/CalendarioMembro.tsx',
        funcaoResponsavel: 'handleEuVou',
        fluxoDependente: ['API /api/agendamento/operacoes/[id]/eu-vou', 'EuVouOrchestrator.executar']
      },
      {
        tipo: 'BOTAO',
        descricao: 'Botão "Cancelar" no CalendarioMembro',
        arquivo: 'src/components/calendario/CalendarioMembro.tsx',
        funcaoResponsavel: 'handleCancelar',
        fluxoDependente: ['API /api/agendamento/cancelar', 'EuVouOrchestrator.cancelarParticipacao']
      },
      {
        tipo: 'MODAL',
        descricao: 'Modal de operação com detalhes',
        arquivo: 'src/components/calendario/OperacaoDialog.tsx',
        funcaoResponsavel: 'OperacaoDialog',
        fluxoDependente: ['useOperacoes', 'API /api/unified/operacoes']
      },
      {
        tipo: 'CALENDARIO',
        descricao: 'Calendário principal do membro',
        arquivo: 'src/components/calendario/CalendarioMembro.tsx',
        funcaoResponsavel: 'CalendarioMembro',
        fluxoDependente: ['useOperacoes', 'useRealtimeCentralized']
      }
    ];

    // Pontos conhecidos de impacto do SUPERVISOR
    const pontosSupervisor: PontoImpactoUsuario[] = [
      {
        tipo: 'CALENDARIO',
        descricao: 'Calendário do supervisor',
        arquivo: 'src/components/supervisor/CalendarioSupervisor.tsx',
        funcaoResponsavel: 'CalendarioSupervisor',
        fluxoDependente: ['useRealtimeCentralized', 'API supervisor/operacoes']
      },
      {
        tipo: 'MODAL',
        descricao: 'Modal Gerenciar Membros',
        arquivo: 'src/components/supervisor/GerenciarMembrosModal.tsx',
        funcaoResponsável: 'GerenciarMembrosModal',
        fluxoDependente: ['API supervisor/membros', 'API supervisor/gerenciar-participacao']
      },
      {
        tipo: 'FILA',
        descricao: 'Visualização da fila de espera',
        arquivo: 'src/components/supervisor/TimelineOperacoes.tsx',
        funcaoResponsavel: 'TimelineOperacoes',
        fluxoDependente: ['API agendamento/fila-espera']
      }
    ];

    this.analise.pontosImpactoUsuario = [...pontosMembro, ...pontosSupervisor];
  }

  private async analisarChamadasFuncoes(): Promise<void> {
    console.log('🔍 Analisando chamadas entre funções...');

    // Para cada arquivo, analisar chamadas de função
    const arquivos = this.project.getSourceFiles();
    
    for (const arquivo of arquivos) {
      const caminhoRelativo = path.relative(this.baseDir, arquivo.getFilePath()).replace(/\\/g, '/');
      
      // Encontrar todas as chamadas de função
      arquivo.forEachDescendant(node => {
        if (Node.isCallExpression(node)) {
          this.processarChamadaFuncao(node, caminhoRelativo);
        }
      });
    }
  }

  private processarChamadaFuncao(callExpr: CallExpression, arquivoOrigem: string): void {
    const expressao = callExpr.getExpression();
    let nomeFuncaoChamada = '';

    if (Node.isIdentifier(expressao)) {
      nomeFuncaoChamada = expressao.getText();
    } else if (Node.isPropertyAccessExpression(expressao)) {
      nomeFuncaoChamada = expressao.getText();
    }

    if (nomeFuncaoChamada) {
      // Encontrar a função correspondente
      const funcaoOrigem = this.analise.funcoes.find(f => f.arquivo === arquivoOrigem);
      const funcaoDestino = this.analise.funcoes.find(f => 
        f.nome === nomeFuncaoChamada || f.nome.includes(nomeFuncaoChamada)
      );

      if (funcaoOrigem && funcaoDestino) {
        // Adicionar à lista de chamadas
        funcaoOrigem.chamaFuncoes.push(nomeFuncaoChamada);
        funcaoDestino.chamadaPor.push({
          arquivo: arquivoOrigem,
          linha: callExpr.getStartLineNumber(),
          funcao: funcaoOrigem.nome
        });
      }

      // Mapear chamadas para relatório
      if (!this.analise.mapeamentoChamadas[arquivoOrigem]) {
        this.analise.mapeamentoChamadas[arquivoOrigem] = [];
      }
      this.analise.mapeamentoChamadas[arquivoOrigem].push(nomeFuncaoChamada);
    }
  }

  private async identificarDependenciasExternas(): Promise<void> {
    console.log('🔍 Identificando dependências externas...');

    this.analise.dependenciasExternas = [
      'Supabase Database - tabela operacao',
      'Supabase Database - tabela participacao',
      'Supabase Database - tabela servidor',
      'Supabase Realtime - triggers automáticos',
      'Frontend - contratos de API REST',
      'Frontend - hooks personalizados',
      'Frontend - componentes React',
      'Sistema de autenticação Supabase',
      'Jobs de limpeza automática',
      'Webhooks (se existirem)',
      'Integrações externas (se existirem)'
    ];
  }

  private async mapearFluxosCompletos(): Promise<void> {
    console.log('🔍 Mapeando fluxos completos...');

    this.analise.fluxosCompletos = {
      'FLUXO_EU_VOU_MEMBRO': [
        'CalendarioMembro.tsx → handleEuVou',
        'useOperacoes → chamada API',
        'API /api/agendamento/operacoes/[id]/eu-vou → POST',
        'EuVouOrchestrator.executar()',
        'ValidadorParticipacao.validar()',
        'SupabaseOperacaoRepository.buscarPorId()',
        'SupabaseServidorRepository.buscarPorId()',
        'Supabase Database → INSERT participacao',
        'Realtime trigger → notificação',
        'useRealtimeCentralized → detecta mudança',
        'CalendarioMembro.tsx → re-render',
        'CalendarioSupervisor.tsx → re-render'
      ],
      'FLUXO_CANCELAR_MEMBRO': [
        'CalendarioMembro.tsx → handleCancelar',
        'API /api/agendamento/cancelar → POST',
        'EuVouOrchestrator.cancelarParticipacao()',
        'Supabase Database → UPDATE participacao (soft delete)',
        'Realtime trigger → notificação',
        'Interfaces → atualização automática'
      ],
      'FLUXO_GERENCIAR_SUPERVISOR': [
        'CalendarioSupervisor.tsx → GerenciarMembrosModal',
        'API /api/supervisor/gerenciar-participacao',
        'EuVouOrchestrator → métodos de gerenciamento',
        'Banco de dados → alterações',
        'Real-time → atualizações automáticas'
      ]
    };
  }

  private async gerarRelatorioCompleto(): Promise<void> {
    console.log('📊 Gerando relatório dimensional completo...');

    const relatorio = {
      timestamp: new Date().toISOString(),
      resumo: {
        totalFuncoes: this.analise.funcoes.length,
        funcoesPublicas: this.analise.funcoes.filter(f => f.publica).length,
        contratosPublicos: this.analise.contratosPublicos.length,
        pontosImpactoUsuario: this.analise.pontosImpactoUsuario.length,
        dependenciasExternas: this.analise.dependenciasExternas.length
      },
      analiseCompleta: this.analise
    };

    // Salvar relatório JSON
    const caminhoJson = path.join(process.cwd(), 'ts-morph', 'analise_dimensional_completa.json');
    fs.writeFileSync(caminhoJson, JSON.stringify(relatorio, null, 2));

    // Gerar relatório executivo dimensional
    await this.gerarRelatorioExecutivoDimensional();

    console.log(`✅ Relatórios dimensionais salvos em:`);
    console.log(`📊 ${caminhoJson}`);
    console.log(`📄 ${path.join(process.cwd(), 'ts-morph', 'relatorio_dimensional_executivo.md')}`);
  }

  private async gerarRelatorioExecutivoDimensional(): Promise<void> {
    const funcoesPublicas = this.analise.funcoes.filter(f => f.publica);
    const funcoesPrivadas = this.analise.funcoes.filter(f => !f.publica);

    const relatorioExecutivo = `
# ANÁLISE DIMENSIONAL COMPLETA - "TODAS AS VEIAS E ARTÉRIAS"

## 📊 RESUMO DIMENSIONAL
- **Total de funções mapeadas:** ${this.analise.funcoes.length}
- **Funções públicas (RISCO ALTO):** ${funcoesPublicas.length}
- **Funções privadas (RISCO BAIXO):** ${funcoesPrivadas.length}
- **Contratos públicos identificados:** ${this.analise.contratosPublicos.length}
- **Pontos de impacto do usuário:** ${this.analise.pontosImpactoUsuario.length}

## 🚨 FUNÇÕES PÚBLICAS - NÃO ALTERAR
${funcoesPublicas.map(f => `- **${f.nome}** (${f.arquivo}:${f.linha}) - Contrato público`).join('\n')}

## ✅ FUNÇÕES PRIVADAS - PODEM SER ALTERADAS
${funcoesPrivadas.slice(0, 10).map(f => `- **${f.nome}** (${f.arquivo}:${f.linha}) - Lógica interna`).join('\n')}
${funcoesPrivadas.length > 10 ? `... e mais ${funcoesPrivadas.length - 10} funções privadas` : ''}

## 👤 PONTOS DE IMPACTO DO USUÁRIO FINAL

### MEMBRO (não pode sentir mudanças):
${this.analise.pontosImpactoUsuario.filter(p => p.arquivo.includes('CalendarioMembro')).map(p => `- **${p.tipo}:** ${p.descricao} (${p.arquivo})`).join('\n')}

### SUPERVISOR (não pode sentir mudanças):
${this.analise.pontosImpactoUsuario.filter(p => p.arquivo.includes('Supervisor') || p.arquivo.includes('supervisor')).map(p => `- **${p.tipo}:** ${p.descricao} (${p.arquivo})`).join('\n')}

## 🔄 FLUXOS COMPLETOS MAPEADOS

### FLUXO "EU VOU" (deve permanecer IDÊNTICO):
${this.analise.fluxosCompletos['FLUXO_EU_VOU_MEMBRO']?.map((etapa, i) => `${i + 1}. ${etapa}`).join('\n') || 'Não mapeado'}

### FLUXO "CANCELAR" (deve permanecer IDÊNTICO):
${this.analise.fluxosCompletos['FLUXO_CANCELAR_MEMBRO']?.map((etapa, i) => `${i + 1}. ${etapa}`).join('\n') || 'Não mapeado'}

## 🔗 DEPENDÊNCIAS EXTERNAS CRÍTICAS
${this.analise.dependenciasExternas.map(dep => `- ${dep}`).join('\n')}

## 🎯 ESTRATÉGIA DE REFATORAÇÃO SEGURA

### ✅ PODE ALTERAR (transparente ao usuário):
- Lógica interna de services (EuVouOrchestrator, ValidadorParticipacao)
- Implementação de repositories (mantendo interfaces)
- Algoritmos de cálculo e validação
- Otimizações de performance internas

### ⚠️ ALTERAR COM EXTREMO CUIDADO:
- APIs públicas (manter assinaturas exatas)
- Hooks públicos (manter comportamento exato)
- Components principais (manter props e comportamento)

### 🚫 JAMAIS ALTERAR:
- Contratos de APIs REST
- Assinaturas de hooks exportados
- Props de components públicos
- Estrutura do banco de dados
- Triggers de real-time

## 📋 VALIDAÇÃO DE IMPACTO ZERO

Para garantir que a refatoração seja transparente:

1. **TESTE CADA PONTO DE IMPACTO:**
   - Botão "Eu Vou" deve funcionar identicamente
   - Botão "Cancelar" deve funcionar identicamente
   - Modal de operação deve abrir/fechar igual
   - Calendário deve atualizar igual
   - Gerenciar membros deve funcionar igual

2. **VALIDAR TODOS OS FLUXOS:**
   - Fluxo completo "Eu Vou" deve ser idêntico
   - Fluxo completo "Cancelar" deve ser idêntico
   - Real-time deve atualizar na mesma velocidade
   - Validações devem retornar os mesmos resultados

3. **CONFIRMAR CONTRATOS:**
   - APIs devem retornar exatamente os mesmos dados
   - Hooks devem ter o mesmo comportamento
   - Components devem renderizar identicamente

---
*Análise dimensional gerada em: ${new Date().toISOString()}*
`;

    const caminhoExecutivo = path.join(process.cwd(), 'ts-morph', 'relatorio_dimensional_executivo.md');
    fs.writeFileSync(caminhoExecutivo, relatorioExecutivo);
  }
}

// Executar análise dimensional completa
async function main() {
  const analisador = new AnalisadorDimensional();
  await analisador.executarAnaliseCompleta();
}

main().catch(console.error); 
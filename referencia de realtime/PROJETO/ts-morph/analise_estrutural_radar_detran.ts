import { Project, SourceFile } from "ts-morph";
import { writeFileSync } from "fs";
import { join } from "path";

interface AnaliseSimples {
  resumoExecutivo: {
    totalArquivos: number;
    problemasIdentificados: string[];
    oportunidadesRefatoracao: string[];
    complexidadeGeral: string;
  };
  arquivos: {
    apis: string[];
    componentes: string[];
    hooks: string[];
    utils: string[];
    tipos: string[];
  };
  problemas: {
    apisComplexas: string[];
    componentesGrandes: string[];
    hooksComplexos: string[];
    duplicacoes: string[];
  };
  recomendacoes: string[];
}

class AnalisadorEstruturalSimples {
  private project: Project;

  constructor() {
    this.project = new Project({
      useInMemoryFileSystem: false,
    });
  }

  public async analisar(): Promise<AnaliseSimples> {
    console.log("🔍 Iniciando análise estrutural do projeto radar-detran...");
    
    // Carregar arquivos do projeto
    this.project.addSourceFilesAtPaths("../radar-detran/src/**/*.{ts,tsx}");
    const sourceFiles = this.project.getSourceFiles();
    
    console.log(`📁 Encontrados ${sourceFiles.length} arquivos para análise`);
    
    const resultado: AnaliseSimples = {
      resumoExecutivo: {
        totalArquivos: sourceFiles.length,
        problemasIdentificados: [],
        oportunidadesRefatoracao: [],
        complexidadeGeral: "Média"
      },
      arquivos: {
        apis: [],
        componentes: [],
        hooks: [],
        utils: [],
        tipos: []
      },
      problemas: {
        apisComplexas: [],
        componentesGrandes: [],
        hooksComplexos: [],
        duplicacoes: []
      },
      recomendacoes: []
    };

    // Analisar cada arquivo
    for (const sourceFile of sourceFiles) {
      this.analisarArquivo(sourceFile, resultado);
    }

    // Adicionar problemas identificados
    this.identificarProblemas(resultado);
    
    // Gerar recomendações
    this.gerarRecomendacoes(resultado);
    
    // Determinar complexidade geral
    this.determinarComplexidade(resultado);

    console.log("✅ Análise estrutural concluída!");
    return resultado;
  }

  private analisarArquivo(sourceFile: SourceFile, resultado: AnaliseSimples): void {
    const filePath = sourceFile.getFilePath();
    const fileName = sourceFile.getBaseName();
    
    // Classificar tipo de arquivo
    if (filePath.includes('/api/')) {
      resultado.arquivos.apis.push(fileName);
      this.analisarAPI(sourceFile, resultado);
    } else if (fileName.endsWith('.tsx') && !fileName.includes('page.tsx')) {
      resultado.arquivos.componentes.push(fileName);
      this.analisarComponente(sourceFile, resultado);
    } else if (fileName.startsWith('use') && fileName.endsWith('.ts')) {
      resultado.arquivos.hooks.push(fileName);
      this.analisarHook(sourceFile, resultado);
    } else if (filePath.includes('/utils/') || filePath.includes('/lib/')) {
      resultado.arquivos.utils.push(fileName);
    } else if (filePath.includes('/types/') || fileName.includes('types')) {
      resultado.arquivos.tipos.push(fileName);
    }
  }

  private analisarAPI(sourceFile: SourceFile, resultado: AnaliseSimples): void {
    const text = sourceFile.getText();
    const lines = text.split('\n').length;
    
    // API muito grande
    if (lines > 100) {
      resultado.problemas.apisComplexas.push(sourceFile.getBaseName());
    }
    
    // Muitos métodos HTTP
    const httpMethods = (text.match(/\.(GET|POST|PUT|DELETE|PATCH)/g) || []).length;
    if (httpMethods > 5) {
      resultado.problemas.apisComplexas.push(`${sourceFile.getBaseName()} - ${httpMethods} métodos HTTP`);
    }
  }

  private analisarComponente(sourceFile: SourceFile, resultado: AnaliseSimples): void {
    const text = sourceFile.getText();
    const lines = text.split('\n').length;
    
    // Componente muito grande
    if (lines > 200) {
      resultado.problemas.componentesGrandes.push(sourceFile.getBaseName());
    }
    
    // Muitos useState
    const useStateCount = (text.match(/useState/g) || []).length;
    if (useStateCount > 5) {
      resultado.problemas.componentesGrandes.push(`${sourceFile.getBaseName()} - ${useStateCount} estados`);
    }
    
    // Muitos useEffect
    const useEffectCount = (text.match(/useEffect/g) || []).length;
    if (useEffectCount > 3) {
      resultado.problemas.componentesGrandes.push(`${sourceFile.getBaseName()} - ${useEffectCount} efeitos`);
    }
  }

  private analisarHook(sourceFile: SourceFile, resultado: AnaliseSimples): void {
    const text = sourceFile.getText();
    const lines = text.split('\n').length;
    
    // Hook muito complexo
    if (lines > 50) {
      resultado.problemas.hooksComplexos.push(sourceFile.getBaseName());
    }
    
    // Muitas dependências
    const dependencies = (text.match(/\[.*\]/g) || []).length;
    if (dependencies > 3) {
      resultado.problemas.hooksComplexos.push(`${sourceFile.getBaseName()} - ${dependencies} dependências`);
    }
  }

  private identificarProblemas(resultado: AnaliseSimples): void {
    // Adicionar problemas baseados nos achados
    if (resultado.problemas.apisComplexas.length > 0) {
      resultado.resumoExecutivo.problemasIdentificados.push("APIs muito complexas ou grandes");
    }
    
    if (resultado.problemas.componentesGrandes.length > 0) {
      resultado.resumoExecutivo.problemasIdentificados.push("Componentes muito grandes ou com muitos estados");
    }
    
    if (resultado.problemas.hooksComplexos.length > 0) {
      resultado.resumoExecutivo.problemasIdentificados.push("Hooks muito complexos");
    }
    
    // Verificar duplicação potencial
    if (resultado.arquivos.apis.length > 20) {
      resultado.resumoExecutivo.problemasIdentificados.push("Muitas APIs - possível duplicação de lógica");
    }
    
    if (resultado.arquivos.componentes.length > 30) {
      resultado.resumoExecutivo.problemasIdentificados.push("Muitos componentes - possível necessidade de abstração");
    }
  }

  private gerarRecomendacoes(resultado: AnaliseSimples): void {
    resultado.recomendacoes.push("🏗️ Implementar arquitetura limpa com separação clara de responsabilidades");
    resultado.recomendacoes.push("📦 Consolidar lógica de negócio em services especializados");
    resultado.recomendacoes.push("🔄 Centralizar operações de banco em repositories");
    resultado.recomendacoes.push("✅ Implementar validação centralizada com schemas");
    resultado.recomendacoes.push("🚀 Otimizar real-time com queries mais eficientes");
    resultado.recomendacoes.push("🎯 Simplificar componentes com composition patterns");
    resultado.recomendacoes.push("📊 Implementar logging e monitoramento centralizado");
    resultado.recomendacoes.push("🔐 Fortalecer validações de permissão");
    
    if (resultado.problemas.apisComplexas.length > 0) {
      resultado.resumoExecutivo.oportunidadesRefatoracao.push("Dividir APIs complexas em microservices");
    }
    
    if (resultado.problemas.componentesGrandes.length > 0) {
      resultado.resumoExecutivo.oportunidadesRefatoracao.push("Quebrar componentes grandes em subcomponentes");
    }
    
    if (resultado.problemas.hooksComplexos.length > 0) {
      resultado.resumoExecutivo.oportunidadesRefatoracao.push("Simplificar hooks complexos");
    }
  }

  private determinarComplexidade(resultado: AnaliseSimples): void {
    const totalProblemas = 
      resultado.problemas.apisComplexas.length + 
      resultado.problemas.componentesGrandes.length + 
      resultado.problemas.hooksComplexos.length;
    
    if (totalProblemas > 15) {
      resultado.resumoExecutivo.complexidadeGeral = "Crítica";
    } else if (totalProblemas > 10) {
      resultado.resumoExecutivo.complexidadeGeral = "Alta";
    } else if (totalProblemas > 5) {
      resultado.resumoExecutivo.complexidadeGeral = "Média";
    } else {
      resultado.resumoExecutivo.complexidadeGeral = "Baixa";
    }
  }

  public salvarResultado(resultado: AnaliseSimples): void {
    const caminhoRelatorio = join(process.cwd(), "analise_dimensional_completa.json");
    writeFileSync(caminhoRelatorio, JSON.stringify(resultado, null, 2), 'utf-8');
    console.log(`📄 Relatório salvo em: ${caminhoRelatorio}`);
  }
}

// Executar análise
async function executarAnalise() {
  try {
    const analisador = new AnalisadorEstruturalSimples();
    const resultado = await analisador.analisar();
    analisador.salvarResultado(resultado);
    
    console.log("\n📊 RESUMO EXECUTIVO:");
    console.log(`Total de arquivos: ${resultado.resumoExecutivo.totalArquivos}`);
    console.log(`Complexidade: ${resultado.resumoExecutivo.complexidadeGeral}`);
    console.log(`Problemas identificados: ${resultado.resumoExecutivo.problemasIdentificados.length}`);
    console.log(`Oportunidades de refatoração: ${resultado.resumoExecutivo.oportunidadesRefatoracao.length}`);
    
  } catch (error) {
    console.error("❌ Erro durante análise:", error);
  }
}

// Auto-executar se for o arquivo principal
if (require.main === module) {
  executarAnalise();
}

export { AnalisadorEstruturalSimples, executarAnalise }; 
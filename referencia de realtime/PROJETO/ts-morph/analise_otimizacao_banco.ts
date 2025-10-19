import { Project } from 'ts-morph';
import { writeFileSync } from 'fs';

interface QueryAnalysis {
  filePath: string;
  queries: {
    type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'RPC';
    query: string;
    tablesInvolved: string[];
    frequency: 'HIGH' | 'MEDIUM' | 'LOW';
    context: string;
    lineNumber: number;
    performance: {
      hasIndexes: boolean;
      needsOptimization: boolean;
      recommendations: string[];
    };
  }[];
}

interface DatabaseOptimizationAnalysis {
  apiEndpoints: QueryAnalysis[];
  recommendedIndexes: {
    table: string;
    columns: string[];
    type: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
    reason: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
  queryOptimizations: {
    currentQuery: string;
    optimizedQuery: string;
    improvement: string;
    impact: string;
  }[];
  tableAnalysis: {
    table: string;
    issues: string[];
    solutions: string[];
  }[];
}

const project = new Project({
  tsConfigFilePath: './tsconfig.json',
});

function analyzeApiQueries(): QueryAnalysis[] {
  const results: QueryAnalysis[] = [];
  
  // APIs unificadas para analisar
  const apiFiles = [
    'src/app/api/operations/route.ts',
    'src/app/api/participations/route.ts', 
    'src/app/api/supervisor-actions/route.ts',
    'src/app/api/admin/route.ts',
    'src/app/api/real-time/route.ts'
  ];

  apiFiles.forEach(filePath => {
    try {
      const sourceFile = project.getSourceFile(filePath);
      if (!sourceFile) {
        console.log(`❌ Arquivo não encontrado: ${filePath}`);
        return;
      }

      console.log(`🔍 Analisando: ${filePath}`);
      
      const queries: QueryAnalysis['queries'] = [];
      
      // Buscar por queries SQL
      sourceFile.getDescendantsOfKind(189).forEach(node => { // StringLiteral
        const text = node.getLiteralValue();
        if (typeof text === 'string' && 
            (text.toLowerCase().includes('select') || 
             text.toLowerCase().includes('insert') ||
             text.toLowerCase().includes('update') ||
             text.toLowerCase().includes('delete') ||
             text.toLowerCase().includes('from') ||
             text.toLowerCase().includes('rpc'))) {
          
          const lineNumber = node.getStartLineNumber();
          const context = getQueryContext(node);
          
          queries.push({
            type: determineQueryType(text),
            query: text.trim(),
            tablesInvolved: extractTables(text),
            frequency: determineFrequency(context, text),
            context,
            lineNumber,
            performance: analyzePerformance(text)
          });
        }
      });

      // Buscar por chamadas do Supabase
      sourceFile.getDescendantsOfKind(203).forEach(node => { // CallExpression
        const expression = node.getExpression();
        if (expression.getText().includes('supabase') || 
            expression.getText().includes('from') ||
            expression.getText().includes('select') ||
            expression.getText().includes('insert') ||
            expression.getText().includes('update') ||
            expression.getText().includes('delete')) {
          
          const lineNumber = node.getStartLineNumber();
          const context = getQueryContext(node);
          const queryText = node.getText();
          
          queries.push({
            type: determineQueryTypeFromCall(queryText),
            query: queryText,
            tablesInvolved: extractTablesFromCall(queryText),
            frequency: determineFrequency(context, queryText),
            context,
            lineNumber,
            performance: analyzePerformance(queryText)
          });
        }
      });

      results.push({
        filePath,
        queries: queries.filter((q, index, self) => 
          index === self.findIndex(query => query.query === q.query)
        )
      });

    } catch (error) {
      console.log(`❌ Erro ao analisar ${filePath}:`, error);
    }
  });

  return results;
}

function getQueryContext(node: any): string {
  const parent = node.getParent();
  if (parent) {
    const functionName = parent.getFirstAncestorByKind(256)?.getName(); // FunctionDeclaration
    const methodName = parent.getFirstAncestorByKind(173)?.getName(); // MethodDeclaration
    return functionName || methodName || 'unknown';
  }
  return 'global';
}

function determineQueryType(query: string): QueryAnalysis['queries'][0]['type'] {
  const lower = query.toLowerCase();
  if (lower.includes('select')) return 'SELECT';
  if (lower.includes('insert')) return 'INSERT';
  if (lower.includes('update')) return 'UPDATE';
  if (lower.includes('delete')) return 'DELETE';
  if (lower.includes('rpc')) return 'RPC';
  return 'SELECT';
}

function determineQueryTypeFromCall(call: string): QueryAnalysis['queries'][0]['type'] {
  const lower = call.toLowerCase();
  if (lower.includes('.select(')) return 'SELECT';
  if (lower.includes('.insert(')) return 'INSERT';
  if (lower.includes('.update(')) return 'UPDATE';
  if (lower.includes('.delete(')) return 'DELETE';
  if (lower.includes('.rpc(')) return 'RPC';
  return 'SELECT';
}

function extractTables(query: string): string[] {
  const tables: string[] = [];
  const patterns = [
    /from\s+(\w+)/gi,
    /join\s+(\w+)/gi,
    /update\s+(\w+)/gi,
    /insert\s+into\s+(\w+)/gi,
    /delete\s+from\s+(\w+)/gi
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(query)) !== null) {
      tables.push(match[1]);
    }
  });

  return [...new Set(tables)];
}

function extractTablesFromCall(call: string): string[] {
  const tables: string[] = [];
  
  // Extrair de .from('table')
  const fromMatch = call.match(/\.from\(['"`](\w+)['"`]\)/g);
  if (fromMatch) {
    fromMatch.forEach(match => {
      const table = match.match(/['"`](\w+)['"`]/)?.[1];
      if (table) tables.push(table);
    });
  }

  // Extrair de supabase.from('table')
  const supabaseMatch = call.match(/supabase\.from\(['"`](\w+)['"`]\)/g);
  if (supabaseMatch) {
    supabaseMatch.forEach(match => {
      const table = match.match(/['"`](\w+)['"`]/)?.[1];
      if (table) tables.push(table);
    });
  }

  return [...new Set(tables)];
}

function determineFrequency(context: string, query: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  // Análise heurística baseada no contexto
  const highFrequencyContexts = ['GET', 'realtime', 'timeline', 'polling'];
  const highFrequencyQueries = ['operacoes', 'participacoes', 'servidor'];
  
  const isHighContext = highFrequencyContexts.some(ctx => 
    context.toLowerCase().includes(ctx.toLowerCase())
  );
  const isHighQuery = highFrequencyQueries.some(q => 
    query.toLowerCase().includes(q.toLowerCase())
  );

  if (isHighContext || isHighQuery) return 'HIGH';
  if (context.toLowerCase().includes('post') || context.toLowerCase().includes('put')) return 'MEDIUM';
  return 'LOW';
}

function analyzePerformance(query: string): QueryAnalysis['queries'][0]['performance'] {
  const lower = query.toLowerCase();
  const recommendations: string[] = [];
  let needsOptimization = false;

  // Verificar se há JOINs sem índices aparentes
  if (lower.includes('join') && !lower.includes('indexed')) {
    recommendations.push('Adicionar índices para JOINs');
    needsOptimization = true;
  }

  // Verificar ORDER BY sem LIMIT
  if (lower.includes('order by') && !lower.includes('limit')) {
    recommendations.push('Considerar LIMIT em ORDER BY');
    needsOptimization = true;
  }

  // Verificar WHERE sem índices potenciais
  if (lower.includes('where') && 
      (lower.includes('like %') || lower.includes('ilike %'))) {
    recommendations.push('Evitar LIKE com wildcard inicial ou usar índice GIN');
    needsOptimization = true;
  }

  // Verificar agregações sem índices
  if (lower.includes('count(') || lower.includes('sum(') || lower.includes('avg(')) {
    recommendations.push('Verificar índices para agregações');
    needsOptimization = true;
  }

  return {
    hasIndexes: false, // Precisa verificar manualmente
    needsOptimization,
    recommendations
  };
}

function generateRecommendations(analyses: QueryAnalysis[]): DatabaseOptimizationAnalysis {
  const recommendedIndexes: DatabaseOptimizationAnalysis['recommendedIndexes'] = [];
  const queryOptimizations: DatabaseOptimizationAnalysis['queryOptimizations'] = [];
  const tableAnalysis: DatabaseOptimizationAnalysis['tableAnalysis'] = [];
  
  // Analisar todas as queries para gerar recomendações
  const tableUsage: Map<string, number> = new Map();
  const whereColumns: Map<string, string[]> = new Map();
  
  analyses.forEach(analysis => {
    analysis.queries.forEach(query => {
      query.tablesInvolved.forEach(table => {
        tableUsage.set(table, (tableUsage.get(table) || 0) + 1);
      });

      // Analisar colunas usadas em WHERE
      const whereMatch = query.query.match(/where\s+(\w+)\s*[=<>]/gi);
      if (whereMatch) {
        whereMatch.forEach(match => {
          const column = match.split(/\s+/)[1];
          query.tablesInvolved.forEach(table => {
            if (!whereColumns.has(table)) whereColumns.set(table, []);
            whereColumns.get(table)!.push(column);
          });
        });
      }
    });
  });

  // Gerar recomendações de índices baseadas no uso
  tableUsage.forEach((usage, table) => {
    if (usage >= 3) { // Tabelas usadas frequentemente
      const columns = whereColumns.get(table) || [];
      const uniqueColumns = [...new Set(columns)];
      
      if (uniqueColumns.length > 0) {
        recommendedIndexes.push({
          table,
          columns: uniqueColumns,
          type: 'BTREE',
          reason: `Tabela ${table} usada ${usage} vezes com filtros em ${uniqueColumns.join(', ')}`,
          priority: usage >= 5 ? 'HIGH' : 'MEDIUM'
        });
      }
    }
  });

  // Recomendações específicas para as APIs unificadas
  recommendedIndexes.push(
    {
      table: 'operacoes',
      columns: ['regional_id', 'data_operacao', 'status'],
      type: 'BTREE',
      reason: 'Filtros frequentes em operações por regional e data',
      priority: 'HIGH'
    },
    {
      table: 'participacoes_operacao',
      columns: ['operacao_id', 'servidor_id', 'status'],
      type: 'BTREE',
      reason: 'JOINs frequentes entre operações e participações',
      priority: 'HIGH'
    },
    {
      table: 'servidores',
      columns: ['regional_id', 'ativo', 'ciclo_funcional'],
      type: 'BTREE',
      reason: 'Filtros por regional e status ativo',
      priority: 'MEDIUM'
    },
    {
      table: 'operacoes',
      columns: ['data_operacao'],
      type: 'BTREE',
      reason: 'Ordenação cronológica frequente',
      priority: 'MEDIUM'
    }
  );

  return {
    apiEndpoints: analyses,
    recommendedIndexes,
    queryOptimizations,
    tableAnalysis
  };
}

// Executar análise
console.log('🚀 Iniciando análise de otimização do banco de dados...');

const queryAnalyses = analyzeApiQueries();
const optimization = generateRecommendations(queryAnalyses);

// Salvar resultados
writeFileSync(
  'ts-morph/analise_otimizacao_banco.json',
  JSON.stringify(optimization, null, 2)
);

console.log('✅ Análise concluída!');
console.log(`📊 ${queryAnalyses.length} APIs analisadas`);
console.log(`🔍 ${optimization.recommendedIndexes.length} índices recomendados`);
console.log(`📈 Arquivo salvo: ts-morph/analise_otimizacao_banco.json`);

export { optimization }; 
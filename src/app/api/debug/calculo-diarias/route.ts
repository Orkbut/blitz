import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

interface DiagnosticoDiarias {
  metodoAtual: {
    nome: string;
    contagem: number;
    detalhes: string;
  };
  metodoCorreto: {
    nome: string;
    contagem: number;
    detalhes: string;
  };
  diferencaEncontrada: boolean;
  participacoes: Array<{
    id: number;
    data_participacao: string;
    tipo_participacao: string;
    operacao_id: number;
    valor_esperado: number;
    modalidade: string;
  }>;
  resumo: {
    total_participacoes: number;
    diarias_completas: number;
    meias_diarias: number;
    contagem_atual_incorreta: number;
    contagem_correta: number;
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const membroId = searchParams.get('membro_id');
    const mes = searchParams.get('mes') || new Date().getMonth() + 1;
    const ano = searchParams.get('ano') || new Date().getFullYear();

    if (!membroId) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetro membro_id é obrigatório'
      }, { status: 400 });
    }

  
    console.log('=========================================');
    console.log(`Membro ID: ${membroId}`);
    console.log(`Período: ${mes}/${ano}`);
    console.log('');

    // 1. MÉTODO ATUAL (INCORRETO) - Simular contagem por COUNT
    console.log('📊 MÉTODO ATUAL (INCORRETO):');
    console.log('----------------------------');
    
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFim = new Date(Number(ano), Number(mes), 0);
    const dataFimStr = `${ano}-${mes.toString().padStart(2, '0')}-${dataFim.getDate().toString().padStart(2, '0')}`;

    const { count: contagemAtual, error: erroCount } = await supabase
      .from('participacao')
      .select('*', { count: 'exact', head: true })
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .eq('estado_visual', 'CONFIRMADO')
      .gte('data_participacao', dataInicio)
      .lte('data_participacao', dataFimStr);

    if (erroCount) {
      console.error('❌ Erro no método atual:', erroCount);
      throw erroCount;
    }

    console.log(`Contagem atual (COUNT): ${contagemAtual}`);
    console.log('❌ PROBLEMA: Este método conta cada participação como 1 diária, ignorando tipo_participacao');
    console.log('');

    // 2. BUSCAR DADOS DETALHADOS PARA MÉTODO CORRETO
    console.log('📊 MÉTODO CORRETO:');
    console.log('------------------');
    
    const { data: participacoes, error: erroData } = await supabase
      .from('participacao')
      .select(`
        id,
        data_participacao,
        tipo_participacao,
        operacao_id,
        valor_diaria,
        operacao!inner(
          id,
          modalidade,
          tipo
        )
      `)
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .eq('estado_visual', 'CONFIRMADO')
      .gte('data_participacao', dataInicio)
      .lte('data_participacao', dataFimStr);

    if (erroData) {
      console.error('❌ Erro ao buscar dados detalhados:', erroData);
      throw erroData;
    }

    const participacoesDetalhadas = participacoes || [];

    // 3. CALCULAR CORRETAMENTE
    let totalDiarias = 0;
    let diariasCompletas = 0;
    let meiasDiarias = 0;

    console.log('Participações encontradas:');
    participacoesDetalhadas.forEach((p, index) => {
      const operacao = p.operacao as any;
      const valorEsperado = p.tipo_participacao === 'DIARIA_COMPLETA' ? 1.0 : 0.5;
      
      console.log(`  ${index + 1}. Data: ${p.data_participacao} | Tipo: ${p.tipo_participacao} | Valor: ${valorEsperado} | Modalidade: ${operacao.modalidade}`);
      
      if (p.tipo_participacao === 'DIARIA_COMPLETA') {
        totalDiarias += 1;
        diariasCompletas += 1;
      } else {
        totalDiarias += 0.5;
        meiasDiarias += 1;
      }
    });

    console.log('');
    console.log('TOTAIS:');
    console.log(`  Diárias completas: ${diariasCompletas}`);
    console.log(`  Meias diárias: ${meiasDiarias}`);
    console.log(`  Contagem correta: ${totalDiarias} diárias`);
    console.log(`  Contagem atual (incorreta): ${contagemAtual} diárias`);
    console.log('');

    const diferencaEncontrada = totalDiarias !== (contagemAtual || 0);
    
    if (diferencaEncontrada) {
      console.log('🚨 PROBLEMA IDENTIFICADO:');
      console.log('========================');
      console.log(`A contagem atual (${contagemAtual}) não corresponde ao valor correto (${totalDiarias})`);
      console.log('');
      console.log('💡 EXPLICAÇÃO:');
      console.log('- Cada operação de 8 horas deveria contar como 0.5 diárias');
      console.log('- Operações completas (16 horas) contam como 1.0 diárias');
      console.log('- A regra é: 2 meias-diárias = 1 diária completa para limite mensal');
      console.log('');
      console.log('🔧 CORREÇÃO NECESSÁRIA:');
      console.log('- Método contarDiariasNoMes deve somar baseado no tipo_participacao');
      console.log('- Não apenas fazer COUNT(*) das participações');
    } else {
      console.log('✅ CONTAGEM CORRETA: Os métodos estão alinhados');
    }

    const diagnostico: DiagnosticoDiarias = {
      metodoAtual: {
        nome: 'COUNT(*) simples',
        contagem: contagemAtual || 0,
        detalhes: 'Conta cada participação como 1 diária, ignorando tipo_participacao'
      },
      metodoCorreto: {
        nome: 'Soma baseada em tipo_participacao',
        contagem: totalDiarias,
        detalhes: 'DIARIA_COMPLETA = 1.0, MEIA_DIARIA = 0.5'
      },
      diferencaEncontrada,
      participacoes: participacoesDetalhadas.map(p => ({
        id: p.id,
        data_participacao: p.data_participacao,
        tipo_participacao: p.tipo_participacao,
        operacao_id: p.operacao_id,
        valor_esperado: p.tipo_participacao === 'DIARIA_COMPLETA' ? 1.0 : 0.5,
        modalidade: (p.operacao as any).modalidade
      })),
      resumo: {
        total_participacoes: participacoesDetalhadas.length,
        diarias_completas: diariasCompletas,
        meias_diarias: meiasDiarias,
        contagem_atual_incorreta: contagemAtual || 0,
        contagem_correta: totalDiarias
      }
    };

    return NextResponse.json({
      success: true,
      diagnostico,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro no diagnóstico:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Método POST para testar correção
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const membroId = searchParams.get('membro_id');
    const mes = searchParams.get('mes') || new Date().getMonth() + 1;
    const ano = searchParams.get('ano') || new Date().getFullYear();

    if (!membroId) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetro membro_id é obrigatório'
      }, { status: 400 });
    }

    console.log('🔧 TESTE DE CORREÇÃO - INSTRUMENTAÇÃO');
    console.log('=====================================');
    console.log(`Membro ID: ${membroId}`);
    console.log(`Período: ${mes}/${ano}`);
    console.log('');

    // Testar método corrigido
    const dataInicio = `${ano}-${mes.toString().padStart(2, '0')}-01`;
    const dataFim = new Date(Number(ano), Number(mes), 0);
    const dataFimStr = `${ano}-${mes.toString().padStart(2, '0')}-${dataFim.getDate().toString().padStart(2, '0')}`;

    const { data: participacoes, error } = await supabase
      .from('participacao')
      .select('tipo_participacao')
      .eq('membro_id', membroId)
      .eq('ativa', true)
      .eq('estado_visual', 'CONFIRMADO')
      .gte('data_participacao', dataInicio)
      .lte('data_participacao', dataFimStr);

    if (error) {
      throw error;
    }

    // Calcular usando método correto
    let totalDiarias = 0;
    let diariasCompletas = 0;
    let meiasDiarias = 0;

    (participacoes || []).forEach(p => {
      if (p.tipo_participacao === 'DIARIA_COMPLETA') {
        totalDiarias += 1;
        diariasCompletas += 1;
      } else {
        totalDiarias += 0.5;
        meiasDiarias += 1;
      }
    });

    console.log('MÉTODO CORRIGIDO:');
    console.log(`  Diárias completas: ${diariasCompletas}`);
    console.log(`  Meias diárias: ${meiasDiarias}`);
    console.log(`  Total correto: ${totalDiarias} diárias`);
    console.log('');

    return NextResponse.json({
      success: true,
      metodoCorrigido: {
        total_participacoes: participacoes?.length || 0,
        diarias_completas: diariasCompletas,
        meias_diarias: meiasDiarias,
        total_diarias_correto: totalDiarias
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro no teste de correção:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
} 
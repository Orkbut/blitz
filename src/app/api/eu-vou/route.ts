/**
 * API DE "EU VOU" DOS MEMBROS
 * 
 * 🔑 REGRAS FUNDAMENTAIS:
 * - O banco de dados é a fonte absoluta da verdade
 * - Todas as validações devem consultar dados frescos do banco
 * - Não pode haver inconsistências entre validação e dados reais
 * 
 * 📋 REGRAS DE NEGÓCIO:
 * - O supervisor pode exceder o limite de participantes que ele mesmo definiu
 * - Existe exceção no banco de dados que permite ao supervisor adicionar mais participantes
 * - Esta exceção é uma regra de negócio válida e intencional
 * - As validações de limite se aplicam principalmente a participações normais dos membros
 */

import { NextRequest, NextResponse } from 'next/server';
import { EuVouOrchestrator } from '@/core/domain/services/EuVouOrchestrator';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  console.log(`[TEMP-LOG-API-EU-VOU] 🚀 INÍCIO CHAMADA API EU-VOU`);
  
  try {
    // 1. ✅ PARSEAR DADOS DA REQUISIÇÃO
    const { membroId, operacaoId } = await request.json();
    console.log(`[TEMP-LOG-API-EU-VOU] 📋 Dados recebidos - Membro: ${membroId} | Operação: ${operacaoId}`);

    if (!membroId || !operacaoId) {
      console.log(`[TEMP-LOG-API-EU-VOU] ❌ Dados inválidos - faltando parâmetros`);
      return NextResponse.json(
        { erro: 'Membro ID e Operação ID são obrigatórios' },
        { status: 400 }
      );
    }

    // 1.5. ✅ VERIFICAR SE OPERAÇÃO ESTÁ INATIVA PELO SUPERVISOR
    console.log(`[TEMP-LOG-API-EU-VOU] 🔍 Verificando se operação ${operacaoId} está inativa...`);
    const { data: operacaoStatus } = await supabase
      .from('operacao')
      .select('inativa_pelo_supervisor')
      .eq('id', operacaoId)
      .single();

    if (operacaoStatus?.inativa_pelo_supervisor) {
      console.log(`[TEMP-LOG-API-EU-VOU] 📁 Operação ${operacaoId} está inativa pelo supervisor`);
      return NextResponse.json({
        sucesso: false,
        mensagem: 'Esta operação está no histórico e não aceita mais solicitações',
        tipo: 'OPERACAO_INATIVA'
      }, { status: 403 });
    }

    // 2. ✅ INSTANCIAR ORCHESTRATOR E EXECUTAR (usa validação para SOLICITAÇÃO)
    console.log(`[TEMP-LOG-API-EU-VOU] 🔍 EXECUTANDO ORCHESTRATOR...`);
    const orchestrator = new EuVouOrchestrator();
    const resultado = await orchestrator.executar(membroId, operacaoId);
    


    // 3. ✅ PROCESSAR RESULTADO E RETORNAR
    if (resultado.sucesso) {
      console.log(`[TEMP-LOG-API-EU-VOU] ✅ SUCESSO - ${resultado.mensagem}`);
      return NextResponse.json({
        sucesso: true,
        mensagem: resultado.mensagem,
        dados: resultado.dados || {}
      });
    } else {
      console.log(`[TEMP-LOG-API-EU-VOU] ❌ FALHA - ${resultado.mensagem}`);
      return NextResponse.json({
        sucesso: false,
        mensagem: resultado.mensagem,
        detalhes: resultado.detalhes || []
      }, { status: 400 });
    }

  } catch (error) {
    console.error(`[TEMP-LOG-API-EU-VOU] 💥 ERRO GERAL NA API:`, error);
    
    // ✅ TRATAR ERROS ESPECÍFICOS
    if (error instanceof Error) {
      if (error.message.includes('BLOQUEADO_DIRETORIA:')) {
        return NextResponse.json({
          sucesso: false,
          mensagem: error.message.replace('BLOQUEADO_DIRETORIA: ', ''),
          tipo: 'BLOQUEIO_DIRETORIA'
        }, { status: 403 });
      }
      
      if (error.message.includes('CONCURRENCY_ERROR:')) {
        return NextResponse.json({
          sucesso: false,
          mensagem: 'Muitas pessoas tentando ao mesmo tempo. Tente novamente em alguns segundos.',
          tipo: 'CONCORRENCIA'
        }, { status: 409 });
      }
    }

    return NextResponse.json({
      sucesso: false,
      mensagem: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// 🔍 VALIDAÇÃO PRÉVIA - Verificar se pode participar antes do comando
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const membroId = searchParams.get('membro_id');
    const operacaoId = searchParams.get('operacao_id');

    if (!membroId || !operacaoId) {
      return NextResponse.json({
        success: false,
        error: 'Parâmetros obrigatórios não fornecidos',
        required: ['membro_id', 'operacao_id']
      }, { status: 400 });
    }

    // 🎯 USAR EuVouOrchestrator DO DOMÍNIO
    const orchestrator = new EuVouOrchestrator();
    const podeParticipar = await orchestrator.verificarDisponibilidade(
      Number(membroId), 
      Number(operacaoId)
    );

    return NextResponse.json({
      success: true,
      data: {
        podeParticipar,
        membroId: Number(membroId),
        operacaoId: Number(operacaoId)
      },
      boundedContext: 'agendamento',
      orchestrator: 'EuVouOrchestrator'
    });

  } catch (error) {
    console.error('❌ Erro na validação EU VOU:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido',
      boundedContext: 'agendamento'
    }, { status: 500 });
  }
} 
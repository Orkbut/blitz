import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, nome, email, senha, regionalId, perfil, justificativa } = body;

    // Validações básicas
    if (!matricula || !nome || !senha || !regionalId) {
      return NextResponse.json({
        success: false,
        error: 'Matrícula, nome, senha e regional são obrigatórios',
        campo: !matricula ? 'matricula' : !nome ? 'nome' : !senha ? 'senha' : 'regional'
      }, { status: 400 });
    }

    // ✅ NOVO: DETECTAR SE É CADASTRO DE SUPERVISOR
    const isSupervisor = perfil === 'Supervisor';

    if (isSupervisor) {
      // ✅ SUPERVISOR: Criar solicitação para aprovação admin
      return await criarSolicitacaoSupervisor({
        matricula: matricula.trim(),
        nome: nome.trim(),
        email: email?.trim() || null,
        senha,
        regionalId,
        justificativa: justificativa?.trim() || ''
      });
    }

    // ✅ MEMBRO: Fluxo normal (sem mudanças)
    return await criarContaMembro({
      matricula: matricula.trim(),
      nome: nome.trim(),
      email: email?.trim() || null,
      senha,
      regionalId
    });

  } catch (error) {
    console.error('❌ Erro no cadastro de servidor:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// ✅ NOVA FUNÇÃO: Criar solicitação de supervisor
async function criarSolicitacaoSupervisor(dados: any) {
  const { matricula, nome, email, senha, regionalId, justificativa } = dados;

  // Verificar se já existe solicitação pendente para esta matrícula
  const { data: solicitacaoExistente } = await supabase
    .from('solicitacao_supervisor')
    .select('id, status')
    .eq('matricula', matricula)
    .eq('status', 'PENDENTE')
    .single();

  if (solicitacaoExistente) {
    return NextResponse.json({
      success: false,
      error: 'Já existe uma solicitação pendente para esta matrícula',
      campo: 'matricula'
    }, { status: 400 });
  }

  // Verificar se a regional existe e está ativa
  const { data: regional, error: regionalError } = await supabase
    .from('regional')
    .select('id, nome, codigo')
    .eq('id', regionalId)
    .eq('ativo', true)
    .single();

  if (regionalError || !regional) {
    return NextResponse.json({
      success: false,
      error: 'Regional não encontrada ou inativa',
      campo: 'regional'
    }, { status: 400 });
  }

  // Criar solicitação de supervisor
  const { data: novaSolicitacao, error: insertError } = await supabase
    .from('solicitacao_supervisor')
    .insert({
      matricula,
      nome,
      email,
      senha_hash: senha, // Temporário: armazenar senha para criação posterior
      regional_id: regionalId,
      justificativa,
      status: 'PENDENTE',
      data_solicitacao: new Date().toISOString()
    })
    .select(`
      id,
      matricula,
      nome,
      status,
      data_solicitacao,
      regional:regional_id(nome, codigo)
    `)
    .single();

  if (insertError) {
    console.error('❌ Erro ao criar solicitação:', insertError);
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao criar solicitação'
    }, { status: 500 });
  }

  console.log('✅ Solicitação de supervisor criada:', {
    id: novaSolicitacao.id,
    matricula: novaSolicitacao.matricula,
    nome: novaSolicitacao.nome,
    regional: novaSolicitacao.regional
  });

  return NextResponse.json({
    success: true,
    tipo: 'SOLICITACAO_PENDENTE', // ✅ IDENTIFICADOR PARA O FRONTEND
    message: 'Solicitação de autorização enviada para análise do administrador',
    data: {
      id: novaSolicitacao.id,
      matricula: novaSolicitacao.matricula,
      nome: novaSolicitacao.nome,
      status: novaSolicitacao.status,
      dataEnvio: novaSolicitacao.data_solicitacao
    },
    regional: novaSolicitacao.regional
  }, { status: 201 });
}

// ✅ FUNÇÃO EXISTENTE: Criar conta de membro (sem mudanças)
async function criarContaMembro(dados: any) {
  const { matricula, nome, email, senha, regionalId } = dados;

  // Verificar se a matrícula já existe
  const { data: matriculaExistente } = await supabase
    .from('servidor')
    .select('id')
    .eq('matricula', matricula)
    .single();

  if (matriculaExistente) {
    return NextResponse.json({
      success: false,
      error: 'Esta matrícula já está cadastrada no sistema',
      campo: 'matricula'
    }, { status: 400 });
  }

  // Verificar se a regional existe e está ativa
  const { data: regional, error: regionalError } = await supabase
    .from('regional')
    .select('id, nome, codigo')
    .eq('id', regionalId)
    .eq('ativo', true)
    .single();

  if (regionalError || !regional) {
    return NextResponse.json({
      success: false,
      error: 'Regional não encontrada ou inativa',
      campo: 'regional'
    }, { status: 400 });
  }

  // Criar conta de membro
  const { data: novoServidor, error: insertError } = await supabase
    .from('servidor')
    .insert({
      matricula,
      nome,
      email,
      perfil: 'Membro',
      regional_id: regionalId,
      ativo: true,
      senha_hash: senha,
      criado_em: new Date().toISOString()
    })
    .select(`
      id,
      matricula,
      nome,
      perfil,
      regional_id,
      ativo,
      regional:regional_id(id, nome, codigo)
    `)
    .single();

  if (insertError) {
    console.error('❌ Erro ao inserir servidor:', insertError);
    return NextResponse.json({
      success: false,
      error: 'Erro interno ao criar conta'
    }, { status: 500 });
  }

  console.log('✅ Membro cadastrado com sucesso:', {
    id: novoServidor.id,
    matricula: novoServidor.matricula,
    nome: novoServidor.nome,
    regional: novoServidor.regional
  });

  return NextResponse.json({
    success: true,
    tipo: 'conta_membro',
    data: {
      id: novoServidor.id,
      matricula: novoServidor.matricula,
      nome: novoServidor.nome,
      perfil: novoServidor.perfil,
      regionalId: novoServidor.regional_id,
      regional: novoServidor.regional
    },
    message: 'Conta criada com sucesso!'
  });
} 
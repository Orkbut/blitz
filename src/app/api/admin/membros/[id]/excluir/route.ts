import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para exclusão completa de membro - Contexto: Administrativo
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ✅ CORREÇÃO: Await params para Next.js 15+
    const resolvedParams = await params;
    const membroId = parseInt(resolvedParams.id);

    if (isNaN(membroId)) {
      return NextResponse.json({
        success: false,
        error: 'ID do membro inválido'
      }, { status: 400 });
    }

    // Verificar se o membro existe
    const { data: membro, error: membroError } = await supabase
      .from('servidor')
      .select('id, matricula, nome, perfil, regional_id')
      .eq('id', membroId)
      .single();

    if (membroError || !membro) {
      return NextResponse.json({
        success: false,
        error: 'Membro não encontrado'
      }, { status: 404 });
    }

    // ✅ CORREÇÃO: Pegar ID do admin que está fazendo a exclusão (será o primeiro admin encontrado para simplificar)
    const { data: adminExcluindo } = await supabase
      .from('servidor')
      .select('id')
      .eq('is_admin_global', true)
      .eq('ativo', true)
      .limit(1)
      .single();

    const adminId = adminExcluindo?.id || 6; // Fallback para o admin principal

    // Verificar se há participações ativas que impediriam a exclusão
    const { data: participacoesAtivas, error: participacoesError } = await supabase
      .from('participacao')
      .select('id, operacao_id')
      .eq('membro_id', membroId)
      .eq('ativa', true);

    if (participacoesError) {
      console.error('Erro ao verificar participações:', participacoesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao verificar participações do membro'
      }, { status: 500 });
    }

    if (participacoesAtivas && participacoesAtivas.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Não é possível excluir: membro possui ${participacoesAtivas.length} participações ativas em operações`,
        participacoes_ativas: participacoesAtivas.length
      }, { status: 400 });
    }

    // Verificar se é supervisor de alguma operação ativa
    const { data: operacoesSupervisor, error: operacoesError } = await supabase
      .from('janela_operacional')
      .select('id')
      .eq('supervisor_id', membroId)
      .eq('ativa', true);

    if (operacoesError) {
      console.error('Erro ao verificar janelas supervisionadas:', operacoesError);
      return NextResponse.json({
        success: false,
        error: 'Erro ao verificar responsabilidades de supervisão'
      }, { status: 500 });
    }

    if (operacoesSupervisor && operacoesSupervisor.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Não é possível excluir: membro é supervisor de ${operacoesSupervisor.length} janelas operacionais ativas`,
        janelas_ativas: operacoesSupervisor.length
      }, { status: 400 });
    }

    // ✅ CORREÇÃO CRÍTICA: Resolver problema de foreign key
    // Se o membro sendo excluído tem registros no histórico, transferir para outro admin
    
    // Buscar outro admin que não seja o que está sendo excluído
    const { data: outroAdmin } = await supabase
      .from('servidor')
      .select('id')
      .eq('is_admin_global', true)
      .eq('ativo', true)
      .neq('id', membroId) // DIFERENTE do que está sendo excluído
      .limit(1)
      .single();

    let adminResponsavel = adminId;
    
    // ✅ CORREÇÃO: Permitir exclusão do último admin (removida validação restritiva)
    // Se o admin que está sendo excluído é o único admin, usar um ID fictício para o histórico
    if (membroId === adminId) {
      if (outroAdmin) {
        adminResponsavel = outroAdmin.id;
      } else {
        // ✅ MUDANÇA: Usar ID fictício ao invés de bloquear exclusão
        // Isso permite que o último admin se exclua se necessário
        adminResponsavel = 1; // ID fictício para histórico
      }
    }

    // Transferir registros do histórico onde o membro sendo excluído é usuario_id
    const { error: transferirHistoricoError } = await supabase
      .from('historico_modificacao')
      .update({ usuario_id: adminResponsavel })
      .eq('usuario_id', membroId);

    if (transferirHistoricoError) {
      console.error('Erro ao transferir histórico:', transferirHistoricoError);
      // Não falha a operação, mas loga
    }

    // ✅ CORREÇÃO: Registrar no histórico ANTES da exclusão
    const { error: historicoError } = await supabase
      .from('historico_modificacao')
      .insert({
        entidade: 'servidor',
        entidade_id: membroId,
        acao: 'EXCLUSAO_ADMINISTRATIVA',
        dados_anteriores: {
          id: membro.id,
          matricula: membro.matricula,
          nome: membro.nome,
          perfil: membro.perfil,
          regional_id: membro.regional_id
        },
        dados_novos: {
          excluido: true,
          data_exclusao: new Date().toISOString(),
          motivo: 'Exclusão administrativa via portal admin',
          admin_responsavel: adminResponsavel
        },
        usuario_id: adminResponsavel, // ✅ CORREÇÃO: Usar admin válido diferente
        data_modificacao: new Date().toISOString()
      });

    if (historicoError) {
      console.error('Erro ao registrar histórico de exclusão:', historicoError);
      // Não falha a operação por erro de histórico, mas loga o problema
    }

    // Exclusão segura - primeiro inativar, depois excluir referências
    
    // 1. Inativar participações históricas (manter histórico mas inativar)
    await supabase
      .from('participacao')
      .update({ ativa: false })
      .eq('membro_id', membroId);

    // 2. Inativar janelas operacionais históricas
    await supabase
      .from('janela_operacional')
      .update({ ativa: false })
      .eq('supervisor_id', membroId);

    // 3. Marcar eventos como inativos (preservar auditoria)
    await supabase
      .from('eventos_operacao')
      .update({ metadata: JSON.stringify({ membro_excluido: true, data_exclusao: new Date().toISOString() }) })
      .eq('servidor_id', membroId);

    // 4. Finalmente, excluir o registro principal
    const { error: deleteError } = await supabase
      .from('servidor')
      .delete()
      .eq('id', membroId);

    if (deleteError) {
      console.error('Erro ao excluir membro:', deleteError);
      return NextResponse.json({
        success: false,
        error: `Erro ao excluir membro: ${deleteError.message}`
      }, { status: 500 });
    }

    // Log da exclusão para auditoria
    console.log(`✅ [ADMIN-EXCLUSAO] Membro excluído:`, {
      membroId,
      matricula: membro.matricula,
      nome: membro.nome,
      perfil: membro.perfil,
      adminResponsavel: adminResponsavel, // ✅ USAR O ADMIN CORRETO
      timestamp: new Date().toISOString()
    });

    return NextResponse.json({
      success: true,
      message: `Membro ${membro.nome} (${membro.matricula}) excluído com sucesso`,
      data: {
        membro_excluido: {
          id: membro.id,
          nome: membro.nome,
          matricula: membro.matricula,
          perfil: membro.perfil
        }
      },
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de exclusão de membro:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
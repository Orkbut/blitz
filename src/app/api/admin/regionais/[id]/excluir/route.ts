import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para EXCLUSÃO COMPLETA de Regional - Remove TUDO em cascata
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
    const regionalId = parseInt(resolvedParams.id);

    if (!regionalId) {
      return NextResponse.json({
        success: false,
        error: 'ID da regional é obrigatório',
        boundedContext: "administrativo"
      }, { status: 400 });
    }

    // Verificar se a regional existe
    const { data: regional, error: regionalError } = await supabase
      .from('regional')
      .select('*')
      .eq('id', regionalId)
      .single();

    if (regionalError || !regional) {
      return NextResponse.json({
        success: false,
        error: 'Regional não encontrada',
        boundedContext: "administrativo"
      }, { status: 404 });
    }

    console.log(`⚠️ INICIANDO EXCLUSÃO CASCATA COMPLETA DA REGIONAL: ${regional.nome} (ID: ${regionalId})`);
    
    // 🗑️ EXCLUSÃO EM CASCATA - ORDEM IMPORTA (dependências primeiro)
    const exclusoesRealizadas = {
      diarias: 0,
      participacoes: 0,
      operacoes: 0,
      janelas: 0,
      mensagens: 0,
      eventos: 0,
      servidores: 0,
      regional: 0
    };

    // 1. Buscar todas as operações relacionadas à regional (via janelas)
    const { data: operacoes } = await supabase
      .from('operacao')
      .select('id')
      .in('janela_id', 
        await supabase
          .from('janela_operacional')
          .select('id')
          .eq('regional_id', regionalId)
          .then(res => res.data?.map(j => j.id) || [])
      );

    const operacaoIds = operacoes?.map(op => op.id) || [];

    if (operacaoIds.length > 0) {
      // 1.1. Excluir diárias (via participações → operações)
      const { data: participacoes } = await supabase
        .from('participacao')
        .select('id')
        .in('operacao_id', operacaoIds);

      const participacaoIds = participacoes?.map(p => p.id) || [];

      if (participacaoIds.length > 0) {
        const { error: diariasError, count: diariasCount } = await supabase
          .from('diaria')
          .delete()
          .in('participacao_id', participacaoIds);

        if (!diariasError) exclusoesRealizadas.diarias = diariasCount || 0;
      }

      // 1.2. Excluir participações
      const { error: participacoesError, count: participacoesCount } = await supabase
        .from('participacao')
        .delete()
        .in('operacao_id', operacaoIds);

      if (!participacoesError) exclusoesRealizadas.participacoes = participacoesCount || 0;

      // 1.3. Excluir eventos de operação
      const { error: eventosError, count: eventosCount } = await supabase
        .from('eventos_operacao')
        .delete()
        .in('operacao_id', operacaoIds);

      if (!eventosError) exclusoesRealizadas.eventos = eventosCount || 0;

      // 1.4. Excluir execuções de operação
      await supabase
        .from('execucao_operacao')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.5. Excluir notificações de exclusão
      await supabase
        .from('notificacao_exclusao_operacao')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.6. Excluir estados visuais
      await supabase
        .from('estado_visual_membro')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.7. Excluir limites temporários
      await supabase
        .from('limite_temporario')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.8. Excluir eventos de calendário
      await supabase
        .from('evento_calendario')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.9. Excluir portarias
      await supabase
        .from('portaria')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.10. Excluir processos externos
      await supabase
        .from('processo_externo')
        .delete()
        .in('operacao_id', operacaoIds);

      // 1.11. Excluir justificativas obrigatórias
      await supabase
        .from('justificativa_obrigatoria')
        .delete()
        .in('referencia_id', operacaoIds);

      // 1.12. Excluir operações
      const { error: operacoesError, count: operacoesCount } = await supabase
        .from('operacao')
        .delete()
        .in('id', operacaoIds);

      if (!operacoesError) exclusoesRealizadas.operacoes = operacoesCount || 0;
    }

    // 2. Excluir janelas operacionais
    const { error: janelasError, count: janelasCount } = await supabase
      .from('janela_operacional')
      .delete()
      .eq('regional_id', regionalId);

    if (!janelasError) exclusoesRealizadas.janelas = janelasCount || 0;

    // 3. Excluir mensagens regionais
    const { error: mensagensError, count: mensagensCount } = await supabase
      .from('mensagem_regional')
      .delete()
      .eq('regional_id', regionalId);

    if (!mensagensError) exclusoesRealizadas.mensagens = mensagensCount || 0;

    // 4. Buscar servidores da regional
    const { data: servidores } = await supabase
      .from('servidor')
      .select('id')
      .eq('regional_id', regionalId);

    const servidorIds = servidores?.map(s => s.id) || [];

    if (servidorIds.length > 0) {
      // 4.1. Excluir histórico de modificações
      await supabase
        .from('historico_modificacao')
        .delete()
        .in('usuario_id', servidorIds);

      // 4.2. Excluir histórico de parâmetros
      await supabase
        .from('historico_parametros')
        .delete()
        .in('alterado_por', servidorIds);

      // 4.3. Excluir registros de presença
      await supabase
        .from('registro_presenca')
        .delete()
        .in('servidor_id', servidorIds);

      // 4.4. Excluir servidores
      const { error: servidoresError, count: servidoresCount } = await supabase
        .from('servidor')
        .delete()
        .eq('regional_id', regionalId);

      if (!servidoresError) exclusoesRealizadas.servidores = servidoresCount || 0;
    }

    // 5. Por fim, excluir a regional
    const { error: regionalDeleteError, count: regionalCount } = await supabase
      .from('regional')
      .delete()
      .eq('id', regionalId);

    if (regionalDeleteError) {
      throw new Error(`Erro ao excluir regional: ${regionalDeleteError.message}`);
    }

    exclusoesRealizadas.regional = regionalCount || 0;

    console.log(`✅ EXCLUSÃO CASCATA COMPLETA REALIZADA:`, exclusoesRealizadas);

    return NextResponse.json({
      success: true,
      message: `Regional "${regional.nome}" e TODOS os dados relacionados foram excluídos permanentemente`,
      data: {
        regionalExcluida: regional,
        exclusoesRealizadas,
        totalItensExcluidos: Object.values(exclusoesRealizadas).reduce((a, b) => a + b, 0)
      },
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na exclusão cascata da regional:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor durante exclusão cascata',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
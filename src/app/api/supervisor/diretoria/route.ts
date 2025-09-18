import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Tratar datas 'YYYY-MM-DD' como locais para evitar deslocamento de fuso
function parseLocalDate(dateStr: string): Date {
  // Usar meio-dia local para evitar que a conversão para timezone mude o dia
  return new Date(`${dateStr}T12:00:00`);
}

// GET - Listar operações para diretoria
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const formato = searchParams.get('formato') || 'json'; // json | texto
    const janela_id = searchParams.get('janela_id');

    // ✅ ISOLAMENTO POR REGIONAL: Obter contexto do supervisor
    const supervisorRegionalId = request.headers.get('X-Regional-Id');

    console.log('🔍 Buscando dados da diretoria...', { formato, janela_id, supervisorRegionalId });

    // ✅ Buscar operações PLANEJADAS da janela selecionada (apenas da regional do supervisor)
    let queryOperacoes = supabase
      .from('operacao')
      .select(`
        id,
        data_operacao,
        turno,
        modalidade,
        tipo,
        limite_participantes,
        status,
        janela_id,
        janela:janela_operacional!inner(regional_id)
      `)
      .eq('ativa', true)
      .eq('tipo', 'PLANEJADA');

    // ✅ FILTRO POR REGIONAL DO SUPERVISOR
    if (supervisorRegionalId) {
      queryOperacoes = queryOperacoes.eq('janela.regional_id', parseInt(supervisorRegionalId));
      console.log(`🔒 [ISOLAMENTO] Supervisor da Regional ${supervisorRegionalId} - operações diretoria filtradas`);
    }

    // Filtrar por janela se especificada
    if (janela_id) {
      queryOperacoes = queryOperacoes.eq('janela_id', parseInt(janela_id));
    }

    const { data: operacoes, error: errorOperacoes } = await queryOperacoes
      .order('data_operacao', { ascending: true });

    if (errorOperacoes) {
      console.error('❌ Erro ao buscar operações:', errorOperacoes);
      return NextResponse.json({ error: 'Erro ao buscar operações' }, { status: 500 });
    }

    // ✅ Buscar participações confirmadas
    let queryParticipacoes = supabase
      .from('participacao')
      .select(`
        id,
        membro_id,
        operacao_id,
        data_participacao,
        estado_visual,
        ativa,
        servidor:membro_id(
          id,
          nome,
          matricula
        )
      `)
      .eq('ativa', true)
      .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP']);

    // Filtrar por operações encontradas
    if (operacoes && operacoes.length > 0) {
      const operacaoIds = operacoes.map(op => op.id);
      queryParticipacoes = queryParticipacoes.in('operacao_id', operacaoIds);
    }

    const { data: participacoes, error: errorParticipacoes } = await queryParticipacoes;

    if (errorParticipacoes) {
      console.error('❌ Erro ao buscar participações:', errorParticipacoes);
      return NextResponse.json({ error: 'Erro ao buscar participações' }, { status: 500 });
    }

    console.log('✅ Dados encontrados:', {
      operacoes: operacoes?.length || 0,
      participacoes: participacoes?.length || 0
    });

    // Se formato for texto, gerar relatório formatado para WhatsApp
    if (formato === 'texto') {
      const relatorioTexto = await gerarRelatorioWhatsApp(operacoes || [], participacoes || [], janela_id || undefined);
      
      return new NextResponse(relatorioTexto, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8'
        }
      });
    }

    // ✅ Processar dados para o frontend (formato original)
    const operacoesProcessadas = operacoes?.map(op => ({
      id: op.id,
      dataOperacao: op.data_operacao,
      turno: op.turno,
      modalidade: op.modalidade,
      tipo: op.tipo,
      limiteParticipantes: op.limite_participantes,
      status: op.status,
      participantes: participacoes
        ?.filter((p: any) => p.operacao_id === op.id)
        ?.map((p: any) => {
          const servidorData = Array.isArray(p.servidor) ? p.servidor[0] : p.servidor;
          return {
            id: p.id,
            nome: servidorData?.nome || 'Servidor',
            matricula: servidorData?.matricula || '',
            bloqueado: false
          };
        }) || [],
      totalParticipantes: participacoes?.filter(p => p.operacao_id === op.id)?.length || 0
    })) || [];

    return NextResponse.json({
      success: true,
      operacoes: operacoesProcessadas,
      participacoes: participacoes || []
    });

  } catch (error) {
    console.error('❌ Erro inesperado ao buscar operações:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

/**
 * Gera relatório formatado para WhatsApp da tabela de diretoria
 */
async function gerarRelatorioWhatsApp(operacoes: any[], participacoes: any[], janela_id?: string): Promise<string> {
  if (participacoes.length === 0) {
    return 'Nenhuma participação confirmada encontrada para gerar relatório.';
  }

  // Buscar informações da janela operacional se janela_id foi fornecido
  let tituloOperacao = 'OPERAÇÃO RADAR E PESAGEM';
  let periodoOperacao = '';
  
  if (janela_id) {
    try {
      const { data: janela } = await supabase
        .from('janela_operacional')
        .select('data_inicio, data_fim, modalidades')
        .eq('id', parseInt(janela_id))
        .single();
      
      if (janela) {
        // Gerar título baseado nas modalidades da janela
        const modalidades = janela.modalidades?.split(',') || ['RADAR', 'PESAGEM'];
        if (modalidades.includes('BLITZ') && modalidades.includes('BALANCA')) {
          tituloOperacao = 'OPERAÇÃO RADAR E PESAGEM';
        } else if (modalidades.includes('BLITZ')) {
          tituloOperacao = 'OPERAÇÃO RADAR';
        } else if (modalidades.includes('BALANCA')) {
          tituloOperacao = 'OPERAÇÃO PESAGEM';
        }
        
        // Gerar período baseado nas datas da janela
        const dataInicio = new Date(`${janela.data_inicio}T12:00:00`);
        const dataFim = new Date(`${janela.data_fim}T12:00:00`);
        
        // Se o período abrange múltiplos meses, mostrar o período completo
        if (dataInicio.getMonth() !== dataFim.getMonth() || dataInicio.getFullYear() !== dataFim.getFullYear()) {
          const mesInicioAno = dataInicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
          const mesFimAno = dataFim.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
          periodoOperacao = `${mesInicioAno} - ${mesFimAno}`;
        } else {
          // Se é do mesmo mês, mostrar apenas o mês/ano
          periodoOperacao = dataInicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        }
      }
    } catch (error) {
      console.error('❌ Erro ao buscar informações da janela:', error);
      // Fallback para o comportamento anterior
      const primeiraData = new Date(Math.min(...operacoes.map(op => parseLocalDate(op.data_operacao).getTime())));
      periodoOperacao = primeiraData.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
    }
  } else {
    // Fallback para o comportamento anterior quando não há janela_id
    const primeiraData = new Date(Math.min(...operacoes.map(op => parseLocalDate(op.data_operacao).getTime())));
    periodoOperacao = primeiraData.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
  }

  // Agrupar participações por servidor
  const servidoresPorId = participacoes.reduce((acc, participacao) => {
    const servidorData = Array.isArray(participacao.servidor) ? participacao.servidor[0] : participacao.servidor;
    const servidorId = participacao.membro_id;
    const nome = servidorData?.nome || 'Servidor';
    const matricula = servidorData?.matricula || '';
    
    if (!acc[servidorId]) {
      acc[servidorId] = {
        nome,
        matricula,
        participacoes: []
      };
    }
    
    // Encontrar dados da operação
    const operacao = operacoes.find(op => op.id === participacao.operacao_id);
    if (operacao) {
      acc[servidorId].participacoes.push({
        data: operacao.data_operacao,
        operacao_id: operacao.id
      });
    }
    
    return acc;
  }, {} as Record<number, any>);

  // Calcular períodos consecutivos para cada servidor
  const servidoresComPeriodos = Object.values(servidoresPorId).map((servidor: any) => {
    const datasOrdenadas = servidor.participacoes
      .map((p: any) => p.data)
      .sort()
      .map((data: string) => parseLocalDate(data));

    const periodos = calcularPeriodosConsecutivos(datasOrdenadas);
    
    return {
      ...servidor,
      periodos,
      totalDias: periodos.reduce((sum: number, periodo: any) => sum + periodo.dias, 0),
      totalParticipacoes: servidor.participacoes.length
    };
  });

  // Agrupar servidores por períodos únicos
  const periodosPorChave = new Map<string, any>();
  
  servidoresComPeriodos.forEach(servidor => {
    servidor.periodos.forEach((periodo: any) => {
      const dataInicio = periodo.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      // Regra de meia diária: acrescentar +1 dia ao fim para exibição e agrupamento
      const fimExtendido = new Date(periodo.fim.getTime());
      fimExtendido.setDate(fimExtendido.getDate() + 1);
      const dataFim = fimExtendido.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      
      // Criar chave única para o período (usando o fim estendido)
      const chave = `${dataInicio}-${dataFim}`;
      const chaveTempo = periodo.inicio.getTime(); // Para ordenação
      
      if (!periodosPorChave.has(chave)) {
        periodosPorChave.set(chave, {
          dataInicio,
          dataFim,
          chaveTempo,
          servidores: []
        });
      }
      
      periodosPorChave.get(chave)!.servidores.push({
        nome: servidor.nome,
        matricula: servidor.matricula
      });
    });
  });

  // Converter para array e ordenar por data de início
  const periodosOrdenados = Array.from(periodosPorChave.values())
    .sort((a, b) => a.chaveTempo - b.chaveTempo);

  // Ordenar servidores dentro de cada período por nome
  periodosOrdenados.forEach(periodo => {
    periodo.servidores.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
  });

  // Gerar relatório no formato WhatsApp
  let relatorio = '========================================';
  relatorio += `\n           ${tituloOperacao}\n`;
  relatorio += `               ${periodoOperacao}\n`;
  relatorio += '========================================\n\n';

  periodosOrdenados.forEach(periodo => {
    // Formatar período
    let periodoTexto = '';
    if (periodo.dataInicio === periodo.dataFim) {
      periodoTexto = periodo.dataInicio;
    } else {
      periodoTexto = `${periodo.dataInicio} a ${periodo.dataFim}`;
    }
    
    relatorio += `*DIAS: ${periodoTexto}*\n`;
    
    // Listar servidores com formatação elegante
    periodo.servidores.forEach((servidor: any, index: number) => {
      relatorio += `${index + 1}. ✓ *${servidor.nome.toUpperCase()}*\n`;
      relatorio += `   Mat.: ${servidor.matricula}\n`;
    });
    
    relatorio += '\n';
  });

  return relatorio;
}

/**
 * Calcula períodos consecutivos de datas
 */
function calcularPeriodosConsecutivos(datas: Date[]): any[] {
  if (datas.length === 0) return [];

  const periodos = [];
  let inicioAtual = datas[0];
  let fimAtual = datas[0];

  for (let i = 1; i < datas.length; i++) {
    const dataAtual = datas[i];
    const dataAnterior = datas[i - 1];
    
    // Verificar se é consecutiva (diferença de 1 dia)
    const diferencaDias = Math.round((dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diferencaDias === 1) {
      fimAtual = dataAtual;
    } else {
      // Finalizar período atual
      const dias = Math.round((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      periodos.push({
        inicio: inicioAtual,
        fim: fimAtual,
        dias
      });
      
      // Iniciar novo período
      inicioAtual = dataAtual;
      fimAtual = dataAtual;
    }
  }

  // Adicionar último período
  const dias = Math.round((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  periodos.push({
    inicio: inicioAtual,
    fim: fimAtual,
    dias
  });

  return periodos;
}

/**
 * Gera sequência no formato D+1, DD+1, DDD+1, etc.
 */
function gerarSequencia(dias: number): string {
  if (dias === 1) return 'D';
  if (dias === 2) return 'D+1';
  if (dias === 3) return 'DD+1';
  if (dias === 4) return 'DDD+1';
  if (dias === 5) return 'DDDD+1';
  return `${dias}D`;
}

// POST - Encaminhar, desencaminhar ou registrar retorno
export async function POST(request: NextRequest) {
  try {
    const { operacaoId, acao, decisao, motivo } = await request.json();

    // ✅ OTIMIZADO: Log removido (performance)

    if (!operacaoId || !acao) {
      return NextResponse.json({ error: 'Parâmetros obrigatórios: operacaoId, acao' }, { status: 400 });
    }

    // ✅ Verificar se operação existe
    const { data: operacao, error: errorBusca } = await supabase
      .from('operacao')
      .select('*')
      .eq('id', operacaoId)
      .single();

    if (errorBusca || !operacao) {
      return NextResponse.json({ error: 'Operação não encontrada' }, { status: 404 });
    }

    // ✅ Validar tipo de operação
    if (operacao.tipo !== 'PLANEJADA') {
      return NextResponse.json({ error: 'Apenas operações PLANEJADAS podem ser encaminhadas à diretoria' }, { status: 400 });
    }

    // ✅ Processar ação específica
    switch (acao) {
      case 'encaminhar':
        return await encaminharParaDiretoria(operacao);
      
      case 'desencaminhar':
        return await desencaminharDaDiretoria(operacao);
      
      case 'registrar_retorno':
        if (!decisao || (decisao === 'REJEITADA' && !motivo)) {
          return NextResponse.json({ 
            error: 'Parâmetros obrigatórios: decisao e motivo (se rejeitada)' 
          }, { status: 400 });
        }
        return await registrarRetornoDiretoria(operacao, decisao, motivo);
      
      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }

  } catch (error) {
    console.error('❌ Erro inesperado na API diretoria:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

// ✅ FUNÇÃO: Encaminhar para diretoria
async function encaminharParaDiretoria(operacao: any) {
  // Validar status
  if (operacao.status !== 'APROVADA') {
    return NextResponse.json({ 
      error: 'Operação deve estar com status APROVADA para ser encaminhada' 
    }, { status: 400 });
  }

  // ✅ Buscar participantes aprovados
  const { data: participantes, error: errorParticipantes } = await supabase
    .from('participacao')
    .select(`
      id,
      status_interno,
      servidor:membro_id(
        id,
        nome,
        matricula
      )
    `)
    .eq('operacao_id', operacao.id)
    .eq('status_interno', 'APROVADO');

  if (errorParticipantes || !participantes || participantes.length === 0) {
    return NextResponse.json({ 
      error: 'Operação deve ter pelo menos 1 participante aprovado' 
    }, { status: 400 });
  }

  // Calcular valor total das diárias (exemplo: R$ 137,78 por participante)
  const valorDiaria = 137.78;
  const valorTotal = participantes.length * valorDiaria;

  // Gerar documentação (simulada)
  const documentacao = {
    dataGeracao: new Date().toISOString(),
    totalParticipantes: participantes.length,
    valorTotal: valorTotal,
    operacao: operacao.id,
    participantes: participantes.map((p: any) => ({
      nome: p.servidor?.nome,
      matricula: p.servidor?.matricula
    }))
  };

  // ✅ Atualizar operação no banco
  const { error: updateError } = await supabase
    .from('operacao')
    .update({
      status: 'AGUARDANDO_DIRETORIA',
      encaminhado_diretoria_em: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' })).toISOString(),
      valor_total_diarias: valorTotal,
      documentacao_gerada: JSON.stringify(documentacao)
    })
    .eq('id', operacao.id);

  if (updateError) {
    console.error('❌ Erro ao encaminhar para diretoria:', updateError);
    return NextResponse.json({ error: 'Erro ao encaminhar para diretoria' }, { status: 500 });
  }

  // ✅ 🔒 BLOQUEIO CRÍTICO: Bloquear TODAS as participações desta operação
  const { error: updateParticipacoes } = await supabase
    .from('participacao')
    .update({
      bloqueado_diretoria: true
    })
    .eq('operacao_id', operacao.id);

  if (updateParticipacoes) {
    console.error('⚠️ Aviso: Erro ao bloquear participações:', updateParticipacoes);
  }

          // ✅ OTIMIZADO: Log removido (performance)

  return NextResponse.json({
    success: true,
    message: 'Operação encaminhada para diretoria com sucesso',
    data: {
      operacaoId: operacao.id,
      status: 'AGUARDANDO_DIRETORIA',
      valorTotal: valorTotal,
      participantes: participantes.length,
      documentacao: documentacao,
      membrosBloquados: participantes.length
    }
  });
}

// ✅ FUNÇÃO: Desencaminhar da diretoria
async function desencaminharDaDiretoria(operacao: any) {
  // Validar status
  if (operacao.status !== 'AGUARDANDO_DIRETORIA') {
    return NextResponse.json({ 
      error: 'Operação deve estar AGUARDANDO_DIRETORIA para ser desencaminhada' 
    }, { status: 400 });
  }

  // ✅ Atualizar operação no banco
  const { error: updateError } = await supabase
    .from('operacao')
    .update({
      status: 'APROVADA',
      encaminhado_diretoria_em: null,
      retorno_diretoria_em: null,
      decisao_diretoria: null,
      motivo_diretoria: null,
      valor_total_diarias: null,
      documentacao_gerada: null,
      portaria_gerada: null
    })
    .eq('id', operacao.id);

  if (updateError) {
    console.error('❌ Erro ao desencaminhar da diretoria:', updateError);
    return NextResponse.json({ error: 'Erro ao desencaminhar da diretoria' }, { status: 500 });
  }

  // ✅ 🔓 DESBLOQUEIO CRÍTICO: Desbloquear TODAS as participações desta operação
  const { error: updateParticipacoes } = await supabase
    .from('participacao')
    .update({
      bloqueado_diretoria: false
    })
    .eq('operacao_id', operacao.id);

  if (updateParticipacoes) {
    console.error('⚠️ Aviso: Erro ao desbloquear participações:', updateParticipacoes);
  }

          // ✅ OTIMIZADO: Log removido (performance)

  return NextResponse.json({
    success: true,
    message: 'Operação desencaminhada da diretoria com sucesso',
    data: {
      operacaoId: operacao.id,
      status: 'APROVADA',
      membrosDesbloqueados: true
    }
  });
}

// ✅ FUNÇÃO: Registrar retorno da diretoria
async function registrarRetornoDiretoria(operacao: any, decisao: string, motivo?: string) {
  // Validar status
  if (operacao.status !== 'AGUARDANDO_DIRETORIA') {
    return NextResponse.json({ 
      error: 'Operação deve estar AGUARDANDO_DIRETORIA para registrar retorno' 
    }, { status: 400 });
  }

  const novoStatus = decisao === 'APROVADA' ? 'APROVADA_DIRETORIA' : 'REJEITADA_DIRETORIA';

  // ✅ Atualizar operação no banco
  const { error: updateError } = await supabase
    .from('operacao')
    .update({
      status: novoStatus,
      retorno_diretoria_em: new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Fortaleza' })).toISOString(),
      decisao_diretoria: decisao,
      motivo_diretoria: motivo || null
    })
    .eq('id', operacao.id);

  if (updateError) {
    console.error('❌ Erro ao registrar retorno da diretoria:', updateError);
    return NextResponse.json({ error: 'Erro ao registrar retorno da diretoria' }, { status: 500 });
  }

  // ✅ 🔓 DESBLOQUEIO CRÍTICO: Desbloquear participações após retorno
  const { error: updateParticipacoes } = await supabase
    .from('participacao')
    .update({
      bloqueado_diretoria: false,
      // Se aprovada, confirmar participações; se rejeitada, manter aprovado para nova tentativa
      status_interno: decisao === 'APROVADA' ? 'CONFIRMADO' : 'APROVADO'
    })
    .eq('operacao_id', operacao.id);

  if (updateParticipacoes) {
    console.error('⚠️ Aviso: Erro ao atualizar participações:', updateParticipacoes);
  }

          // ✅ OTIMIZADO: Log removido (performance)

  // ✅ Se aprovada, gerar portaria automática
  let portariaGerada = null;
  if (decisao === 'APROVADA') {
    portariaGerada = {
      numero: `PORTARIA-${operacao.id}-${Date.now()}`,
      dataGeracao: new Date().toISOString(),
      operacao: operacao.id,
      valorTotal: operacao.valor_total_diarias,
      status: 'GERADA_AUTOMATICAMENTE'
    };

    // Salvar portaria
    await supabase
      .from('operacao')
      .update({
        portaria_gerada: JSON.stringify(portariaGerada)
      })
      .eq('id', operacao.id);
  }

  return NextResponse.json({
    success: true,
    message: `Retorno da diretoria registrado: ${decisao}`,
    data: {
      operacaoId: operacao.id,
      status: novoStatus,
      decisao: decisao,
      motivo: motivo,
      portaria: portariaGerada,
      membrosDesbloqueados: true
    }
  });
}
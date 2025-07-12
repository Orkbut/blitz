import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para configurações de exclusão de membros - Contexto: Administrativo
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configuração de exclusão
    const { data: config, error } = await supabase
      .from('parametros_sistema')
      .select('nome_parametro, valor_atual')
      .eq('nome_parametro', 'exclusao_membros_ativa')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar configuração de exclusão:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar configuração'
      }, { status: 500 });
    }

    // Configuração padrão se não existir
    const configuracao = {
      exclusao_membros_ativa: config ? config.valor_atual === 'true' : false
    };

    return NextResponse.json({
      success: true,
      data: configuracao,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de configurações de exclusão:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { exclusao_membros_ativa } = await request.json();

    // Validação básica
    if (typeof exclusao_membros_ativa !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Valor inválido para exclusao_membros_ativa'
      }, { status: 400 });
    }

    const configuracao = {
      nome_parametro: 'exclusao_membros_ativa',
      valor_atual: exclusao_membros_ativa.toString(),
      tipo_valor: 'BOOLEAN',
      descricao: 'Controla se a funcionalidade de exclusão de membros está habilitada',
      categoria: 'seguranca'
    };

    // Verificar se parâmetro já existe
    const { data: existing, error: checkError } = await supabase
      .from('parametros_sistema')
      .select('id')
      .eq('nome_parametro', configuracao.nome_parametro)
      .single();

    if (existing) {
      // Atualizar existente
      const { error: updateError } = await supabase
        .from('parametros_sistema')
        .update({
          valor_atual: configuracao.valor_atual,
          atualizado_em: new Date().toISOString()
        })
        .eq('nome_parametro', configuracao.nome_parametro);

      if (updateError) {
        console.error('Erro ao atualizar configuração de exclusão:', updateError);
        return NextResponse.json({
          success: false,
          error: `Erro ao atualizar configuração: ${updateError.message}`
        }, { status: 500 });
      }
    } else {
      // Inserir novo
      const { error: insertError } = await supabase
        .from('parametros_sistema')
        .insert({
          nome_parametro: configuracao.nome_parametro,
          valor_atual: configuracao.valor_atual,
          tipo_valor: configuracao.tipo_valor,
          descricao: configuracao.descricao,
          categoria: configuracao.categoria,
          pode_alterar_runtime: true,
          valido_apartir: new Date().toISOString().split('T')[0],
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString()
        });

      if (insertError) {
        console.error('Erro ao inserir configuração de exclusão:', insertError);
        return NextResponse.json({
          success: false,
          error: `Erro ao salvar configuração: ${insertError.message}`
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configurações de exclusão salvas com sucesso!',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao salvar configurações de exclusão:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
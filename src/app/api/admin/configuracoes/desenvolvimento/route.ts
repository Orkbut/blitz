import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para configurações da área de desenvolvimento - Contexto: Administrativo
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar configurações de desenvolvimento
    const { data: config, error } = await supabase
      .from('parametros_sistema')
      .select('nome_parametro, valor_atual')
      .eq('nome_parametro', 'area_desenvolvimento_ativa');

    if (error) {
      console.error('Erro ao buscar configurações:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar configurações'
      }, { status: 500 });
    }

    // Montar objeto de configurações
    const configuracoes = {
      area_desenvolvimento_ativa: false
    };

    if (config) {
      config.forEach((param: any) => {
        if (param.nome_parametro === 'area_desenvolvimento_ativa') {
          configuracoes.area_desenvolvimento_ativa = param.valor_atual === 'true';
        }
      });
    }

    return NextResponse.json({
      success: true,
      data: configuracoes,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de configurações:', error);
    
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

    const { area_desenvolvimento_ativa } = await request.json();

    // Validações básicas
    if (typeof area_desenvolvimento_ativa !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: 'Valor inválido para area_desenvolvimento_ativa'
      }, { status: 400 });
    }

      // Verificar se parâmetro já existe
      const { data: existing, error: checkError } = await supabase
        .from('parametros_sistema')
        .select('id')
      .eq('nome_parametro', 'area_desenvolvimento_ativa')
        .single();

      if (existing) {
        // Atualizar existente
        const { error: updateError } = await supabase
          .from('parametros_sistema')
          .update({
          valor_atual: area_desenvolvimento_ativa.toString(),
            atualizado_em: new Date().toISOString()
          })
        .eq('nome_parametro', 'area_desenvolvimento_ativa');

        if (updateError) {
          console.error('Erro ao atualizar configuração:', updateError);
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
          nome_parametro: 'area_desenvolvimento_ativa',
          valor_atual: area_desenvolvimento_ativa.toString(),
          tipo_valor: 'BOOLEAN',
          descricao: 'Controla se a área de desenvolvimento é visível na interface dos membros',
          categoria: 'desenvolvimento',
            pode_alterar_runtime: true,
            valido_apartir: new Date().toISOString().split('T')[0],
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString()
          });

        if (insertError) {
          console.error('Erro ao inserir configuração:', insertError);
          return NextResponse.json({
            success: false,
          error: `Erro ao salvar configuração: ${insertError.message}`
          }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Configuração salva com sucesso!',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao salvar configuração:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
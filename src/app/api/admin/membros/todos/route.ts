import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// API para buscar todos os membros do sistema - Contexto: Administrativo
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar todos os membros ativos com suas regionais
    const { data: membros, error } = await supabase
      .from('servidor')
      .select(`
        id,
        matricula,
        nome,
        email,
        perfil,
        ativo,
        criado_em,
        regional_id,
        regional:regional_id(nome, codigo)
      `)
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar membros:', error);
      return NextResponse.json({
        success: false,
        error: 'Erro ao buscar membros'
      }, { status: 500 });
    }

    // Formatar dados para a interface
    const membrosFormatados = (membros || []).map((membro: any) => ({
      id: membro.id,
      matricula: membro.matricula,
      nome: membro.nome,
      email: membro.email,
      perfil: membro.perfil,
      ativo: membro.ativo,
      criado_em: membro.criado_em,
      regional_id: membro.regional_id,
      regional_nome: membro.regional?.nome || 'Regional não definida',
      regional_codigo: membro.regional?.codigo || 'N/A'
    }));

    return NextResponse.json({
      success: true,
      data: membrosFormatados,
      total: membrosFormatados.length,
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro na API de membros:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      boundedContext: "administrativo",
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
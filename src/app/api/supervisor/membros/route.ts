import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Listar membros ativos
export async function GET(request: NextRequest) {
  try {
    // ✅ OTIMIZADO: Buscar membros ativos
    const { data: membros, error } = await supabase
      .from('servidor')
      .select('id, nome, matricula, perfil, ativo')
      .eq('ativo', true)
      .order('nome', { ascending: true });

    if (error) {
      console.error('❌ [API-MEMBROS] Erro ao buscar membros:', error);
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      data: membros || [],
      total: membros?.length || 0
    });
  } catch (error) {
    console.error('❌ [API-MEMBROS] Erro na API:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 
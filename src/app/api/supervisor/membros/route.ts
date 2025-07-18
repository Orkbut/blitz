import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Listar membros ativos
export async function GET(request: NextRequest) {
  try {
    // ✅ ISOLAMENTO POR REGIONAL: Obter contexto do supervisor
    const supervisorRegionalId = request.headers.get('X-Regional-Id');
    
    // ✅ OTIMIZADO: Buscar membros ativos da regional do supervisor
    let query = supabase
      .from('servidor')
      .select('id, nome, matricula, perfil, ativo, regional_id')
      .eq('ativo', true);

    // ✅ FILTRO POR REGIONAL
    if (supervisorRegionalId) {
      query = query.eq('regional_id', parseInt(supervisorRegionalId));
      console.log(`🔒 [ISOLAMENTO] Supervisor da Regional ${supervisorRegionalId} - membros filtrados`);
    }

    const { data: membros, error } = await query.order('nome', { ascending: true });

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
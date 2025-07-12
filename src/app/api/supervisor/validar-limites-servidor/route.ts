import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ValidadorLimitesServidor } from '@/core/domain/services/ValidadorLimitesServidor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * ✅ API para validar limites de servidor antes de confirmar participação
 * Valida tanto limite de atividades (período 10→09) quanto limite de diárias (mês civil)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { servidorId, dataOperacao, tipoOperacao, modalidade } = body;

    // Validação de entrada
    if (!servidorId || !dataOperacao || !tipoOperacao) {
      return NextResponse.json({
        success: false,
        error: 'servidorId, dataOperacao e tipoOperacao são obrigatórios'
      }, { status: 400 });
    }

    console.log('🔍 Validando limites:', { servidorId, dataOperacao, tipoOperacao });

    // Criar validador
    const validador = new ValidadorLimitesServidor(supabase);

    // Executar validação
    const resultado = await validador.validarLimites({
      servidorId: parseInt(servidorId),
      dataOperacao,
      tipoOperacao,
      modalidade
    });

    console.log('📊 Resultado da validação:', resultado);

    return NextResponse.json({
      success: true,
      data: resultado,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro na validação de limites:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
} 
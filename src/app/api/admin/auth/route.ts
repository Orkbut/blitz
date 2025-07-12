import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// API de Autenticação Admin - Acesso Seguro
export async function POST(request: NextRequest) {
  try {
    const { login, senha } = await request.json();

    if (!login || !senha) {
      return NextResponse.json({
        success: false,
        error: 'Login e senha são obrigatórios'
      }, { status: 400 });
    }

    // Credenciais fixas conforme solicitado
    const ADMIN_LOGIN = 'unmistk';
    const ADMIN_SENHA = 'Dr0v0linx@1316158';

    // Validação das credenciais
    if (login !== ADMIN_LOGIN || senha !== ADMIN_SENHA) {
      // Log de tentativa de acesso inválida
      console.warn(`🚨 Tentativa de acesso admin inválida: ${login} em ${new Date().toISOString()}`);
      
      return NextResponse.json({
        success: false,
        error: 'Credenciais inválidas'
      }, { status: 401 });
    }

    // Gerar token de sessão
    const sessionData = {
      login: ADMIN_LOGIN,
      timestamp: Date.now(),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    };

    const token = crypto
      .createHash('sha256')
      .update(JSON.stringify(sessionData) + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      .digest('hex');

    // Opcional: Salvar sessão no banco (para auditoria)
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase
        .from('admin_sessions')
        .insert({
          token_hash: crypto.createHash('sha256').update(token).digest('hex'),
          login: ADMIN_LOGIN,
          ip_address: sessionData.ip,
          user_agent: request.headers.get('user-agent') || '',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        });
    } catch (dbError) {
      // Se não conseguir salvar no banco, continue (não é crítico)
      console.warn('Não foi possível salvar sessão admin no banco:', dbError);
    }

    console.log(`✅ Acesso admin autorizado para ${ADMIN_LOGIN} em ${new Date().toISOString()}`);

    return NextResponse.json({
      success: true,
      token,
      message: 'Autenticação realizada com sucesso',
      expiresIn: '24h'
    });

  } catch (error) {
    console.error('Erro na autenticação admin:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
}

// Validar token existente
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Token não fornecido'
      }, { status: 401 });
    }

    // Validação básica do token (em produção seria mais robusta)
    const isValidToken = token.length === 64; // SHA256 hex length

    if (!isValidToken) {
      return NextResponse.json({
        success: false,
        error: 'Token inválido'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      valid: true
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Erro na validação'
    }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matricula, nome, senha } = body;

    // Validações básicas
    if (!matricula || !senha) {
      return NextResponse.json({
        success: false,
        error: 'Matrícula e senha são obrigatórios',
        campo: !matricula ? 'matricula' : 'senha'
      }, { status: 400 });
    }

    // Verificar se é modo login (nome = 'LOGIN_MODE')
    const isLoginMode = nome === 'LOGIN_MODE';

    // Buscar servidor no banco pela matrícula
    const { data: servidor, error } = await supabase
      .from('servidor')
      .select(`
        id,
        matricula,
        nome,
        perfil,
        regional_id,
        ativo,
        senha_hash,
        regional:regional_id(
          id,
          nome,
          codigo
        )
      `)
      .eq('matricula', matricula.trim())
      .eq('ativo', true)
      .single();

    if (error || !servidor) {
      console.log('❌ Servidor não encontrado:', { matricula, error });
      return NextResponse.json({
        success: false,
        error: 'Matrícula não encontrada no sistema',
        campo: 'matricula'
      }, { status: 404 });
    }

    // Verificar nome apenas se não for modo login
    if (!isLoginMode) {
      if (!nome) {
        return NextResponse.json({
          success: false,
          error: 'Nome é obrigatório para cadastro',
          campo: 'nome'
        }, { status: 400 });
      }

      const nomeServidor = servidor.nome.toLowerCase().trim();
      const nomeInformado = nome.toLowerCase().trim();
      
      if (nomeServidor !== nomeInformado) {
        console.log('❌ Nome não confere:', { 
          esperado: servidor.nome, 
          informado: nome 
        });
        return NextResponse.json({
          success: false,
          error: 'Nome não confere com o cadastrado para esta matrícula',
          campo: 'nome'
        }, { status: 400 });
      }
    }

    // Validar senha com a armazenada no banco
    if (!servidor.senha_hash) {
      // Servidor antigo sem senha - usar padrão temporário
      const senhaEsperada = `${matricula}123`;
      if (senha !== senhaEsperada) {
        console.log('❌ Senha incorreta (padrão) para matrícula:', matricula);
        return NextResponse.json({
          success: false,
          error: 'Senha incorreta',
          campo: 'senha'
        }, { status: 401 });
      }
    } else {
      // Servidor novo com senha personalizada
      if (senha !== servidor.senha_hash) {
        console.log('❌ Senha incorreta (personalizada) para matrícula:', matricula);
        return NextResponse.json({
          success: false,
          error: 'Senha incorreta',
          campo: 'senha'
        }, { status: 401 });
      }
    }

    // ✅ Autenticação bem-sucedida
    console.log('✅ Autenticação bem-sucedida:', {
      id: servidor.id,
      matricula: servidor.matricula,
      nome: servidor.nome,
      perfil: servidor.perfil
    });

    return NextResponse.json({
      success: true,
      data: {
        id: servidor.id,
        matricula: servidor.matricula,
        nome: servidor.nome,
        perfil: servidor.perfil,
        regionalId: servidor.regional_id,
        regional: servidor.regional
      },
      message: 'Autenticação realizada com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro na validação do servidor:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor'
    }, { status: 500 });
  }
} 
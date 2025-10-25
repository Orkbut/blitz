import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const operacaoId = formData.get('operacao_id') as string;
    const membroId = formData.get('membro_id') as string;
    const file = formData.get('file') as File;
    const descricao = formData.get('descricao') as string;

    console.log('📥 [API DEBUG] Dados recebidos:', {
      operacaoId,
      membroId,
      fileName: file?.name,
      fileSize: file?.size,
      fileType: file?.type
    });

    if (!operacaoId || !file) {
      console.log('❌ [API DEBUG] Dados obrigatórios faltando');
      return NextResponse.json(
        { error: 'ID da operação e arquivo são obrigatórios' },
        { status: 400 }
      );
    }

    // Upload do arquivo para o storage
    const fileName = `${Date.now()}_${file.name}`;
    console.log('📤 [API DEBUG] Fazendo upload para storage:', fileName);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('fotos-operacao')
      .upload(fileName, file);

    if (uploadError) {
      console.error('❌ [API DEBUG] Erro no upload:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload da foto' },
        { status: 500 }
      );
    }

    console.log('✅ [API DEBUG] Upload bem-sucedido:', uploadData);

     // Salvar informações da foto no banco
      const fotoData = {
        operacao_id: parseInt(operacaoId),
        membro_id: membroId ? parseInt(membroId) : null,
        url_foto: uploadData.path,
        nome_arquivo: file.name,
        tamanho_bytes: file.size,
        tipo_mime: file.type,
        processada: false
      };

      console.log('💾 [API DEBUG] Salvando no banco:', fotoData);

      const { data: foto, error: dbError } = await supabase
        .from('fotos_operacao')
        .insert(fotoData)
        .select()
        .single();

    if (dbError) {
       console.error('❌ [API DEBUG] Erro ao salvar no banco:', dbError);
       return NextResponse.json(
         { error: 'Erro ao salvar informações da foto' },
         { status: 500 }
       );
     }

     console.log('🎉 [API DEBUG] Foto salva com sucesso:', foto);
     return NextResponse.json({ foto });
   } catch (error) {
     console.error('❌ [API DEBUG] Erro geral na API:', error);
     return NextResponse.json(
       { error: 'Erro interno do servidor' },
       { status: 500 }
     );
   }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const operacaoId = searchParams.get('operacao_id');

    if (!operacaoId) {
      return NextResponse.json(
        { error: 'ID da operação é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar fotos da operação
    const { data: fotos, error } = await supabase
      .from('fotos_operacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar fotos:', error);
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    return NextResponse.json({ fotos: fotos || [] });
  } catch (error) {
    console.error('Erro na API de fotos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
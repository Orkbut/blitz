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

    if (!operacaoId || !file) {
      return NextResponse.json(
        { error: 'ID da operação e arquivo são obrigatórios' },
        { status: 400 }
      );
    }

    // Sanitizar nome do arquivo removendo caracteres especiais
    const sanitizedFileName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Substitui caracteres especiais por _
      .replace(/_{2,}/g, '_'); // Remove múltiplos underscores consecutivos
    
    const fileName = `${Date.now()}_${sanitizedFileName}`;
    
    // Upload do arquivo para o storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('fotos-operacao')
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json(
        { error: 'Erro ao fazer upload da foto' },
        { status: 500 }
      );
    }

    // Gerar URL pública para a foto
    const { data: publicUrlData } = supabase.storage
      .from('fotos-operacao')
      .getPublicUrl(uploadData.path);

    // Salvar informações da foto no banco
    const fotoData = {
      operacao_id: parseInt(operacaoId),
      membro_id: membroId ? parseInt(membroId) : null,
      url_foto: publicUrlData.publicUrl,
      nome_arquivo: file.name,
      tamanho_bytes: file.size,
      tipo_mime: file.type,
      processada: false
    };

    const { data: foto, error: dbError } = await supabase
      .from('fotos_operacao')
      .insert(fotoData)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json(
        { error: 'Erro ao salvar informações da foto' },
        { status: 500 }
      );
    }

    // Registrar evento de adição de foto
    try {
      await supabase.rpc('registrar_evento_operacao', {
        p_operacao_id: parseInt(operacaoId),
        p_tipo_evento: 'FOTO_ADICIONADA',
        p_servidor_id: membroId ? parseInt(membroId) : null,
        p_detalhes: `Foto adicionada: ${file.name}`,
        p_metadata: {
          nome_arquivo: file.name,
          tamanho_bytes: file.size,
          tipo_mime: file.type,
          foto_id: foto.id
        }
      });
    } catch (eventError) {
      console.error('Erro ao registrar evento de foto:', eventError);
      // Não falha o upload se o evento não for registrado
    }

    return NextResponse.json({ foto });
  } catch (error) {
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
      return NextResponse.json(
        { error: 'Erro interno do servidor' },
        { status: 500 }
      );
    }

    // Garantir que todas as fotos tenham URLs públicas válidas
    const fotosComUrlPublica = fotos?.map(foto => {
      // Se a URL não for uma URL completa, gerar URL pública
      if (foto.url_foto && !foto.url_foto.startsWith('http')) {
        const { data: publicUrlData } = supabase.storage
          .from('fotos-operacao')
          .getPublicUrl(foto.url_foto);
        
        return {
          ...foto,
          url_foto: publicUrlData.publicUrl
        };
      }
      return foto;
    }) || [];

    return NextResponse.json({ fotos: fotosComUrlPublica });
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
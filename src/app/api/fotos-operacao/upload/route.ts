import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

interface ParticipacaoComOperacao {
  id: number;
  operacao_id: number;
  operacao: {
    id: number;
    data_operacao: string;
  };
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FILE_SIZE = 18 * 1024 * 1024; // 18MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const operacaoId = formData.get('operacao_id') as string;
    const membroId = formData.get('membro_id') as string;

    // Validações básicas
    if (!file || !operacaoId || !membroId) {
      return NextResponse.json(
        { error: 'Arquivo, ID da operação e ID do membro são obrigatórios' },
        { status: 400 }
      );
    }

    // Validar tipo de arquivo
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.' },
        { status: 400 }
      );
    }

    // Validar tamanho
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 18MB.' },
        { status: 400 }
      );
    }

    // Verificar se a operação existe e se o membro participa
    const { data: participacao, error: participacaoError } = await supabase
      .from('participacao')
      .select(`
        id,
        operacao_id,
        operacao!inner(id, data_operacao)
      `)
      .eq('operacao_id', operacaoId)
      .eq('servidor_id', membroId)
      .single() as { data: ParticipacaoComOperacao | null; error: any };

    if (participacaoError || !participacao) {
      return NextResponse.json(
        { error: 'Você não participa desta operação' },
        { status: 403 }
      );
    }

    // Verificar se a data não é futura
    const dataOperacao = new Date(participacao.operacao.data_operacao);
    const hoje = new Date();
    hoje.setHours(23, 59, 59, 999);

    if (dataOperacao > hoje) {
      return NextResponse.json(
        { error: 'Não é possível adicionar fotos para operações futuras' },
        { status: 400 }
      );
    }

    // Gerar nome único para o arquivo
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${uuidv4()}.${fileExtension}`;
    const filePath = `operacoes/${operacaoId}/${fileName}`;

    // Upload para o Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('fotos-operacoes')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Erro no upload:', uploadError);
      return NextResponse.json(
        { error: 'Erro ao fazer upload do arquivo' },
        { status: 500 }
      );
    }

    // Obter URL pública
    const { data: urlData } = supabase.storage
      .from('fotos-operacoes')
      .getPublicUrl(filePath);

    // Salvar informações no banco
    const { data: fotoData, error: dbError } = await supabase
      .from('fotos_operacao')
      .insert({
        operacao_id: parseInt(operacaoId),
        membro_id: parseInt(membroId),
        nome_arquivo: file.name,
        url_foto: urlData.publicUrl,
        tamanho_bytes: file.size,
        tipo_mime: file.type,
        processada: true,
        metadata: {
          original_name: file.name,
          upload_timestamp: new Date().toISOString(),
          file_path: filePath
        }
      })
      .select()
      .single();

    if (dbError) {
      console.error('Erro ao salvar no banco:', dbError);
      
      // Tentar remover arquivo do storage em caso de erro
      await supabase.storage
        .from('fotos-operacoes')
        .remove([filePath]);

      return NextResponse.json(
        { error: 'Erro ao salvar informações da foto' },
        { status: 500 }
      );
    }

    // ✅ REGISTRAR EVENTO: Foto adicionada
    try {
      await supabase.rpc('registrar_evento_operacao', {
        p_operacao_id: parseInt(operacaoId),
        p_tipo_evento: 'FOTO_ADICIONADA',
        p_servidor_id: parseInt(membroId),
        p_detalhes: `Adicionou foto: ${file.name}`,
        p_metadata: {
          nome_arquivo: file.name,
          tamanho_bytes: file.size,
          tipo_mime: file.type,
          foto_id: fotoData.id
        }
      });
    } catch (eventoError) {
      console.error('Erro ao registrar evento de foto adicionada:', eventoError);
      // Não falhar a operação por causa do evento
    }

    return NextResponse.json({
      success: true,
      foto: fotoData,
      message: 'Foto enviada com sucesso!'
    });

  } catch (error) {
    console.error('Erro na API de upload:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
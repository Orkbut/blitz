import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const fotoId = params.id;

    if (!fotoId) {
      return NextResponse.json(
        { error: 'ID da foto é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar informações da foto
    const { data: foto, error: fotoError } = await supabase
      .from('fotos_operacao')
      .select('*')
      .eq('id', fotoId)
      .single();

    if (fotoError || !foto) {
      return NextResponse.json(
        { error: 'Foto não encontrada' },
        { status: 404 }
      );
    }

    // Verificar se o usuário tem permissão (seria necessário implementar autenticação)
    // Por enquanto, vamos permitir a exclusão

    // Extrair o caminho do arquivo da URL
    const urlParts = foto.url_foto.split('/');
    const fileName = urlParts[urlParts.length - 1];
    const operacaoId = foto.operacao_id;
    const filePath = `operacoes/${operacaoId}/${fileName}`;

    // Remover arquivo do storage
    const { error: storageError } = await supabase.storage
      .from('fotos-operacoes')
      .remove([filePath]);

    if (storageError) {
      console.error('Erro ao remover arquivo do storage:', storageError);
      // Continuar mesmo com erro no storage para não deixar registro órfão
    }

    // ✅ REGISTRAR EVENTO: Foto removida (antes de excluir)
    try {
      await supabase.rpc('registrar_evento_operacao', {
        p_operacao_id: foto.operacao_id,
        p_tipo_evento: 'FOTO_REMOVIDA',
        p_servidor_id: foto.membro_id,
        p_detalhes: `Removeu foto: ${foto.nome_arquivo}`,
        p_metadata: {
          nome_arquivo: foto.nome_arquivo,
          tamanho_bytes: foto.tamanho_bytes,
          tipo_mime: foto.tipo_mime,
          foto_id: foto.id
        }
      });
    } catch (eventoError) {
      console.error('Erro ao registrar evento de foto removida:', eventoError);
      // Não falhar a operação por causa do evento
    }

    // Remover registro do banco
    const { error: dbError } = await supabase
      .from('fotos_operacao')
      .delete()
      .eq('id', fotoId);

    if (dbError) {
      console.error('Erro ao remover do banco:', dbError);
      return NextResponse.json(
        { error: 'Erro ao excluir foto' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Foto excluída com sucesso!'
    });

  } catch (error) {
    console.error('Erro na API de exclusão:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}
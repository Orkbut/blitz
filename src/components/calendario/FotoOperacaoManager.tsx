'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PhotoProvider, PhotoView } from 'react-photo-view';
import { X, Upload, Camera, Trash2, RotateCw, ZoomIn } from 'lucide-react';
import { toast } from 'react-hot-toast';
import styles from './FotoOperacaoManager.module.css';
import 'react-photo-view/dist/react-photo-view.css';

interface Foto {
  id: number;
  nome_arquivo: string;
  url_foto: string;
  tamanho_bytes: number;
  tipo_mime: string;
  criado_em: string;
}

interface FotoOperacaoManagerProps {
  operacaoId: number;
  membroId: number;
  onClose: () => void;
}

const FotoOperacaoManager: React.FC<FotoOperacaoManagerProps> = ({
  operacaoId,
  membroId,
  onClose
}) => {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Carregar fotos da operação
  const carregarFotos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/fotos-operacao?operacao_id=${operacaoId}`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar fotos');
      }
      
      const data = await response.json();
      setFotos(data.fotos || []);
    } catch (error) {
      console.error('Erro ao carregar fotos:', error);
      toast.error('Erro ao carregar fotos da operação');
    } finally {
      setLoading(false);
    }
  };

  // Upload de foto
  const handleUpload = async (file: File) => {
    if (!file) return;

    console.log('🔍 [DEBUG] Iniciando upload:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      operacaoId,
      membroId
    });

    // Validações
    if (file.size > 18 * 1024 * 1024) {
      console.log('❌ [DEBUG] Arquivo muito grande:', file.size);
      toast.error('Arquivo muito grande. Máximo 18MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.log('❌ [DEBUG] Tipo não suportado:', file.type);
      toast.error('Tipo de arquivo não suportado. Use JPEG, PNG ou WebP.');
      return;
    }

    try {
      setUploading(true);
      console.log('📤 [DEBUG] Preparando FormData...');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('operacao_id', operacaoId.toString());
      formData.append('membro_id', membroId.toString());

      console.log('🌐 [DEBUG] Enviando para API: /api/fotos-operacao');
      const response = await fetch('/api/fotos-operacao', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 [DEBUG] Resposta da API:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.log('❌ [DEBUG] Erro da API:', errorData);
        throw new Error(errorData.error || 'Erro no upload');
      }

      const data = await response.json();
      console.log('✅ [DEBUG] Upload bem-sucedido:', data);
      toast.success('Foto enviada com sucesso!');
      
      // Recarregar fotos
      await carregarFotos();
      
    } catch (error: any) {
      console.error('❌ [DEBUG] Erro no upload:', error);
      toast.error(error.message || 'Erro ao enviar foto');
    } finally {
      setUploading(false);
    }
  };

  // Deletar foto
  const handleDelete = async (fotoId: number) => {
    if (!confirm('Tem certeza que deseja excluir esta foto?')) {
      return;
    }

    try {
      const response = await fetch(`/api/fotos-operacao/${fotoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao deletar foto');
      }

      toast.success('Foto excluída com sucesso!');
      
      // Recarregar fotos
      await carregarFotos();
      
    } catch (error: any) {
      console.error('Erro ao deletar foto:', error);
      toast.error(error.message || 'Erro ao excluir foto');
    }
  };

  // Handlers para upload
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCameraCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
    // Limpar input
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
  };

  // Formatação de tamanho de arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Carregar fotos ao montar o componente
  useEffect(() => {
    carregarFotos();
  }, [operacaoId]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Fotos da Operação #{operacaoId}</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={24} />
          </button>
        </div>

        <div className={styles.actions}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={styles.uploadButton}
          >
            <Upload size={20} />
            Galeria
          </button>
          
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className={styles.cameraButton}
          >
            <Camera size={20} />
            Câmera
          </button>

          {uploading && (
            <div className={styles.uploadStatus}>
              Enviando foto...
            </div>
          )}
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              Carregando fotos...
            </div>
          ) : fotos.length === 0 ? (
            <div className={styles.empty}>
              <Camera size={48} />
              <p>Nenhuma foto adicionada ainda</p>
              <p>Clique em "Galeria" ou "Câmera" para adicionar fotos</p>
            </div>
          ) : (
            <PhotoProvider
              maskOpacity={0.8}
              bannerVisible={false}
              toolbarRender={({ rotate, onRotate }) => (
                <div className={styles.photoToolbar}>
                  <button onClick={() => onRotate(rotate + 90)}>
                    <RotateCw size={20} />
                  </button>
                </div>
              )}
            >
              <div className={styles.photoGrid}>
                {fotos.map((foto) => (
                  <div key={foto.id} className={styles.photoCard}>
                    <PhotoView src={foto.url_foto}>
                      <img
                        src={foto.url_foto}
                        alt={foto.nome_arquivo}
                        className={styles.photoThumbnail}
                      />
                    </PhotoView>
                    
                    <div className={styles.photoInfo}>
                      <span className={styles.fileName}>{foto.nome_arquivo}</span>
                      <span className={styles.fileSize}>{formatFileSize(foto.tamanho_bytes)}</span>
                    </div>
                    
                    <button
                      onClick={() => handleDelete(foto.id)}
                      className={styles.deleteButton}
                      title="Excluir foto"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </PhotoProvider>
          )}
        </div>

        {/* Inputs ocultos para upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleCameraCapture}
          style={{ display: 'none' }}
        />
      </div>
    </div>
  );
};

export default FotoOperacaoManager;
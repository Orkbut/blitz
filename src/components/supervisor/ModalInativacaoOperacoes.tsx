'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Operacao } from '@/shared/types';
import { getSupervisorHeaders, formatarDataBR } from '@/lib/auth-utils';

interface ModalInativacaoOperacoesProps {
  isOpen: boolean;
  onClose: () => void;
  janelaId: number;
  onOperacoesAlteradas: () => void;
}

export const ModalInativacaoOperacoes: React.FC<ModalInativacaoOperacoesProps> = ({
  isOpen,
  onClose,
  janelaId,
  onOperacoesAlteradas
}) => {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [operacoesSelecionadas, setOperacoesSelecionadas] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingOperacoes, setLoadingOperacoes] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Fechar modal com ESC
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey);
      };
    }
  }, [isOpen, onClose]);

  // Prevenir scroll da página atrás
  useEffect(() => {
    if (isOpen) {
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  // Carregar operações da janela
  const carregarOperacoes = useCallback(async () => {
    if (!janelaId) return;

    setLoadingOperacoes(true);
    try {
      const response = await fetch(`/api/unified/operacoes?portal=supervisor&janela_id=${janelaId}&includeInactive=true`, {
        headers: getSupervisorHeaders()
      });
      const result = await response.json();
      
      if (result.success && result.data) {
        setOperacoes(result.data);
      } else {
        console.error('Erro ao carregar operações:', result.error);
        setOperacoes([]);
      }
    } catch (error) {
      console.error('Erro ao carregar operações:', error);
      setOperacoes([]);
    } finally {
      setLoadingOperacoes(false);
    }
  }, [janelaId]);

  // Carregar operações quando modal abrir
  useEffect(() => {
    if (isOpen) {
      carregarOperacoes();
      setOperacoesSelecionadas(new Set());
      setMotivo('');
    }
  }, [isOpen, carregarOperacoes]);



  // Toggle seleção de operação
  const toggleOperacao = (operacaoId: number) => {
    const novaSelecao = new Set(operacoesSelecionadas);
    if (novaSelecao.has(operacaoId)) {
      novaSelecao.delete(operacaoId);
    } else {
      novaSelecao.add(operacaoId);
    }
    setOperacoesSelecionadas(novaSelecao);
  };

  // Selecionar todas as operações ativas
  const selecionarTodasAtivas = () => {
    const operacoesAtivas = operacoes.filter(op => !op.inativa_pelo_supervisor);
    const idsAtivas = new Set(operacoesAtivas.map(op => op.id));
    setOperacoesSelecionadas(idsAtivas);
  };

  // Selecionar todas as operações inativas
  const selecionarTodasInativas = () => {
    const operacoesInativas = operacoes.filter(op => op.inativa_pelo_supervisor);
    const idsInativas = new Set(operacoesInativas.map(op => op.id));
    setOperacoesSelecionadas(idsInativas);
  };

  // Limpar seleção
  const limparSelecao = () => {
    setOperacoesSelecionadas(new Set());
  };

  // Inativar operações selecionadas
  const inativarOperacoes = async () => {
    if (operacoesSelecionadas.size === 0) {
      alert('Selecione pelo menos uma operação para inativar.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/operacoes/inativar-multiplas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders()
        },
        body: JSON.stringify({
          operacaoIds: Array.from(operacoesSelecionadas),
          inativar: true,
          motivo: motivo.trim() || undefined
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await carregarOperacoes(); // Recarregar operações
        setOperacoesSelecionadas(new Set());
        setMotivo('');
        onOperacoesAlteradas(); // Notificar componente pai
        alert(`${operacoesSelecionadas.size} operação(ões) inativada(s) com sucesso.`);
      } else {
        alert(`Erro ao inativar operações: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao inativar operações:', error);
      alert('Erro de conexão. Não foi possível inativar as operações.');
    } finally {
      setLoading(false);
    }
  };

  // Reativar operações selecionadas
  const reativarOperacoes = async () => {
    if (operacoesSelecionadas.size === 0) {
      alert('Selecione pelo menos uma operação para reativar.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/supervisor/operacoes/inativar-multiplas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getSupervisorHeaders()
        },
        body: JSON.stringify({
          operacaoIds: Array.from(operacoesSelecionadas),
          inativar: false
        })
      });

      const result = await response.json();
      
      if (result.success) {
        await carregarOperacoes(); // Recarregar operações
        setOperacoesSelecionadas(new Set());
        setMotivo('');
        onOperacoesAlteradas(); // Notificar componente pai
        alert(`${operacoesSelecionadas.size} operação(ões) reativada(s) com sucesso.`);
      } else {
        alert(`Erro ao reativar operações: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao reativar operações:', error);
      alert('Erro de conexão. Não foi possível reativar as operações.');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar operações por data
  const operacoesPorData = operacoes.reduce((acc, operacao) => {
    const data = operacao.data_operacao;
    if (!acc[data]) {
      acc[data] = [];
    }
    acc[data].push(operacao);
    return acc;
  }, {} as Record<string, Operacao[]>);

  // Ordenar datas
  const datasOrdenadas = Object.keys(operacoesPorData).sort();

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(0.5rem, 2vw, 1rem)',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease',
      overflow: 'auto',
      overscrollBehavior: 'contain',
      touchAction: 'pan-y'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 'clamp(8px, 2vw, 16px)',
        width: '100%',
        maxWidth: 'min(98vw, 900px)',
        maxHeight: 'min(95vh, 800px)',
        minHeight: 'min(400px, 80vh)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
        animation: 'slideUp 0.3s ease',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y',
        margin: 'auto'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'clamp(0.5rem, 1.5vw, 0.875rem) clamp(0.75rem, 2vw, 1.25rem)',
          background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
          color: 'white',
          minHeight: 'clamp(50px, 8vw, 60px)',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: 'clamp(1rem, 3.5vw, 1.3rem)',
            fontWeight: '700',
            margin: 0,
            flexShrink: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1.2
          }}>
            📁 Inativar Operações
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar modal"
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: 'clamp(0.5rem, 1.5vw, 0.625rem)',
              borderRadius: '12px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'clamp(0.75rem, 2vw, 1rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(0.75rem, 2vw, 1rem)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          minHeight: 0
        }}>
          {loadingOperacoes ? (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div style={{
                display: 'inline-block',
                width: '40px',
                height: '40px',
                border: '3px solid var(--primary-light)',
                borderTop: '3px solid var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              <p style={{ 
                marginTop: 'clamp(0.75rem, 2vw, 1rem)', 
                color: 'var(--text-secondary)',
                fontSize: 'clamp(0.875rem, 2.5vw, 1rem)',
                fontWeight: 500
              }}>
                Carregando operações...
              </p>
            </div>
          ) : (
            <>
              {/* Controles de Seleção */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'clamp(0.5rem, 1vw, 0.75rem)',
                padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
              }}>
                <button
                  onClick={selecionarTodasAtivas}
                  disabled={loading}
                  style={{
                    padding: 'clamp(0.5rem, 1vw, 0.625rem) clamp(0.75rem, 1.5vw, 1rem)',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  ✅ Selecionar Ativas
                </button>
                
                <button
                  onClick={selecionarTodasInativas}
                  disabled={loading}
                  style={{
                    padding: 'clamp(0.5rem, 1vw, 0.625rem) clamp(0.75rem, 1.5vw, 1rem)',
                    background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  📁 Selecionar Inativas
                </button>
                
                <button
                  onClick={limparSelecao}
                  disabled={loading}
                  style={{
                    padding: 'clamp(0.5rem, 1vw, 0.625rem) clamp(0.75rem, 1.5vw, 1rem)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  🗑️ Limpar
                </button>
                
                <div style={{
                  marginLeft: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                  fontWeight: '600',
                  color: 'var(--text-primary)'
                }}>
                  {operacoesSelecionadas.size} selecionada(s)
                </div>
              </div>

              {/* Campo de Motivo */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'clamp(0.25rem, 0.75vw, 0.375rem)'
                }}>
                  Motivo da Inativação (opcional)
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  disabled={loading}
                  placeholder="Digite o motivo para inativar as operações selecionadas..."
                  style={{
                    width: '100%',
                    padding: 'clamp(0.625rem, 1.5vw, 0.875rem)',
                    fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                    border: '2px solid var(--border-color)',
                    borderRadius: '12px',
                    background: loading ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    color: loading ? 'var(--text-disabled)' : 'var(--text-primary)',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    resize: 'vertical',
                    minHeight: '80px',
                    fontFamily: 'inherit'
                  }}
                  onFocus={(e) => {
                    if (!loading) {
                      e.target.style.borderColor = 'var(--primary)';
                      e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                    }
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'var(--border-color)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>

              {/* Lista de Operações por Data */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                background: 'var(--bg-card)'
              }}>
                {datasOrdenadas.length === 0 ? (
                  <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)'
                  }}>
                    Nenhuma operação encontrada nesta janela.
                  </div>
                ) : (
                  datasOrdenadas.map(data => (
                    <div key={data} style={{ borderBottom: '1px solid var(--border-light)' }}>
                      {/* Cabeçalho da Data */}
                      <div style={{
                        padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                        background: 'var(--bg-secondary)',
                        borderBottom: '1px solid var(--border-light)',
                        fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                        fontWeight: '700',
                        color: 'var(--text-primary)'
                      }}>
                        📅 {formatarDataBR(data)}
                      </div>
                      
                      {/* Operações da Data */}
                      <div style={{ padding: 'clamp(0.5rem, 1vw, 0.75rem)' }}>
                        {operacoesPorData[data].map(operacao => (
                          <div
                            key={operacao.id}
                            onClick={() => toggleOperacao(operacao.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'clamp(0.75rem, 1.5vw, 1rem)',
                              padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                              margin: 'clamp(0.25rem, 0.5vw, 0.375rem) 0',
                              background: operacoesSelecionadas.has(operacao.id) 
                                ? 'var(--primary-light)' 
                                : 'var(--bg-card)',
                              border: `2px solid ${operacoesSelecionadas.has(operacao.id) 
                                ? 'var(--primary)' 
                                : 'var(--border-color)'}`,
                              borderRadius: '8px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s ease',
                              opacity: operacao.inativa_pelo_supervisor ? 0.7 : 1,
                              filter: operacao.inativa_pelo_supervisor ? 'grayscale(50%)' : 'none'
                            }}
                          >
                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={operacoesSelecionadas.has(operacao.id)}
                              onChange={() => toggleOperacao(operacao.id)}
                              disabled={loading}
                              style={{
                                width: '18px',
                                height: '18px',
                                cursor: loading ? 'not-allowed' : 'pointer'
                              }}
                            />
                            
                            {/* Informações da Operação */}
                            <div style={{ flex: 1 }}>
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'clamp(0.5rem, 1vw, 0.75rem)',
                                marginBottom: '0.25rem'
                              }}>
                                <span style={{
                                  background: operacao.modalidade === 'BLITZ' 
                                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                                    : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                  color: 'white',
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: 'clamp(0.7rem, 1.4vw, 0.8rem)',
                                  fontWeight: '600'
                                }}>
                                  {operacao.modalidade}
                                </span>
                                
                                <span style={{
                                  color: 'var(--text-secondary)',
                                  fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                                  fontWeight: '500'
                                }}>
                                  {operacao.tipo} • {operacao.turno}
                                </span>
                                
                                {operacao.inativa_pelo_supervisor && (
                                  <span style={{
                                    background: 'linear-gradient(45deg, #6b7280, #4b5563)',
                                    color: 'white',
                                    padding: '0.125rem 0.375rem',
                                    borderRadius: '4px',
                                    fontSize: 'clamp(0.6rem, 1.2vw, 0.7rem)',
                                    fontWeight: '700',
                                    textTransform: 'uppercase'
                                  }}>
                                    📁 ARQUIVO
                                  </span>
                                )}
                              </div>
                              
                              <div style={{
                                fontSize: 'clamp(0.75rem, 1.5vw, 0.875rem)',
                                color: 'var(--text-secondary)'
                              }}>
                                Operação #{operacao.id} • Limite: {operacao.limite_participantes} participantes
                                {operacao.participantes_confirmados !== undefined && (
                                  <span> • Confirmados: {operacao.participantes_confirmados}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Botões de Ação */}
              <div style={{
                display: 'flex',
                gap: 'clamp(0.75rem, 1.5vw, 1rem)',
                padding: 'clamp(0.75rem, 1.5vw, 1rem) 0 0 0',
                borderTop: '1px solid var(--border-color)',
                flexShrink: 0
              }}>
                <button
                  onClick={inativarOperacoes}
                  disabled={loading || operacoesSelecionadas.size === 0}
                  style={{
                    flex: 1,
                    padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                    background: loading || operacoesSelecionadas.size === 0
                      ? 'var(--bg-secondary)'
                      : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: loading || operacoesSelecionadas.size === 0
                      ? 'var(--text-disabled)'
                      : 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                    fontWeight: '700',
                    cursor: loading || operacoesSelecionadas.size === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: loading || operacoesSelecionadas.size === 0
                      ? 'none'
                      : '0 2px 6px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {loading ? '⏳ Processando...' : '📁 Inativar Selecionadas'}
                </button>
                
                <button
                  onClick={reativarOperacoes}
                  disabled={loading || operacoesSelecionadas.size === 0}
                  style={{
                    flex: 1,
                    padding: 'clamp(0.75rem, 1.5vw, 1rem)',
                    background: loading || operacoesSelecionadas.size === 0
                      ? 'var(--bg-secondary)'
                      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: loading || operacoesSelecionadas.size === 0
                      ? 'var(--text-disabled)'
                      : 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: 'clamp(0.875rem, 2vw, 1rem)',
                    fontWeight: '700',
                    cursor: loading || operacoesSelecionadas.size === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: loading || operacoesSelecionadas.size === 0
                      ? 'none'
                      : '0 2px 6px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  {loading ? '⏳ Processando...' : '✅ Reativar Selecionadas'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
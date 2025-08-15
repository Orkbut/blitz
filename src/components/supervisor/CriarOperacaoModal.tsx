'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MultiDateCalendar } from './MultiDateCalendar';
import { getSupervisorHeaders, formatarDataBR } from '@/lib/auth-utils';

interface JanelaOperacional {
  id: string;
  dataInicio: string;
  dataFim: string;
  modalidades: string[];
}

interface CriarOperacaoModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CriarOperacaoModal: React.FC<CriarOperacaoModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [loadingJanelas, setLoadingJanelas] = useState(true);
  const [janelas, setJanelas] = useState<JanelaOperacional[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [novaOperacao, setNovaOperacao] = useState({
    janelaId: '',
    modalidade: '',
    tipo: 'PLANEJADA',
    turno: '',
    limite: 15
  });

  const [limitesJanela, setLimitesJanela] = useState<{
    periodoPermitido?: { dataInicio: string; dataFim: string };
    modalidadesPermitidas?: string[];
    limitesParticipantes?: { minimo: number; maximo: number; padrao: number };
    configuracaoHerdada?: { modalidadeUnica: string | null; temAmbas: boolean };
  }>({});

  // ✅ FUNCIONALIDADE ESC: Fechar modal com ESC
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [onClose]);

  // ✅ PREVENIR SCROLL DA PÁGINA ATRÁS
  useEffect(() => {
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
  }, []);

  // Carregar janelas operacionais
  useEffect(() => {
    carregarJanelas();
  }, []);



  const carregarJanelas = async () => {
    setLoadingJanelas(true);
    try {
      const response = await fetch('/api/supervisor/janelas-operacionais', {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const result = await response.json();
      
      if (result.success) {
        console.log('🔍 DEBUG - Janelas recebidas da API:', result.data);
        result.data.forEach((janela: any) => {
          console.log(`🔍 Janela #${janela.id}:`, {
            dataInicio_raw: janela.dataInicio,
            dataFim_raw: janela.dataFim,
            dataInicio_formatada: formatarDataBR(janela.dataInicio),
            dataFim_formatada: formatarDataBR(janela.dataFim)
          });
        });
        setJanelas(result.data || []);
      } else {
        alert(`Erro ao carregar janelas: ${result.error}`);
      }
    } catch (error) {
      console.error('Erro ao carregar janelas:', error);
      alert('Erro de conexão. Não foi possível carregar as janelas operacionais.');
    } finally {
      setLoadingJanelas(false);
    }
  };

  // ✅ CARREGAR LIMITES DA JANELA PARA HERANÇA AUTOMÁTICA
  const carregarLimitesJanela = async (janelaId: string) => {
    if (!janelaId) {
      setLimitesJanela({});
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/operacoes?janelaId=${janelaId}`);
      const result = await response.json();
      
      if (result.success) {
        setLimitesJanela(result.data);
        
        // ✅ HERANÇA AUTOMÁTICA: Aplicar limites no formulário
        setNovaOperacao(prev => ({
          ...prev,
          // Herdar modalidade se for única
          modalidade: result.data.configuracaoHerdada?.modalidadeUnica || prev.modalidade,
          // Herdar limite padrão
          limite: result.data.limitesParticipantes?.padrao || prev.limite
        }));
        
        console.log('✅ Limites da janela carregados:', result.data);
      } else {
        console.error('❌ Erro ao carregar limites:', result.error);
        setLimitesJanela({});
      }
    } catch (error) {
      console.error('❌ Erro ao carregar limites da janela:', error);
      setLimitesJanela({});
    }
  };

  // ✅ ESTADO DE DESABILITAÇÃO CONDICIONAL
  const isJanelaSelecionada = !!novaOperacao.janelaId;
  const isFormDisabled = !isJanelaSelecionada || loading;
  const isFormValid = selectedDates.length > 0 && isJanelaSelecionada && novaOperacao.modalidade;

  // ✅ CRIAR OPERAÇÕES (UMA OU MÚLTIPLAS)
  const criarOperacoes = async () => {
    if (!novaOperacao.janelaId || selectedDates.length === 0 || !novaOperacao.modalidade) {
      alert('Preencha todos os campos: janela, data(s) e modalidade.');
      return;
    }

    setLoading(true);
    try {
      const operacoesCriadas = [];
      const operacoesComErro = [];

      // Criar operações sequencialmente
      for (const data of selectedDates) {
        try {
          const response = await fetch('/api/supervisor/operacoes', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              ...getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
            },
            body: JSON.stringify({
              ...novaOperacao,
              data: data
            })
          });

          const result = await response.json();
          
          if (result.success) {
            operacoesCriadas.push(data);
          } else {
            operacoesComErro.push({ data, error: result.error });
          }
        } catch (error) {
          operacoesComErro.push({ data, error: 'Erro de conexão' });
        }
      }

      // Mostrar apenas erros se houver
      if (operacoesComErro.length > 0) {
        const mensagem = `${operacoesComErro.length} operação(ões) falharam. Primeira falha: ${operacoesComErro[0].error}`;
        alert(mensagem);
      }

      // Limpar seleções
      setSelectedDates([]);
      setNovaOperacao({
        janelaId: '',
        modalidade: '',
        tipo: 'PLANEJADA',
        turno: '',
        limite: 15
      });
      
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Erro ao criar operações:', error);
      alert('Erro de conexão. Não foi possível criar as operações.');
    } finally {
      setLoading(false);
    }
  };

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
        maxWidth: 'min(98vw, 750px)',
        maxHeight: 'min(95vh, 800px)',
        minHeight: 'min(350px, 75vh)',
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
          background: 'linear-gradient(135deg, var(--danger) 0%, #ef4444 100%)',
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
            Nova Operação
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
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
          {loadingJanelas ? (
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
                Carregando janelas operacionais...
              </p>
            </div>
          ) : (
            <>
              {/* Janela Operacional */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: 'clamp(0.25rem, 0.75vw, 0.375rem)'
                }}>
                  Janela Operacional *
                </label>
                <select
                  value={novaOperacao.janelaId}
                  onChange={(e) => {
                    const janelaId = e.target.value;
                    setNovaOperacao(prev => ({ ...prev, janelaId }));
                    carregarLimitesJanela(janelaId);
                  }}
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: 'clamp(0.625rem, 1.5vw, 0.875rem)',
                    fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                    border: '2px solid var(--border-color)',
                    borderRadius: 'clamp(8px, 2vw, 12px)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-primary)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.2s ease',
                    outline: 'none',
                    minHeight: 'clamp(2.5rem, 5vw, 2.875rem)'
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
                >
                  <option value="">Selecione uma janela operacional</option>
                  {janelas.map((janela) => (
                    <option key={janela.id} value={janela.id}>
                      Janela #{janela.id} ({formatarDataBR(janela.dataInicio)} - {formatarDataBR(janela.dataFim)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid com campos principais */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 'clamp(0.75rem, 2vw, 1rem)' }}>
                {/* Data da Operação */}
                <div style={{ position: 'relative' }}>
                  <label style={{
                    display: 'block',
                    fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'clamp(0.25rem, 0.75vw, 0.375rem)'
                  }}>
                    Data da Operação *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      value={selectedDates.length === 0 ? '' : selectedDates.length === 1 ? formatarDataBR(selectedDates[0]) : `${selectedDates.length} datas selecionadas`}
                      onClick={() => !isFormDisabled && setShowDatePicker(true)}
                      readOnly
                      disabled={isFormDisabled}
                      placeholder={isJanelaSelecionada ? "Clique para selecionar data" : "Selecione uma janela primeiro"}
                      style={{
                        width: '100%',
                        padding: 'clamp(0.75rem, 2vw, 0.875rem) 2.5rem clamp(0.75rem, 2vw, 0.875rem) clamp(0.75rem, 2vw, 0.875rem)',
                        fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                        border: `2px solid ${selectedDates.length > 0 ? 'var(--primary)' : 'var(--border-color)'}`,
                        borderRadius: '12px',
                        cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                        background: isFormDisabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
                        color: isFormDisabled ? 'var(--text-disabled)' : selectedDates.length > 0 ? 'var(--primary)' : 'var(--text-secondary)',
                        fontWeight: selectedDates.length > 0 ? 600 : 500,
                        transition: 'all 0.2s ease',
                        outline: 'none',
                        boxShadow: selectedDates.length > 0 ? '0 0 0 3px var(--primary-light)' : 'none'
                      }}
                      onFocus={(e) => {
                        if (!isFormDisabled) {
                          e.target.style.borderColor = 'var(--primary)';
                          e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                        }
                      }}
                      onBlur={(e) => {
                        if (selectedDates.length === 0) {
                          e.target.style.borderColor = 'var(--border-color)';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    />
                    <div style={{
                      position: 'absolute',
                      right: '1rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      pointerEvents: 'none'
                    }}>
                      <svg style={{ width: '1.5rem', height: '1.5rem', color: 'var(--text-secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  </div>
                  {limitesJanela.periodoPermitido && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.5rem',
                      fontWeight: 500
                    }}>
                      📅 Período: {formatarDataBR(limitesJanela.periodoPermitido.dataInicio)} - {formatarDataBR(limitesJanela.periodoPermitido.dataFim)}
                    </p>
                  )}

                  {/* Calendário popup */}
                  {showDatePicker && (
                    <>
                      <div 
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          zIndex: 1040
                        }}
                        onClick={() => setShowDatePicker(false)}
                      />
                      <div 
                        style={{
                          position: 'fixed',
                          top: '40%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 1050
                        }}
                      >
                        <MultiDateCalendar
                          selectedDates={selectedDates}
                          onDatesChange={setSelectedDates}
                          minDate={limitesJanela.periodoPermitido?.dataInicio}
                          maxDate={limitesJanela.periodoPermitido?.dataFim}
                          onApply={() => {
                            setShowDatePicker(false);
                          }}
                          onCancel={() => {
                            setShowDatePicker(false);
                            setSelectedDates([]);
                          }}
                          disabled={loading}
                          className=""
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Modalidade */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'clamp(0.25rem, 0.75vw, 0.375rem)'
                  }}>
                    Modalidade *
                  </label>
                  <select
                    value={novaOperacao.modalidade}
                    onChange={(e) => setNovaOperacao(prev => ({ ...prev, modalidade: e.target.value }))}
                    disabled={isFormDisabled || limitesJanela.configuracaoHerdada?.modalidadeUnica !== null}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.75rem, 2vw, 0.875rem)',
                      fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                      border: `2px solid ${novaOperacao.modalidade ? 'var(--primary)' : 'var(--border-color)'}`,
                      borderRadius: '12px',
                      background: 'var(--bg-card)',
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      color: 'var(--text-primary)',
                      fontWeight: novaOperacao.modalidade ? 600 : 500,
                      transition: 'all 0.2s ease',
                      outline: 'none',
                      boxShadow: novaOperacao.modalidade ? '0 0 0 3px var(--primary-light)' : 'none'
                    }}
                    onFocus={(e) => {
                      if (!isFormDisabled) {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                      }
                    }}
                    onBlur={(e) => {
                      if (!novaOperacao.modalidade) {
                        e.target.style.borderColor = 'var(--border-color)';
                        e.target.style.boxShadow = 'none';
                      }
                    }}
                  >
                    <option value="">{isJanelaSelecionada ? "Selecione a modalidade" : "Selecione uma janela primeiro"}</option>
                    {(!limitesJanela.modalidadesPermitidas || limitesJanela.modalidadesPermitidas.includes('BLITZ')) && (
                      <option value="BLITZ">BLITZ</option>
                    )}
                    {(!limitesJanela.modalidadesPermitidas || limitesJanela.modalidadesPermitidas.includes('BALANCA')) && (
                      <option value="BALANCA">BALANÇA</option>
                    )}
                  </select>
                  {limitesJanela.modalidadesPermitidas && (
                    <p style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.5rem',
                      fontWeight: 500
                    }}>
                      🏷️ Disponíveis: {limitesJanela.modalidadesPermitidas.join(', ')}
                      {limitesJanela.configuracaoHerdada?.modalidadeUnica && ' (seleção automática)'}
                    </p>
                  )}
                </div>
              </div>

              {/* Grid com 3 colunas - campos secundários */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'clamp(0.5rem, 1.5vw, 0.75rem)' }}>
                {/* Tipo */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'clamp(0.75rem, 1.8vw, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'clamp(0.25rem, 0.5vw, 0.375rem)'
                  }}>
                    Tipo
                  </label>
                  <select
                    value={novaOperacao.tipo}
                    onChange={(e) => setNovaOperacao(prev => ({ ...prev, tipo: e.target.value }))}
                    disabled={isFormDisabled}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.625rem, 1.5vw, 0.75rem)',
                      fontSize: 'clamp(0.75rem, 1.8vw, 0.8rem)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '12px',
                      background: isFormDisabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      color: isFormDisabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      if (!isFormDisabled) {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="PLANEJADA">📋 PLANEJADA</option>
                    <option value="VOLUNTARIA">🙋 VOLUNTÁRIA</option>
                  </select>
                </div>

                {/* Turno */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'clamp(0.75rem, 1.8vw, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'clamp(0.25rem, 0.5vw, 0.375rem)'
                  }}>
                    Turno (opcional)
                  </label>
                  <select
                    value={novaOperacao.turno}
                    onChange={(e) => setNovaOperacao(prev => ({ ...prev, turno: e.target.value }))}
                    disabled={isFormDisabled}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.625rem, 1.5vw, 0.75rem)',
                      fontSize: 'clamp(0.75rem, 1.8vw, 0.8rem)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '12px',
                      background: isFormDisabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      color: isFormDisabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      if (!isFormDisabled) {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    <option value="">Não especificado</option>
                    <option value="MANHA">🌅 MANHÃ</option>
                    <option value="TARDE">🌇 TARDE</option>
                    <option value="NOITE">🌙 NOITE</option>
                  </select>
                </div>

                {/* Limite */}
                <div>
                  <label style={{
                    display: 'block',
                    fontSize: 'clamp(0.75rem, 1.8vw, 0.875rem)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: 'clamp(0.25rem, 0.5vw, 0.375rem)'
                  }}>
                    Limite
                  </label>
                  <select
                    value={novaOperacao.limite}
                    onChange={(e) => setNovaOperacao(prev => ({ ...prev, limite: parseInt(e.target.value) }))}
                    disabled={isFormDisabled}
                    style={{
                      width: '100%',
                      padding: 'clamp(0.625rem, 1.5vw, 0.75rem)',
                      fontSize: 'clamp(0.75rem, 1.8vw, 0.8rem)',
                      border: '2px solid var(--border-color)',
                      borderRadius: '12px',
                      background: isFormDisabled ? 'var(--bg-secondary)' : 'var(--bg-card)',
                      cursor: isFormDisabled ? 'not-allowed' : 'pointer',
                      color: isFormDisabled ? 'var(--text-disabled)' : 'var(--text-primary)',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onFocus={(e) => {
                      if (!isFormDisabled) {
                        e.target.style.borderColor = 'var(--primary)';
                        e.target.style.boxShadow = '0 0 0 3px var(--primary-light)';
                      }
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--border-color)';
                      e.target.style.boxShadow = 'none';
                    }}
                  >
                    {Array.from({ 
                      length: (limitesJanela.limitesParticipantes?.maximo || 30) - (limitesJanela.limitesParticipantes?.minimo || 2) + 1 
                    }, (_, i) => (limitesJanela.limitesParticipantes?.minimo || 2) + i).map(num => (
                      <option key={num} value={num}>{num} participantes</option>
                    ))}
                  </select>
                  {limitesJanela.limitesParticipantes && (
                    <p style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-secondary)',
                      marginTop: '0.5rem',
                      fontWeight: 500
                    }}>
                      👥 Faixa: {limitesJanela.limitesParticipantes.minimo} - {limitesJanela.limitesParticipantes.maximo}
                      {limitesJanela.limitesParticipantes.padrao && ` (padrão: ${limitesJanela.limitesParticipantes.padrao})`}
                    </p>
                  )}
                </div>
              </div>

              {/* Avisos e Feedbacks - removido o aviso excessivo */}

              {selectedDates.length > 0 && (
                <div style={{
                  background: 'linear-gradient(135deg, var(--success-light) 0%, rgba(52, 211, 153, 0.1) 100%)',
                  border: '2px solid var(--success)',
                  borderRadius: '12px',
                  padding: '1rem'
                }}>
                  <p style={{
                    fontSize: 'clamp(0.875rem, 2vw, 0.9rem)',
                    color: 'var(--success-dark)',
                    fontWeight: 600,
                    margin: 0,
                    marginBottom: '0.5rem'
                  }}>
                    ✅ {selectedDates.length} data{selectedDates.length > 1 ? 's' : ''} selecionada{selectedDates.length > 1 ? 's' : ''}
                  </p>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--success-dark)',
                    margin: 0,
                    fontWeight: 500
                  }}>
                    Preencha os demais campos e clique em "Criar" para gerar {selectedDates.length === 1 ? 'a operação' : 'as operações'}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'clamp(0.75rem, 2vw, 1rem)',
          padding: 'clamp(0.875rem, 2.5vw, 1.25rem)',
          borderTop: '2px solid var(--border-color)',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: 'clamp(0.625rem, 1.5vw, 0.75rem) clamp(1rem, 2.5vw, 1.25rem)',
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 500,
              fontSize: 'clamp(0.875rem, 2vw, 0.9rem)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              opacity: 0.8
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.opacity = '1';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.opacity = '0.8';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={criarOperacoes}
            disabled={loading || selectedDates.length === 0 || !isJanelaSelecionada || !novaOperacao.modalidade}
            style={{
              padding: 'clamp(0.625rem, 1.5vw, 0.75rem) clamp(1.25rem, 3vw, 1.75rem)',
              background: isFormValid && !loading 
                ? 'var(--danger)' 
                : 'var(--text-disabled)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: 'clamp(0.875rem, 2vw, 0.9rem)',
              cursor: isFormValid && !loading ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              boxShadow: isFormValid && !loading 
                ? '0 4px 12px rgba(220, 38, 38, 0.3)' 
                : 'none',
              transform: 'translateY(0)'
            }}
            onMouseEnter={(e) => {
              if (isFormValid && !loading) {
                e.currentTarget.style.background = 'var(--danger-dark)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(220, 38, 38, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (isFormValid && !loading) {
                e.currentTarget.style.background = 'var(--danger)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.3)';
              }
            }}
          >
            {loading ? 'Criando...' : 
             !isJanelaSelecionada ? '🚫 Selecione uma Janela' :
             selectedDates.length === 0 ? '📅 Selecione uma Data' :
             !novaOperacao.modalidade ? '🏷️ Selecione Modalidade' :
             selectedDates.length <= 1 ? 'Criar Operação' : `Criar ${selectedDates.length} Operações`}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        @keyframes slideUp {
          from { 
            opacity: 0; 
            transform: translate3d(0, 40px, 0); 
          }
          to { 
            opacity: 1; 
            transform: translate3d(0, 0, 0); 
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

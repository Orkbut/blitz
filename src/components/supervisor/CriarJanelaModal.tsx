'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { MultiDateCalendar } from './MultiDateCalendar';
import { getSupervisorContext, getSupervisorHeaders, getSupervisorData } from '@/lib/auth-utils';

interface CriarJanelaModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const CriarJanelaModal: React.FC<CriarJanelaModalProps> = ({ onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [novaJanela, setNovaJanela] = useState({
    periodo: [] as string[], // Array de datas do intervalo selecionado
    modalidades: [] as string[],
    limiteMaximo: 30
  });
  const [parametros, setParametros] = useState({
    prazoMinAgendamento: 10, // Valor padrão, será carregado do banco
    prazoMaxPeriodo: 40
  });

  // ✅ NOVO: Carregar parâmetros do banco de dados
  const carregarParametros = async () => {
    try {
      const response = await fetch('/api/admin/parametros');
      const data = await response.json();
      
      if (data.success) {
        const parametrosMap = data.data.reduce((acc: any, param: any) => {
          acc[param.chave] = param.valor;
          return acc;
        }, {});
        
        setParametros({
          prazoMinAgendamento: parseInt(parametrosMap.PRAZO_MIN_AGENDAMENTO_JANELAS) || 10,
          prazoMaxPeriodo: parseInt(parametrosMap.PRAZO_MAX_PERIODO_JANELA) || 40
        });
      }
    } catch (error) {
      // Manter valores padrão em caso de erro
    }
  };

  // ✅ CALCULAR DATAS BLOQUEADAS (USAR PARÂMETRO DO BANCO)
  const getBlockedDates = () => {
    const hoje = new Date();
    const blockedDates: string[] = [];
    
    for (let i = 0; i < parametros.prazoMinAgendamento; i++) {
      const data = new Date(hoje);
      data.setDate(hoje.getDate() + i);
      blockedDates.push(data.toISOString().split('T')[0]);
    }
    
    return blockedDates;
  };

  // ✅ NOVO: Calcular data mínima permitida (hoje + parâmetro)
  const getMinDate = () => {
    const hoje = new Date();
    const dataMinima = new Date(hoje);
    dataMinima.setDate(hoje.getDate() + parametros.prazoMinAgendamento);
    // ✅ CORRIGIDO: Garantir formato correto YYYY-MM-DD no timezone local
    return dataMinima.toISOString().split('T')[0];
  };

  // ✅ NOVO: Calcular data máxima permitida (minDate + parâmetro para permitir navegação)
  const getMaxDate = () => {
    const hoje = new Date();
    const dataMaxima = new Date(hoje);
    dataMaxima.setDate(hoje.getDate() + parametros.prazoMinAgendamento + parametros.prazoMaxPeriodo);
    return dataMaxima.toISOString().split('T')[0];
  };

  // ✅ NOVO: Carregar parâmetros ao abrir o modal
  useEffect(() => {
    carregarParametros();
  }, []);

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

  const criarJanelaOperacional = async () => {
    if (novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0) {
      alert('Preencha todos os campos obrigatórios: período e modalidades.');
      return;
    }

    setLoading(true);
    try {
      // ✅ DEBUG: Verificar dados do supervisor antes de enviar
      const supervisorData = getSupervisorData();
      const headers = getSupervisorHeaders();
      
      // Debug silencioso
      
      // ✅ CORRIGIDO: Garantir datas corretas no timezone de Iguatu-CE
      const dataInicioFormatada = novaJanela.periodo[0]; // Já está em formato YYYY-MM-DD
      const dataFimFormatada = novaJanela.periodo[novaJanela.periodo.length - 1];

      const response = await fetch('/api/supervisor/janelas-operacionais', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...getSupervisorHeaders() // ✅ CORREÇÃO: Incluir contexto do supervisor
        },
        body: JSON.stringify({
          dataInicio: dataInicioFormatada, // Mantém formato YYYY-MM-DD sem timezone
          dataFim: dataFimFormatada,
          modalidades: novaJanela.modalidades,
          limiteMin: 2,
          limiteMax: novaJanela.limiteMaximo
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Janela operacional criada com sucesso!');
        setNovaJanela({
          periodo: [],
          modalidades: [],
          limiteMaximo: 30
        });
        onSuccess();
        onClose();
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (error) {
      alert('Erro de conexão. Não foi possível criar a janela operacional.');
    } finally {
      setLoading(false);
    }
  };

  const handleModalidadeChange = (modalidade: string) => {
    setNovaJanela(prev => ({
      ...prev,
      modalidades: prev.modalidades.includes(modalidade)
        ? prev.modalidades.filter(m => m !== modalidade)
        : [...prev.modalidades, modalidade]
    }));
  };

  // ✅ FUNÇÃO PARA FORMATAR DATA NO PADRÃO BRASILEIRO
  const formatarDataBR = (dataISO: string): string => {
    if (!dataISO) return '';
    try {
      const [ano, mes, dia] = dataISO.split('T')[0].split('-');
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataISO;
    }
  };

  // ✅ FUNÇÃO PARA FORMATAR PERÍODO SELECIONADO
  const formatarPeriodo = (): string => {
    if (novaJanela.periodo.length === 0) return '';
    if (novaJanela.periodo.length === 1) return formatarDataBR(novaJanela.periodo[0]);
    
    const inicio = formatarDataBR(novaJanela.periodo[0]);
    const fim = formatarDataBR(novaJanela.periodo[novaJanela.periodo.length - 1]);
    return `${inicio} até ${fim}`;
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
      padding: '1rem',
      zIndex: 1000,
      animation: 'fadeIn 0.2s ease',
      overflow: 'hidden',
      overscrollBehavior: 'contain',
      touchAction: 'none'
    }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '20px',
        width: '100%',
        maxWidth: 'min(95vw, 520px)',
        maxHeight: 'min(90vh, auto)',
        height: 'auto',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'var(--shadow-xl)',
        border: '1px solid var(--border-color)',
        animation: 'slideUp 0.3s ease',
        overflow: 'hidden',
        overscrollBehavior: 'contain',
        touchAction: 'pan-y'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.75rem',
          background: 'var(--primary)',
          color: 'white',
          minHeight: '70px',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            margin: 0,
            flexShrink: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
          }}>
            📅 Nova Janela Operacional
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0.75rem',
              borderRadius: '12px',
              transition: 'all 0.2s ease'
            }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Conteúdo */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
        }}>
          {/* Período Operacional */}
          <div style={{ position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Período Operacional *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formatarPeriodo()}
                onClick={() => !loading && setShowDatePicker(true)}
                readOnly
                disabled={loading}
                placeholder="Clique para selecionar o período operacional"
                aria-label="Período operacional - clique para abrir calendário"
                style={{
                  width: '100%',
                  padding: '1rem 3rem 1rem 1rem',
                  border: `2px solid ${formatarPeriodo() ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  fontSize: '1rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-card)',
                  color: loading ? 'var(--text-disabled)' : formatarPeriodo() ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: formatarPeriodo() ? 600 : 500,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  boxShadow: formatarPeriodo() ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
                  height: '3.25rem',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  if (!loading) {
                    e.target.style.borderColor = 'var(--primary)';
                    e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                    e.target.style.outline = '2px solid var(--primary)';
                    e.target.style.outlineOffset = '2px';
                  }
                }}
                onBlur={(e) => {
                  if (!formatarPeriodo()) {
                    e.target.style.borderColor = 'var(--border-color)';
                    e.target.style.boxShadow = 'none';
                  }
                  e.target.style.outline = 'none';
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
                    selectedDates={novaJanela.periodo}
                    onDatesChange={(dates) => {
                      setNovaJanela(prev => ({ ...prev, periodo: dates }));
                    }}
                    minDate={getMinDate()}
                    maxDate={getMaxDate()}
                    blockedDates={getBlockedDates()}
                    rangeMode={true}
                    onApply={() => {
                      setShowDatePicker(false);
                    }}
                    onCancel={() => {
                      setShowDatePicker(false);
                    }}
                    disabled={loading}
                    className=""
                  />
                </div>
              </>
            )}
          </div>

          {/* Modalidades */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Modalidades *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {['BLITZ', 'BALANCA'].map((modalidade) => (
                <label key={modalidade} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  color: novaJanela.modalidades.includes(modalidade) ? 'var(--primary)' : 'var(--text-primary)',
                  fontWeight: 600,
                  padding: '1rem',
                  border: `2px solid ${novaJanela.modalidades.includes(modalidade) ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: '12px',
                  background: novaJanela.modalidades.includes(modalidade) 
                    ? 'rgba(59, 130, 246, 0.1)' 
                    : 'white',
                  transition: 'all 0.2s ease',
                  boxShadow: novaJanela.modalidades.includes(modalidade) ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
                  opacity: loading ? 0.6 : 1,
                  minHeight: '3.25rem'
                }}
                onMouseEnter={(e) => {
                  if (!loading && !novaJanela.modalidades.includes(modalidade)) {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.background = 'rgba(59, 130, 246, 0.05)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !novaJanela.modalidades.includes(modalidade)) {
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                    e.currentTarget.style.background = 'var(--bg-card)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onFocus={(e) => {
                  e.currentTarget.style.outline = '2px solid var(--primary)';
                  e.currentTarget.style.outlineOffset = '2px';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.outline = 'none';
                }}
                tabIndex={loading ? -1 : 0}
                role="checkbox"
                aria-checked={novaJanela.modalidades.includes(modalidade)}
                aria-disabled={loading}
                >
                  <input
                    type="checkbox"
                    checked={novaJanela.modalidades.includes(modalidade)}
                    onChange={() => handleModalidadeChange(modalidade)}
                    disabled={loading}
                    aria-label={`Modalidade ${modalidade === 'BLITZ' ? 'Blitz' : 'Balança'}`}
                    style={{ 
                      marginRight: '0.75rem', 
                      width: '18px', 
                      height: '18px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      accentColor: 'var(--primary)'
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <span style={{ 
                      fontWeight: 600,
                      fontSize: '1rem',
                      color: 'inherit'
                    }}>
                      {modalidade === 'BLITZ' ? 'BLITZ' : 'BALANÇA'}
                    </span>
                    <span style={{
                      fontSize: '0.875rem',
                      opacity: 0.8,
                      fontWeight: 400
                    }}>
                      {modalidade === 'BLITZ' ? 'Operações de fiscalização' : 'Operações de pesagem'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Limite Máximo de Participantes */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Limite Máximo de Participantes
            </label>
            <input
              type="number"
              value={novaJanela.limiteMaximo}
              onChange={(e) => setNovaJanela(prev => ({ ...prev, limiteMaximo: parseInt(e.target.value) || 30 }))}
              min="5"
              max="50"
              disabled={loading}
              aria-label="Limite máximo de participantes"
              style={{
                width: '100%',
                padding: '1rem',
                border: '2px solid var(--border-color)',
                borderRadius: '12px',
                fontSize: '1rem',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                outline: 'none',
                transition: 'all 0.2s ease',
                cursor: loading ? 'not-allowed' : 'text',
                height: '3.25rem',
                boxSizing: 'border-box',
                MozAppearance: 'textfield',
                WebkitAppearance: 'none'
              }}
              onFocus={(e) => {
                if (!loading) {
                  e.target.style.borderColor = 'var(--primary)';
                  e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.2)';
                  e.target.style.outline = '2px solid var(--primary)';
                  e.target.style.outlineOffset = '2px';
                }
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border-color)';
                e.target.style.boxShadow = 'none';
                e.target.style.outline = 'none';
              }}
            />

          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
                      gap: '1rem',
            padding: '1.5rem',
          borderTop: '2px solid var(--border-color)',
          flexShrink: 0
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Cancelar criação da janela operacional"
            style={{
              padding: '0.875rem 1.5rem',
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              borderRadius: '12px',
              fontWeight: 500,
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minHeight: '3rem'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--bg-hover)';
                e.currentTarget.style.borderColor = 'var(--text-secondary)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = 'var(--bg-secondary)';
                e.currentTarget.style.borderColor = 'var(--border-color)';
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--primary)';
              e.currentTarget.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={criarJanelaOperacional}
            disabled={loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0}
            aria-label="Criar nova janela operacional"
            aria-disabled={loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0}
            style={{
              padding: '0.875rem 2rem',
              background: (loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0) 
                ? '#94a3b8' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '1rem',
              cursor: (loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0) 
                ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              boxShadow: (loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0) 
                ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              transform: 'translateY(0)',
              minHeight: '3rem',
              opacity: (loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0) ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!(loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0)) {
                e.currentTarget.style.background = 'var(--primary-dark)';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!(loading || novaJanela.periodo.length === 0 || novaJanela.modalidades.length === 0)) {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid white';
              e.currentTarget.style.outlineOffset = '2px';
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none';
            }}
          >
            {loading ? 'Criando...' : 'Criar Janela'}
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
      `}</style>

      <style>
        {`
          /* Removendo spinners do input number */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          
          /* Firefox */
          input[type="number"] {
            -moz-appearance: textfield;
          }
          
          /* Melhorando foco visível em labels */
          label:focus-visible {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
            border-radius: 12px;
          }
          
          /* Acessibilidade para checkboxes */
          input[type="checkbox"]:focus-visible {
            outline: 2px solid var(--primary);
            outline-offset: 2px;
          }
        `}
      </style>
    </div>
  );
}; 
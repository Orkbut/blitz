'use client';

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock } from 'lucide-react';
import { MultiDateCalendar } from './MultiDateCalendar';
import { getSupervisorHeaders, formatarDataBR } from '@/lib/auth-utils';

interface EditarJanelaModalProps {
  janela: {
    id: number;
    dataInicio: string;
    dataFim: string;
    modalidades: string[];
    limiteMin: number;
    limiteMax: number;
    operacoesCriadas: number;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export const EditarJanelaModal: React.FC<EditarJanelaModalProps> = ({ 
  janela, 
  onClose, 
  onSuccess 
}) => {
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [janelaEditada, setJanelaEditada] = useState({
    periodo: [] as string[], // Array de datas do intervalo selecionado
    limiteMaximo: janela.limiteMax || 30
  });
  const [parametros, setParametros] = useState({
    prazoMinAgendamento: 10 // Valor padrão, será carregado do banco
  });

  // ✅ Carregar parâmetros do banco de dados
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
          prazoMinAgendamento: parseInt(parametrosMap.PRAZO_MIN_AGENDAMENTO_JANELAS) || 10
        });
      }
    } catch (error) {
      // Manter valores padrão em caso de erro
    }
  };

  // ✅ Inicializar com dados da janela atual
  useEffect(() => {
    carregarParametros();
    
    // ✅ CORREÇÃO: Criar array de datas do período atual com timezone correto
    // Adicionar horário para evitar problemas de timezone
    const dataInicio = new Date(`${janela.dataInicio}T12:00:00`);
    const dataFim = new Date(`${janela.dataFim}T12:00:00`);
    const periodo = [];
    
    let currentDate = new Date(dataInicio);
    while (currentDate <= dataFim) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const day = currentDate.getDate().toString().padStart(2, '0');
      periodo.push(`${year}-${month}-${day}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    setJanelaEditada({
      periodo,
      limiteMaximo: janela.limiteMax || 30
    });
  }, [janela]);

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

  // ✅ Calcular data mínima permitida (hoje + parâmetro)
  const getMinDate = () => {
    const hoje = new Date();
    const dataMinima = new Date(hoje);
    dataMinima.setDate(hoje.getDate() + parametros.prazoMinAgendamento);
    return dataMinima.toISOString().split('T')[0];
  };

  // ✅ Permitir período muito maior (2 anos no futuro)
  const getMaxDate = () => {
    const hoje = new Date();
    const dataMaxima = new Date(hoje);
    dataMaxima.setDate(hoje.getDate() + 730);
    return dataMaxima.toISOString().split('T')[0];
  };

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

  const editarJanelaOperacional = async () => {
    if (janelaEditada.periodo.length === 0) {
      alert('Selecione o novo período da janela operacional.');
      return;
    }

    setLoading(true);
    try {
      const dataInicioFormatada = janelaEditada.periodo[0];
      const dataFimFormatada = janelaEditada.periodo[janelaEditada.periodo.length - 1];

      const response = await fetch(`/api/supervisor/janelas-operacionais/${janela.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...getSupervisorHeaders()
        },
        body: JSON.stringify({
          dataInicio: dataInicioFormatada,
          dataFim: dataFimFormatada,
          limiteMax: janelaEditada.limiteMaximo
        })
      });

      const result = await response.json();
      
      if (result.success) {
        alert('Janela operacional atualizada com sucesso!');
        onSuccess();
        onClose();
      } else {
        alert(`Erro: ${result.error}`);
      }
    } catch (error) {
      alert('Erro de conexão. Não foi possível atualizar a janela operacional.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ FUNÇÃO PARA FORMATAR PERÍODO SELECIONADO
  const formatarPeriodo = (): string => {
    if (janelaEditada.periodo.length === 0) return '';
    if (janelaEditada.periodo.length === 1) return formatarDataBR(janelaEditada.periodo[0]);
    
    const inicio = formatarDataBR(janelaEditada.periodo[0]);
    const fim = formatarDataBR(janelaEditada.periodo[janelaEditada.periodo.length - 1]);
    return `${inicio} até ${fim}`;
  };

  // ✅ Verificar se houve mudanças
  const houveAlteracoes = () => {
    const periodoOriginal = [];
    // ✅ CORREÇÃO: Adicionar horário para evitar problemas de timezone
    const dataInicio = new Date(`${janela.dataInicio}T12:00:00`);
    const dataFim = new Date(`${janela.dataFim}T12:00:00`);
    
    let currentDate = new Date(dataInicio);
    while (currentDate <= dataFim) {
      const year = currentDate.getFullYear();
      const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
      const day = currentDate.getDate().toString().padStart(2, '0');
      periodoOriginal.push(`${year}-${month}-${day}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const periodoMudou = JSON.stringify(periodoOriginal.sort()) !== JSON.stringify(janelaEditada.periodo.sort());
    const limiteMudou = janelaEditada.limiteMaximo !== janela.limiteMax;
    
    return periodoMudou || limiteMudou;
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
        borderRadius: 'clamp(12px, 3vw, 20px)',
        width: '100%',
        maxWidth: 'min(98vw, 520px)',
        maxHeight: 'min(95vh, 800px)',
        minHeight: 'min(400px, 80vh)',
        height: 'auto',
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
          background: 'var(--primary)',
          color: 'white',
          minHeight: 'clamp(50px, 8vw, 60px)',
          flexShrink: 0
        }}>
          <h2 style={{
            fontSize: 'clamp(1rem, 3.5vw, 1.25rem)',
            fontWeight: '700',
            margin: 0,
            flexShrink: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
            lineHeight: 1.2
          }}>
            ✏️ Editar Janela #{janela.id}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: '12px',
              transition: 'all 0.2s ease'
            }}
          >
            <X size={20} />
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
          
          {/* Informações da Janela Atual */}
          <div style={{
            padding: 'clamp(0.75rem, 2vw, 1rem)',
            background: 'var(--bg-secondary)',
            borderRadius: 'clamp(8px, 2vw, 12px)',
            border: '1px solid var(--border-color)'
          }}>
            <h3 style={{
              fontSize: 'clamp(0.9rem, 2.5vw, 1rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 0.5rem 0'
            }}>
              📋 Dados Atuais
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <p style={{ margin: 0, fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: 'var(--text-secondary)' }}>
                <strong>Período:</strong> {formatarDataBR(janela.dataInicio)} - {formatarDataBR(janela.dataFim)}
              </p>
              <p style={{ margin: 0, fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: 'var(--text-secondary)' }}>
                <strong>Modalidades:</strong> {janela.modalidades.join(', ')}
              </p>
              <p style={{ margin: 0, fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', color: 'var(--text-secondary)' }}>
                <strong>Operações criadas:</strong> {janela.operacoesCriadas}
              </p>
            </div>
          </div>

          {/* Novo Período Operacional */}
          <div style={{ position: 'relative' }}>
            <label style={{
              display: 'block',
              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'clamp(0.25rem, 0.5vw, 0.375rem)'
            }}>
              📅 Novo Período Operacional *
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={formatarPeriodo()}
                onClick={() => !loading && setShowDatePicker(true)}
                readOnly
                disabled={loading}
                placeholder="Clique para selecionar o novo período"
                style={{
                  width: '100%',
                  padding: 'clamp(0.5rem, 1.5vw, 0.75rem) clamp(2rem, 4vw, 2.5rem) clamp(0.5rem, 1.5vw, 0.75rem) clamp(0.5rem, 1.5vw, 0.75rem)',
                  border: `2px solid ${formatarPeriodo() ? 'var(--primary)' : 'var(--border-color)'}`,
                  borderRadius: 'clamp(8px, 2vw, 12px)',
                  fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-card)',
                  color: loading ? 'var(--text-disabled)' : formatarPeriodo() ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: formatarPeriodo() ? 600 : 500,
                  transition: 'all 0.2s ease',
                  outline: 'none',
                  boxShadow: formatarPeriodo() ? '0 0 0 3px rgba(59, 130, 246, 0.2)' : 'none',
                  height: 'clamp(2.25rem, 4vw, 2.75rem)',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                position: 'absolute',
                right: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none'
              }}>
                <Calendar style={{ width: 'clamp(1rem, 2.5vw, 1.25rem)', height: 'clamp(1rem, 2.5vw, 1.25rem)', color: 'var(--text-secondary)' }} />
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
                    top: 'clamp(30%, 40vh, 40%)',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1050,
                    maxWidth: '95vw',
                    maxHeight: '80vh'
                  }}
                >
                  <MultiDateCalendar
                    selectedDates={janelaEditada.periodo}
                    onDatesChange={(dates) => {
                      setJanelaEditada(prev => ({ ...prev, periodo: dates }));
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

          {/* Limite Máximo de Participantes */}
          <div>
            <label style={{
              display: 'block',
              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 'clamp(0.25rem, 0.5vw, 0.375rem)'
            }}>
              👥 Limite Máximo de Participantes
            </label>
            <input
              type="number"
              value={janelaEditada.limiteMaximo}
              onChange={(e) => setJanelaEditada(prev => ({ ...prev, limiteMaximo: parseInt(e.target.value) || 30 }))}
              min="5"
              max="50"
              disabled={loading}
              style={{
                width: '100%',
                padding: 'clamp(0.5rem, 1.5vw, 0.75rem)',
                border: '2px solid var(--border-color)',
                borderRadius: 'clamp(8px, 2vw, 12px)',
                fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
                textAlign: 'center',
                fontWeight: 600,
                color: 'var(--text-primary)',
                background: 'var(--bg-card)',
                outline: 'none',
                transition: 'all 0.2s ease',
                cursor: loading ? 'not-allowed' : 'text',
                height: 'clamp(2.25rem, 4vw, 2.75rem)',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Aviso sobre operações existentes */}
          {janela.operacoesCriadas > 0 && (
            <div style={{
              padding: 'clamp(0.75rem, 2vw, 1rem)',
              background: 'var(--warning-light)',
              borderRadius: 'clamp(8px, 2vw, 12px)',
              border: '1px solid var(--warning)',
              display: 'flex',
              alignItems: 'start',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' }}>⚠️</span>
              <div>
                <p style={{ 
                  margin: '0 0 0.25rem 0', 
                  fontSize: 'clamp(0.8rem, 2vw, 0.9rem)', 
                  fontWeight: 600,
                  color: 'var(--warning-dark)' 
                }}>
                  Atenção: Janela com operações
                </p>
                <p style={{ 
                  margin: 0, 
                  fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)', 
                  color: 'var(--warning-dark)',
                  lineHeight: 1.4
                }}>
                  Esta janela possui {janela.operacoesCriadas} operação(ões) criada(s). 
                  Alterar o período pode afetar operações existentes.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 'clamp(0.5rem, 1.5vw, 0.75rem)',
          padding: 'clamp(0.75rem, 2vw, 1rem)',
          borderTop: '2px solid var(--border-color)',
          flexShrink: 0,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: 'clamp(0.5rem, 1.5vw, 0.625rem) clamp(0.75rem, 2vw, 1rem)',
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              border: '2px solid var(--border-color)',
              borderRadius: 'clamp(8px, 2vw, 12px)',
              fontWeight: 500,
              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              minHeight: 'clamp(2rem, 4vw, 2.5rem)',
              flex: '0 1 auto'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={editarJanelaOperacional}
            disabled={loading || janelaEditada.periodo.length === 0 || !houveAlteracoes()}
            style={{
              padding: 'clamp(0.5rem, 1.5vw, 0.625rem) clamp(1rem, 3vw, 1.25rem)',
              background: (loading || janelaEditada.periodo.length === 0 || !houveAlteracoes()) 
                ? '#94a3b8' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'clamp(8px, 2vw, 12px)',
              fontWeight: 600,
              fontSize: 'clamp(0.8rem, 2vw, 0.9rem)',
              cursor: (loading || janelaEditada.periodo.length === 0 || !houveAlteracoes()) 
                ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              boxShadow: (loading || janelaEditada.periodo.length === 0 || !houveAlteracoes()) 
                ? 'none' : '0 4px 12px rgba(59, 130, 246, 0.3)',
              transform: 'translateY(0)',
              minHeight: 'clamp(2rem, 4vw, 2.5rem)',
              opacity: (loading || janelaEditada.periodo.length === 0 || !houveAlteracoes()) ? 0.7 : 1,
              flex: '0 1 auto'
            }}
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
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
        
        /* Removendo spinners do input number */
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  );
};
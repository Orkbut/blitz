'use client';

import React, { useState, useEffect, useRef } from 'react';

interface HorarioPopoverProps {
  operacao: {
    id: number;
    modalidade: string;
    turno: string;
    horario?: string;
  };
  buttonRef: React.RefObject<HTMLButtonElement>;
  onClose: () => void;
  onSave: (horario: string, turno?: string) => void;
  onRemove: () => void;
  loading: boolean;
}

export const HorarioPopover: React.FC<HorarioPopoverProps> = ({
  operacao,
  buttonRef,
  onClose,
  onSave,
  onRemove,
  loading
}) => {
  const [horario, setHorario] = useState(operacao.horario || '');
  const [turno, setTurno] = useState(operacao.turno || '');
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Função para determinar turno baseado no horário
  const getTurnoFromHorario = (horario: string): string => {
    if (!horario) return '';
    
    const [hours] = horario.split(':').map(Number);
    
    if (hours >= 6 && hours < 12) {
      return 'MANHA';
    } else if (hours >= 12 && hours < 18) {
      return 'TARDE';
    } else {
      return 'NOITE';
    }
  };

  // Atualizar turno automaticamente quando horário mudar
  useEffect(() => {
    if (horario) {
      const turnoSugerido = getTurnoFromHorario(horario);
      setTurno(turnoSugerido);
    }
  }, [horario]);

  // Auto-focus no input quando o popover abrir
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  // Handlers de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !loading) {
        e.preventDefault();
        if (horario.trim()) {
          onSave(horario.trim(), turno);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, onSave, horario, loading]);

  const handleSave = () => {
    if (horario.trim() && !loading) {
      onSave(horario.trim(), turno);
    }
  };

  const handleRemove = () => {
    if (!loading) {
      onRemove();
    }
  };

  return (
    <>
      {/* Backdrop elegante e translúcido */}
      <div 
        className="fixed inset-0 z-40 flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 197, 253, 0.15) 100%)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)'
        }}
        onClick={onClose}
      >
        {/* Modal com sombra elegante */}
        <div
          ref={popoverRef}
          className="bg-white rounded-2xl border border-gray-200/60 p-6 min-w-[320px] max-w-[400px] mx-4 transform transition-all duration-300 ease-out relative"
          style={{
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.8), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
            background: 'linear-gradient(135deg, #ffffff 0%, #fafbff 100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Overlay de loading durante salvamento - Mais sutil */}
          {loading && (
            <div 
              className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl"
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)'
              }}
            >
              <div 
                className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  border: '1px solid rgba(229, 231, 235, 0.6)',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
                }}
              >
                <div 
                  className="w-5 h-5 rounded-full"
                  style={{
                    border: '2px solid rgba(59, 130, 246, 0.2)',
                    borderTop: '2px solid #3b82f6',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <p className="text-sm font-medium text-gray-700">Salvando...</p>
              </div>
            </div>
          )}

          {/* Header com gradiente sutil */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center mr-3"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                <span className="text-white text-lg">⏰</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {operacao.horario ? 'Editar Horário' : 'Definir Horário'}
                </h3>
                <p className="text-sm text-gray-500">
                  #{operacao.id} • {operacao.modalidade}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
                color: '#6b7280'
              }}
            >
              ✕
            </button>
          </div>

          {/* Input de horário com design refinado */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Horário</label>
            <input
              ref={inputRef}
              type="time"
              value={horario}
              onChange={(e) => setHorario(e.target.value)}
              disabled={loading}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 text-base font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? '#f9fafb' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
              }}
            />
          </div>

          {/* Select de turno com design refinado */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Turno</label>
            <select
              value={turno}
              onChange={(e) => setTurno(e.target.value)}
              disabled={loading}
              className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 text-base font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading ? '#f9fafb' : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.9)'
              }}
            >
              <option value="">Não especificado</option>
              <option value="MANHA">🌅 MANHÃ (06:00 - 11:59)</option>
              <option value="TARDE">🌇 TARDE (12:00 - 17:59)</option>
              <option value="NOITE">🌙 NOITE (18:00 - 05:59)</option>
            </select>
            
            {horario && (
              <p className="text-sm text-emerald-600 mt-2 font-medium">
                ✨ Turno ajustado automaticamente: {getTurnoFromHorario(horario)}
              </p>
            )}
          </div>

          {/* Informações atuais com design elegante */}
          {(operacao.horario || operacao.turno) && (
            <div 
              className="rounded-xl p-3 mb-4 border"
              style={{
                background: 'linear-gradient(135deg, #dbeafe 0%, #e0f2fe 100%)',
                borderColor: '#bfdbfe',
                boxShadow: '0 1px 3px rgba(59, 130, 246, 0.1)'
              }}
            >
              {operacao.horario && (
                <p className="text-sm text-blue-800">
                  <span className="font-semibold">Horário atual:</span> {operacao.horario}
                </p>
              )}
              {operacao.turno && (
                <p className="text-sm text-blue-800 mt-1">
                  <span className="font-semibold">Turno atual:</span> {operacao.turno}
                </p>
              )}
            </div>
          )}

          {/* Dica de teclado elegante */}
          <div 
            className="rounded-xl p-3 mb-4 border"
            style={{
              background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
            }}
          >
            <p className="text-sm text-gray-600">
              💡 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs shadow-sm">Enter</kbd> para salvar • <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-xs shadow-sm">Esc</kbd> para cancelar
            </p>
          </div>

          {/* Botões de ação com gradientes elegantes */}
          <div className="flex gap-3">
            {operacao.horario && (
              <button
                onClick={handleRemove}
                disabled={loading}
                className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: loading ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)' : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                  color: 'white',
                  boxShadow: loading ? '0 4px 12px rgba(156, 163, 175, 0.3)' : '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
                title="Remover horário"
              >
                🗑️ Remover
              </button>
            )}
            
            <button
              onClick={handleSave}
              disabled={loading || !horario.trim()}
              className="flex-1 py-3 px-4 rounded-xl text-sm font-semibold transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: loading || !horario.trim() 
                  ? 'linear-gradient(135deg, #9ca3af 0%, #6b7280 100%)'
                  : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: 'white',
                boxShadow: loading || !horario.trim() 
                  ? '0 4px 12px rgba(156, 163, 175, 0.3)'
                  : '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full"
                    style={{
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTop: '2px solid white',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  Salvando...
                </span>
              ) : (
                '💾 Salvar'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}; 
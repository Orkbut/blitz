'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MultiDateCalendarProps {
  selectedDates: string[];
  onDatesChange: (dates: string[]) => void;
  minDate?: string;
  maxDate?: string;
  blockedDates?: string[]; // Datas bloqueadas (vermelhas, não clicáveis)
  rangeMode?: boolean; // Modo de seleção de intervalo
  onApply: () => void;
  onCancel: () => void;
  disabled?: boolean;
  className?: string;
}

export const MultiDateCalendar: React.FC<MultiDateCalendarProps> = ({
  selectedDates,
  onDatesChange,
  minDate,
  maxDate,
  blockedDates = [],
  rangeMode = false,
  onApply,
  onCancel,
  disabled = false,
  className = ''
}) => {
  const [currentDate, setCurrentDate] = useState(() => {
    if (minDate) {
      return new Date(minDate);
    }
    return new Date();
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        if (selectedDates.length > 0) {
          onApply();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedDates, onApply, onCancel]);

  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  // ✅ NOVO: Verificar se navegação está disponível
  const canNavigatePrev = () => {
    if (!minDate) return true;
    const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
    const minDateObj = new Date(minDate);
    return prevMonth.getFullYear() > minDateObj.getFullYear() || 
           (prevMonth.getFullYear() === minDateObj.getFullYear() && prevMonth.getMonth() >= minDateObj.getMonth());
  };

  const canNavigateNext = () => {
    if (!maxDate) return true;
    const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1);
    const maxDateObj = new Date(maxDate);
    return nextMonth.getFullYear() < maxDateObj.getFullYear() || 
           (nextMonth.getFullYear() === maxDateObj.getFullYear() && nextMonth.getMonth() <= maxDateObj.getMonth());
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  
  const dias = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const isDateSelectable = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    
    // ✅ CORREÇÃO: Normalizar datas para início do dia no timezone local
    // Para evitar problemas de timezone, vamos comparar apenas as datas (YYYY-MM-DD)
    if (minDate) {
      // ✅ CORRIGIDO: Garantir que a comparação seja sempre string para string
      const minDateString = minDate.includes('T') ? minDate.split('T')[0] : minDate;
      if (dateString < minDateString) return false;
    }
    
    if (maxDate) {
      const maxDateString = maxDate.includes('T') ? maxDate.split('T')[0] : maxDate;
      if (dateString > maxDateString) return false;
    }
    
    return true;
  };

  const isDateBlocked = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return blockedDates.includes(dateString);
  };

  const toggleDate = (date: Date) => {
    if (!isDateSelectable(date) || disabled || isDateBlocked(date)) return;
    
    const dateString = format(date, 'yyyy-MM-dd');
    
    if (rangeMode) {
      // Modo intervalo: 2 cliques para selecionar início e fim
      if (selectedDates.length === 0) {
        // Primeiro clique: seleciona data inicial
        onDatesChange([dateString]);
      } else if (selectedDates.length === 1) {
        // Segundo clique: completa o intervalo
        // ✅ CORREÇÃO: Trabalhar apenas com strings de data para evitar timezone
        const startDateString = selectedDates[0];
        const endDateString = dateString;
        
        // Determinar qual é a data inicial e final (sempre em ordem)
        const realStartString = startDateString <= endDateString ? startDateString : endDateString;
        const realEndString = startDateString <= endDateString ? endDateString : startDateString;
        
        // ✅ REMOVIDO: Limite de dias - permitir períodos longos
        // Comentado para permitir janelas de longo prazo (até 2 anos)
        /*
        const startDate = new Date(realStartString + 'T00:00:00');
        const endDate = new Date(realEndString + 'T00:00:00');
        const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const maxDays = 40;
        if (daysDiff > maxDays) {
          alert(`O período máximo é de ${maxDays} dias. Selecione um intervalo menor.`);
          return;
        }
        */
        
        // Cria intervalo completo sempre em ordem cronológica
        const interval = [];
        const [startYear, startMonth, startDay] = realStartString.split('-').map(Number);
        const [endYear, endMonth, endDay] = realEndString.split('-').map(Number);
        
        let currentDate = new Date(startYear, startMonth - 1, startDay);
        const endDateObj = new Date(endYear, endMonth - 1, endDay);
        
        while (currentDate <= endDateObj) {
          const year = currentDate.getFullYear();
          const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
          const day = currentDate.getDate().toString().padStart(2, '0');
          const dateString = `${year}-${month}-${day}`;
          
          interval.push(dateString);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        onDatesChange(interval);
      } else {
        // Terceiro clique: reinicia seleção
        onDatesChange([dateString]);
      }
    } else {
      // Modo normal: múltiplas datas individuais
      const newSelectedDates = selectedDates.includes(dateString)
        ? selectedDates.filter(d => d !== dateString)
        : [...selectedDates, dateString].sort();
      
      onDatesChange(newSelectedDates);
    }
  };

  const isDateSelected = (date: Date) => {
    const dateString = format(date, 'yyyy-MM-dd');
    return selectedDates.includes(dateString);
  };

  return (
    <div className={`rounded-lg shadow-xl ${className}`} 
         style={{ 
           width: '320px', 
           fontFamily: 'system-ui, -apple-system, sans-serif',
           background: 'var(--bg-card)',
           border: '1px solid var(--border-color)'
         }}>
      
      <div className="flex items-center justify-between px-3 py-3 border-b" style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)'
      }}>
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={disabled || !canNavigatePrev()}
          className="p-2 rounded-lg transition-all duration-200 disabled:opacity-50"
          style={{
            color: 'var(--text-secondary)',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronLeft size={16} />
        </button>
        
        <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </div>
        
        <button
          type="button"
          onClick={handleNextMonth}
          disabled={disabled || !canNavigateNext()}
          className="p-2 rounded-lg transition-all duration-200 disabled:opacity-50"
          style={{
            color: 'var(--text-secondary)',
            background: 'transparent'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
            <div key={dia} className="h-8 flex items-center justify-center text-xs font-semibold" style={{
              color: 'var(--text-secondary)'
            }}>
              {dia}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {dias.map(dia => {
            const isCurrentMonth = isSameMonth(dia, currentDate);
            const isHoje = isToday(dia);
            const isSelected = isDateSelected(dia);
            const isSelectable = isDateSelectable(dia);
            const isBlocked = isDateBlocked(dia);
            
            return (
              <button
                key={format(dia, 'yyyy-MM-dd')}
                type="button"
                onClick={() => toggleDate(dia)}
                disabled={!isSelectable || disabled || isBlocked}
                className="h-8 w-8 flex items-center justify-center text-sm font-medium rounded-lg border transition-all duration-200"
                style={{
                  color: !isCurrentMonth 
                    ? 'var(--text-disabled)' 
                    : isBlocked
                      ? 'var(--danger)'
                      : isSelected
                        ? 'white'
                        : isHoje
                          ? 'var(--primary)'
                          : isSelectable
                            ? 'var(--text-primary)'
                            : 'var(--text-disabled)',
                  background: isBlocked
                    ? 'var(--danger-light)'
                    : isSelected
                      ? 'var(--primary)'
                      : isHoje
                        ? 'var(--primary-light)'
                        : 'transparent',
                  borderColor: isBlocked
                    ? 'var(--danger)'
                    : isSelected
                      ? 'var(--primary-dark)'
                      : isHoje
                        ? 'var(--primary)'
                        : 'transparent',
                  cursor: (!isSelectable || disabled || isBlocked) ? 'not-allowed' : 'pointer',
                  opacity: (!isSelectable || disabled) ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (isSelectable && !disabled && !isBlocked && !isSelected) {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.color = 'var(--primary)';
                    e.currentTarget.style.borderColor = 'var(--primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (isSelectable && !disabled && !isBlocked && !isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-primary)';
                    e.currentTarget.style.borderColor = 'transparent';
                  }
                }}
              >
                {format(dia, 'd')}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-3 px-3 py-3 border-t" style={{
        background: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)'
      }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-50"
          style={{
            color: 'var(--text-secondary)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)'
          }}
          onMouseEnter={(e) => {
            if (!disabled) {
              e.currentTarget.style.background = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--bg-card)';
            e.currentTarget.style.color = 'var(--text-secondary)';
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={disabled || selectedDates.length === 0}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg transition-all duration-200 disabled:opacity-50"
          style={{
            background: (disabled || selectedDates.length === 0) 
              ? 'var(--text-disabled)' 
              : 'var(--primary)',
            border: `1px solid ${(disabled || selectedDates.length === 0) ? 'var(--text-disabled)' : 'var(--primary)'}`
          }}
          onMouseEnter={(e) => {
            if (!disabled && selectedDates.length > 0) {
              e.currentTarget.style.background = 'var(--primary-dark)';
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && selectedDates.length > 0) {
              e.currentTarget.style.background = 'var(--primary)';
            }
          }}
        >
          Aceitar
        </button>
      </div>
    </div>
  );
};

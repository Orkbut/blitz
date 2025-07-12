'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, User, X, RotateCcw } from 'lucide-react';

interface OperacaoExcluida {
  id: number;
  dataOperacao: string;
  turno: string;
  modalidade: string;
  exclusaoTemporaria: {
    dataExclusao: string;
    motivo: string;
    supervisorNome: string;
    podeReativar: boolean;
    podeReativarAte: string;
    visivelAte: string;
    tempoRestanteVisibilidade: number;
  };
}

interface NotificacaoExclusaoOperacaoProps {
  operacao: OperacaoExcluida;
  onDismiss?: () => void;
  compact?: boolean;
}

export function NotificacaoExclusaoOperacao({ 
  operacao, 
  onDismiss,
  compact = false 
}: NotificacaoExclusaoOperacaoProps) {
  const [tempoRestante, setTempoRestante] = useState(operacao.exclusaoTemporaria.tempoRestanteVisibilidade);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setTempoRestante(prev => {
        const novo = Math.max(0, prev - 1000);
        if (novo === 0 && onDismiss) {
          onDismiss();
        }
        return novo;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onDismiss]);

  const formatarTempoRestante = (ms: number) => {
    const horas = Math.floor(ms / (1000 * 60 * 60));
    const minutos = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (horas > 0) {
      return `${horas}h ${minutos}m`;
    }
    return `${minutos}m`;
  };

  const formatarData = (dataString: string) => {
    const data = new Date(dataString);
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDismiss = () => {
    setDismissed(true);
    setTimeout(() => onDismiss?.(), 300);
  };

  if (dismissed || tempoRestante <= 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200 rounded-xl p-4 mb-4 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">
                Operação {operacao.modalidade} de {formatarData(operacao.dataOperacao)} foi excluída
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Motivo: {operacao.exclusaoTemporaria.motivo}
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-amber-400 hover:text-amber-600 transition-colors p-1"
            aria-label="Dispensar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 mb-6 shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-amber-900">Operação Excluída Temporariamente</h3>
            <p className="text-amber-700 text-sm">Esta informação ficará visível por mais {formatarTempoRestante(tempoRestante)}</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="text-amber-400 hover:text-amber-600 transition-colors p-2 hover:bg-amber-100 rounded-lg"
          aria-label="Dispensar notificação"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Informações da Operação */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Data & Turno</p>
            <p className="text-amber-900 font-medium">
              {formatarData(operacao.dataOperacao)} - {operacao.turno}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Modalidade</p>
            <p className="text-amber-900 font-medium">{operacao.modalidade}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Status</p>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Excluída
            </span>
          </div>
        </div>
      </div>

      {/* Detalhes da Exclusão */}
      <div className="bg-white/60 backdrop-blur-sm rounded-xl p-4 mb-4">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
            <User className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 mb-1">
              Excluída por: {operacao.exclusaoTemporaria.supervisorNome}
            </p>
            <p className="text-sm text-amber-700 mb-2">
              Em {formatarData(operacao.exclusaoTemporaria.dataExclusao)}
            </p>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Motivo</p>
              <p className="text-sm text-amber-800">{operacao.exclusaoTemporaria.motivo}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Informações de Reativação */}
      {operacao.exclusaoTemporaria.podeReativar && (
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-4 border border-blue-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <RotateCcw className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900">Pode ser reativada</p>
              <p className="text-xs text-blue-700">
                Até {formatarData(operacao.exclusaoTemporaria.podeReativarAte)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Contador de Tempo */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-amber-200">
        <div className="flex items-center space-x-2 text-amber-600">
          <Clock className="w-4 h-4" />
          <span className="text-sm">
            Esta notificação desaparecerá em {formatarTempoRestante(tempoRestante)}
          </span>
        </div>
        <div className="text-xs text-amber-500">
          Informação temporária • Apenas para conhecimento
        </div>
      </div>
    </div>
  );
} 
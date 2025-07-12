'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Calendar, Clock, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useSmartPolling } from '@/hooks/useSmartPolling';

interface LimitesServidor {
  podeParticiparMais: boolean;
  limitesAtuais: {
    diariasNoMes: number;
    limiteMensal: number;
    operacoesNoPeriodo: number;
    limitePeriodo: number;
  };
  proximasOportunidades: string[];
}

interface LimitesServidorInfoProps {
  servidorId: number;
  compact?: boolean;
  autoRefresh?: boolean;
}

export function LimitesServidorInfo({ 
  servidorId, 
  compact = false,
  autoRefresh = true 
}: LimitesServidorInfoProps) {
  const [limites, setLimites] = useState<LimitesServidor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const carregarLimites = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/membro/${servidorId}/limites-validacoes`);
      
      if (!response.ok) {
        throw new Error('Erro ao carregar limites');
      }

      const data = await response.json();
      if (data.success) {
        setLimites(data.data);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (err) {
      console.error('Erro ao carregar limites:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  // 🚀 SMART POLLING: Ajusta intervalo baseado na atividade
  useSmartPolling({
    callback: carregarLimites,
    enabled: autoRefresh && !loading && !error,
    activeInterval: 30000, // 30s quando ativo
    inactiveInterval: 120000, // 2min quando inativo
    focusInterval: 30000, // 30s quando tab em foco
    blurInterval: 300000, // 5min quando tab em background
    inactivityTimeout: 60000 // 1min para considerar inativo
  });

  useEffect(() => {
    carregarLimites();
  }, [servidorId]);

  const calcularPercentual = (atual: number, limite: number) => {
    return Math.min(100, (atual / limite) * 100);
  };

  const getCorProgresso = (percentual: number) => {
    if (percentual >= 90) return 'bg-red-500';
    if (percentual >= 70) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getCorFundo = (percentual: number) => {
    if (percentual >= 90) return 'bg-red-50 border-red-200';
    if (percentual >= 70) return 'bg-amber-50 border-amber-200';
    return 'bg-emerald-50 border-emerald-200';
  };

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !limites) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center space-x-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">Erro ao carregar limites</span>
        </div>
      </div>
    );
  }

  const percentualDiarias = calcularPercentual(limites.limitesAtuais.diariasNoMes, limites.limitesAtuais.limiteMensal);
  const percentualOperacoes = calcularPercentual(limites.limitesAtuais.operacoesNoPeriodo, limites.limitesAtuais.limitePeriodo);

  if (compact) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-700 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Seus Limites
          </h4>
          {limites.podeParticiparMais ? (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-500" />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-600">Diárias</span>
              <span className="font-medium">{limites.limitesAtuais.diariasNoMes}/{limites.limitesAtuais.limiteMensal}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${getCorProgresso(percentualDiarias)}`}
                style={{ width: `${percentualDiarias}%` }}
              ></div>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-1">
              <span className="text-slate-600">Operações</span>
              <span className="font-medium">{limites.limitesAtuais.operacoesNoPeriodo}/{limites.limitesAtuais.limitePeriodo}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5">
              <div 
                className={`h-1.5 rounded-full transition-all duration-300 ${getCorProgresso(percentualOperacoes)}`}
                style={{ width: `${percentualOperacoes}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">Seus Limites & Oportunidades</h3>
            <p className="text-sm text-slate-600">Transparência para suas decisões</p>
          </div>
        </div>
        
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${
          limites.podeParticiparMais 
            ? 'bg-emerald-100 text-emerald-700' 
            : 'bg-amber-100 text-amber-700'
        }`}>
          {limites.podeParticiparMais ? 'Disponível' : 'Limite Próximo'}
        </div>
      </div>

      {/* Progresso de Diárias */}
      <div className={`rounded-xl p-4 mb-4 border ${getCorFundo(percentualDiarias)}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Diárias no Mês</span>
          </div>
          <span className="text-lg font-bold text-slate-800">
            {limites.limitesAtuais.diariasNoMes}/{limites.limitesAtuais.limiteMensal}
          </span>
        </div>
        
        <div className="w-full bg-white/60 rounded-full h-3 mb-2">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getCorProgresso(percentualDiarias)}`}
            style={{ width: `${percentualDiarias}%` }}
          ></div>
        </div>
        
        <p className="text-xs text-slate-600">
          {percentualDiarias >= 90 
            ? 'Limite quase atingido - planeje com cuidado'
            : percentualDiarias >= 70
            ? 'Aproximando do limite mensal'
            : 'Boa margem disponível'
          }
        </p>
      </div>

      {/* Progresso de Operações */}
      <div className={`rounded-xl p-4 mb-4 border ${getCorFundo(percentualOperacoes)}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-slate-600" />
            <span className="text-sm font-semibold text-slate-700">Operações no Período</span>
          </div>
          <span className="text-lg font-bold text-slate-800">
            {limites.limitesAtuais.operacoesNoPeriodo}/{limites.limitesAtuais.limitePeriodo}
          </span>
        </div>
        
        <div className="w-full bg-white/60 rounded-full h-3 mb-2">
          <div 
            className={`h-3 rounded-full transition-all duration-500 ${getCorProgresso(percentualOperacoes)}`}
            style={{ width: `${percentualOperacoes}%` }}
          ></div>
        </div>
        
        <p className="text-xs text-slate-600">
          {percentualOperacoes >= 90 
            ? 'Limite quase atingido no período funcional'
            : percentualOperacoes >= 70
            ? 'Aproximando do limite do período'
            : 'Boa disponibilidade no período'
          }
        </p>
      </div>

      {/* Oportunidades */}
      {limites.proximasOportunidades.length > 0 && (
        <div className="bg-blue-50/60 backdrop-blur-sm rounded-xl p-4 border border-blue-200">
          <div className="flex items-center space-x-2 mb-3">
            <Info className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-semibold text-blue-800">Próximas Oportunidades</span>
          </div>
          
          <ul className="space-y-2">
            {limites.proximasOportunidades.map((oportunidade, index) => (
              <li key={index} className="text-sm text-blue-700 flex items-start">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                {oportunidade}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
} 
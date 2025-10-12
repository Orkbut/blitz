'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLimitesCalendario } from '@/hooks/useLimitesCalendario';
import { useFeatureFlags } from '@/utils/featureFlags';
import { CirculoProgresso } from '../ui/CirculoProgresso';
import { getProgressColorString } from '@/utils/progressColors';
import styles from './LimitesBarras.module.css';

interface LimitesBarrasProps {
  membroId: string;
  currentDate: Date;
  compact?: boolean;
  debug?: boolean;
  onCircleClick?: (tipo: 'anterior' | 'corrente' | 'diarias') => void;
}

/**
 * Componente de barras de limites para o calendário
 * Exibe 3 barras informativas conforme especificação da tarefa
 */
export const LimitesBarras: React.FC<LimitesBarrasProps> = React.memo(({
  membroId,
  currentDate,
  compact = false,
  debug = false,
  onCircleClick
}) => {
  const {
    operacoesCicloAnterior,
    operacoesCicloCorrente,
    diariasEquivalentes,
    loading,
    error
  } = useLimitesCalendario({ membroId, currentDate, debug });

  const { useCircularIndicators } = useFeatureFlags();

  // Função para determinar cor baseada no percentual
  const getStatusColor = (percentual: number): string => {
    if (percentual >= 90) return '#ef4444'; // vermelho
    if (percentual >= 70) return '#f59e0b'; // amarelo
    return '#10b981'; // verde
  };



  if (loading) {
    return (
      <div className={styles.limitesContainer}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.limitesContainer}>
        <div className={styles.errorState}>
          <AlertTriangle size={16} color="#ef4444" />
        </div>
      </div>
    );
  }



  /**
   * Função para gerar labels que mostram o período cruzado completo
   * CORREÇÃO: Agora determina o status real (Aberto/Fechado) baseado na data atual
   * E NOVA LÓGICA: Também considera se todas as operações do período estão arquivadas pelo supervisor
   */
  const getPeriodoLabel = (currentDate: Date, tipo: 'anterior' | 'corrente' | 'diarias') => {
    const mesAtual = currentDate.getMonth();
    const anoAtual = currentDate.getFullYear();
    const hoje = new Date(); // Data real atual (não a data de navegação)

    if (tipo === 'anterior') {
      // Período anterior: 10/mês-anterior até 09/mês-atual
      const mesAnterior = mesAtual === 0 ? 11 : mesAtual - 1;
      const anoAnterior = mesAtual === 0 ? anoAtual - 1 : anoAtual;

      const mesAnteriorNome = new Date(anoAnterior, mesAnterior, 15).toLocaleDateString('pt-BR', { month: 'short' });
      const mesAtualNome = currentDate.toLocaleDateString('pt-BR', { month: 'short' });

      // Determinar se o período anterior está realmente fechado
      // 1. Por data: Período anterior termina no dia 09 do mês atual
      const fimPeriodoAnterior = new Date(anoAtual, mesAtual, 9, 23, 59, 59);
      const fechadoPorData = hoje > fimPeriodoAnterior;
      
      // 2. Por operações: Todas as operações do período estão arquivadas pelo supervisor
      const fechadoPorOperacoes = operacoesCicloAnterior.todasOperacoesArquivadas;
      
      // Período fechado se: passou da data OU todas operações arquivadas
      const periodoFechado = fechadoPorData || fechadoPorOperacoes;

      if (debug && fechadoPorOperacoes && !fechadoPorData) {
        console.log(`[getPeriodoLabel] Período anterior fechado por operações arquivadas (data ainda não passou)`);
      }

      return {
        periodo: `10/${mesAnteriorNome} → 09/${mesAtualNome}`,
        status: periodoFechado ? 'Fechado' : 'Aberto'
      };
    }

    if (tipo === 'corrente') {
      // Período corrente: 10/mês-atual até 09/mês-próximo
      const mesProximo = mesAtual === 11 ? 0 : mesAtual + 1;
      const anoProximo = mesAtual === 11 ? anoAtual + 1 : anoAtual;

      const mesAtualNome = currentDate.toLocaleDateString('pt-BR', { month: 'short' });
      const mesProximoNome = new Date(anoProximo, mesProximo, 15).toLocaleDateString('pt-BR', { month: 'short' });

      // Determinar se o período corrente está fechado
      // 1. Por data: Período corrente termina no dia 09 do mês próximo
      const fimPeriodoCorrente = new Date(anoProximo, mesProximo, 9, 23, 59, 59);
      const fechadoPorData = hoje > fimPeriodoCorrente;
      
      // 2. Por operações: Todas as operações do período estão arquivadas pelo supervisor
      const fechadoPorOperacoes = operacoesCicloCorrente.todasOperacoesArquivadas;
      
      // Período fechado se: passou da data OU todas operações arquivadas
      const periodoFechado = fechadoPorData || fechadoPorOperacoes;

      if (debug && fechadoPorOperacoes && !fechadoPorData) {
        console.log(`[getPeriodoLabel] Período corrente fechado por operações arquivadas (data ainda não passou)`);
      }

      return {
        periodo: `10/${mesAtualNome} → 09/${mesProximoNome}`,
        status: periodoFechado ? 'Fechado' : 'Aberto'
      };
    }

    // Diárias do mês civil atual
    const mesNome = currentDate.toLocaleDateString('pt-BR', { month: 'long' });

    // Determinar se o mês das diárias está fechado
    // Mês civil termina no último dia do mês (não aplicamos lógica de operações arquivadas aqui)
    const fimMesCivil = new Date(anoAtual, mesAtual + 1, 0, 23, 59, 59); // Último dia do mês
    const mesFechado = hoje > fimMesCivil;

    return {
      periodo: `${mesNome}`,
      status: mesFechado ? 'Fechado' : 'Diárias'
    };
  };

  const periodoAnterior = getPeriodoLabel(currentDate, 'anterior');
  const periodoCorrente = getPeriodoLabel(currentDate, 'corrente');
  const periodoDiarias = getPeriodoLabel(currentDate, 'diarias');

  // Renderização condicional baseada na feature flag
  if (useCircularIndicators) {
    return (
      <div className={styles.limitesContainer}>
        <div className={`${styles.cardsGrid} ${styles.circularIndicators}`}>
          {/* Período Anterior - Indicador Circular */}
          <CirculoProgresso
            valorAtual={operacoesCicloAnterior.atual}
            valorMaximo={operacoesCicloAnterior.limite}
            rotulo={periodoAnterior.status}
            periodo={periodoAnterior.periodo}
            tamanho={compact ? 'small' : 'medium'}
            corFuncao={getProgressColorString}
            ariaLabel={`${periodoAnterior.status}: ${operacoesCicloAnterior.atual} de ${operacoesCicloAnterior.limite} operações no período ${periodoAnterior.periodo}`}
            className={styles.anterior}
            onClick={() => onCircleClick?.('anterior')}
          />

          {/* Período Corrente - Indicador Circular */}
          <CirculoProgresso
            valorAtual={operacoesCicloCorrente.atual}
            valorMaximo={operacoesCicloCorrente.limite}
            rotulo={periodoCorrente.status}
            periodo={periodoCorrente.periodo}
            tamanho={compact ? 'small' : 'medium'}
            corFuncao={getProgressColorString}
            ariaLabel={`${periodoCorrente.status}: ${operacoesCicloCorrente.atual} de ${operacoesCicloCorrente.limite} operações no período ${periodoCorrente.periodo}`}
            className={styles.corrente}
            onClick={() => onCircleClick?.('corrente')}
          />

          {/* Diárias do Mês - Indicador Circular */}
          <CirculoProgresso
            valorAtual={diariasEquivalentes.atual}
            valorMaximo={diariasEquivalentes.limite}
            rotulo={periodoDiarias.status}
            periodo={periodoDiarias.periodo}
            tamanho={compact ? 'small' : 'medium'}
            corFuncao={getProgressColorString}
            ariaLabel={`${periodoDiarias.status}: ${diariasEquivalentes.atual % 1 === 0 ? diariasEquivalentes.atual : diariasEquivalentes.atual.toFixed(1)} de ${diariasEquivalentes.limite} diárias em ${periodoDiarias.periodo}`}
            className={styles.diarias}
            onClick={() => onCircleClick?.('diarias')}
          />
        </div>
      </div>
    );
  }

  // Fallback para barras lineares (comportamento atual)
  return (
    <div className={styles.limitesContainer}>
      <div className={styles.cardsGrid}>
        {/* Período Anterior - Mostra período cruzado completo */}
        <div className={`${styles.limiteCard} ${styles.anterior}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>✓</div>
            <span className={styles.cardStatus}>{periodoAnterior.status}</span>
          </div>
          <div className={styles.cardPeriodo}>{periodoAnterior.periodo}</div>
          <div className={styles.cardValue}>
            {operacoesCicloAnterior.atual}<span className={styles.limite}>/{operacoesCicloAnterior.limite}</span>
          </div>
          <div
            className={styles.progressBar}
            style={{
              '--progress': `${operacoesCicloAnterior.percentual}%`,
              '--color': getStatusColor(operacoesCicloAnterior.percentual)
            } as React.CSSProperties}
          />
        </div>

        {/* Período Corrente - Mostra período cruzado completo */}
        <div className={`${styles.limiteCard} ${styles.corrente}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>⏳</div>
            <span className={styles.cardStatus}>{periodoCorrente.status}</span>
          </div>
          <div className={styles.cardPeriodo}>{periodoCorrente.periodo}</div>
          <div className={styles.cardValue}>
            {operacoesCicloCorrente.atual}<span className={styles.limite}>/{operacoesCicloCorrente.limite}</span>
          </div>
          <div
            className={styles.progressBar}
            style={{
              '--progress': `${operacoesCicloCorrente.percentual}%`,
              '--color': getStatusColor(operacoesCicloCorrente.percentual)
            } as React.CSSProperties}
          />
        </div>

        {/* Diárias do Mês - Período simples */}
        <div className={`${styles.limiteCard} ${styles.diarias}`}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>📅</div>
            <span className={styles.cardStatus}>{periodoDiarias.status}</span>
          </div>
          <div className={styles.cardPeriodo}>{periodoDiarias.periodo}</div>
          <div className={styles.cardValue}>
            {diariasEquivalentes.atual % 1 === 0 ? diariasEquivalentes.atual : diariasEquivalentes.atual.toFixed(1)}<span className={styles.limite}>/{diariasEquivalentes.limite}</span>
          </div>
          <div
            className={styles.progressBar}
            style={{
              '--progress': `${diariasEquivalentes.percentual}%`,
              '--color': getStatusColor(diariasEquivalentes.percentual)
            } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Comparação personalizada para evitar re-renderizações desnecessárias
  return (
    prevProps.membroId === nextProps.membroId &&
    prevProps.currentDate.getTime() === nextProps.currentDate.getTime() &&
    prevProps.compact === nextProps.compact &&
    prevProps.debug === nextProps.debug &&
    prevProps.onCircleClick === nextProps.onCircleClick
  );
});
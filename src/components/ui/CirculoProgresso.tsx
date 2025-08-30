'use client';

import React, { useEffect, useState } from 'react';
import styles from './CirculoProgresso.module.css';

// Função para formatar período com estilo especial para meses
const formatPeriodoComEstilo = (periodo: string): React.ReactNode => {
  // Regex para capturar padrões como "10/jul. → 09/ago." ou "agosto"
  const periodoFormatado = periodo.replace(
    /(\d{1,2})\/(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\.?/gi,
    (match, dia, mes) => {
      return `${dia}/${mes.toLowerCase()}.`;
    }
  );
  
  // Dividir por → ou - para separar início e fim
  const partes = periodoFormatado.split(/\s*[→-]\s*/);
  
  if (partes.length === 2) {
    return (
      <>
        <span className={styles.periodoData}>{partes[0]}</span>
        <span className={styles.periodoSeparador}> → </span>
        <span className={styles.periodoData}>{partes[1]}</span>
      </>
    );
  }
  
  // Para períodos simples como "agosto" ou "setembro"
  if (/^(janeiro|fevereiro|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)$/i.test(periodo)) {
    return <span className={styles.periodoMes}>{periodo}</span>;
  }
  
  return <span className={styles.periodoTexto}>{periodo}</span>;
};

interface CirculoProgressoProps {
  valorAtual: number;
  valorMaximo: number;
  percentual?: number;
  tamanho?: 'small' | 'medium' | 'large';
  strokeWidth?: number;
  cor?: string;
  corFuncao?: (percentual: number) => string;
  rotulo?: string;
  periodo?: string;
  ariaLabel?: string;
  showPercentual?: boolean;
  animationDelay?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * Componente de indicador circular com game feel elegante
 * Implementa os princípios: Necessário + Suficiente + Proporcional
 */
export const CirculoProgresso: React.FC<CirculoProgressoProps> = ({
  valorAtual,
  valorMaximo,
  percentual: percentualProp,
  tamanho = 'medium',
  strokeWidth,
  cor,
  corFuncao,
  rotulo,
  periodo,
  ariaLabel,
  showPercentual = false,
  animationDelay = 0,
  className = '',
  onClick
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentPercentual, setCurrentPercentual] = useState(0);

  // Cálculo seguro do percentual
  const percentualCalculado = percentualProp ?? 
    (valorMaximo > 0 ? Math.min((valorAtual / valorMaximo) * 100, 100) : 0);

  // Função para determinar cor baseada no percentual (reutiliza lógica existente)
  const getStatusColor = (perc: number): string => {
    if (corFuncao) return corFuncao(perc);
    if (cor) return cor;
    
    if (perc >= 90) return '#ef4444'; // vermelho
    if (perc >= 70) return '#f59e0b'; // amarelo
    return '#10b981'; // verde
  };

  // Configurações responsivas por tamanho - ajustadas para dimensões maiores e legíveis
  const configs = {
    small: {
      diameter: 'clamp(90px, 22vw, 130px)',
      strokeWidth: strokeWidth ?? 5,
      fontSize: 'clamp(0.95rem, 2.2vw, 1.1rem)',
      fontSizeSecondary: 'clamp(0.7rem, 1.6vw, 0.85rem)',
      fontSizePeriodo: 'clamp(0.8rem, 1.8vw, 0.95rem)'
    },
    medium: {
      diameter: 'clamp(110px, 26vw, 160px)',
      strokeWidth: strokeWidth ?? 6,
      fontSize: 'clamp(1.05rem, 2.4vw, 1.2rem)',
      fontSizeSecondary: 'clamp(0.8rem, 1.8vw, 0.95rem)',
      fontSizePeriodo: 'clamp(0.9rem, 2.0vw, 1.05rem)'
    },
    large: {
      diameter: 'clamp(140px, 32vw, 200px)',
      strokeWidth: strokeWidth ?? 7,
      fontSize: 'clamp(1.2rem, 2.8vw, 1.35rem)',
      fontSizeSecondary: 'clamp(0.9rem, 2.0vw, 1.05rem)',
      fontSizePeriodo: 'clamp(1rem, 2.2vw, 1.15rem)'
    }
  } as const;

  const config = configs[tamanho];
  const raio = 28; // Raio fixo para viewBox 62x62
  const circumferencia = 2 * Math.PI * raio;
  const strokeDashoffset = circumferencia * (1 - currentPercentual / 100);

  // Animação de entrada com delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, animationDelay);

    return () => clearTimeout(timer);
  }, [animationDelay]);

  // Animação suave do progresso
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        setCurrentPercentual(percentualCalculado);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isVisible, percentualCalculado]);

  const corAtual = getStatusColor(currentPercentual);
  const valorFormatado = valorAtual % 1 === 0 ? valorAtual.toString() : valorAtual.toFixed(1);

  return (
    <div 
      className={`${styles.container} ${styles[tamanho]} ${className} ${onClick ? styles.clickable : ''}`}
      style={{
        '--diameter': config.diameter,
        '--font-size': config.fontSize,
        '--font-size-secondary': config.fontSizeSecondary,
        '--font-size-periodo': config.fontSizePeriodo,
        '--progress-color': corAtual,
        '--animation-delay': `${animationDelay}ms`
      } as React.CSSProperties}
      onClick={onClick}
    >
      {/* SVG do anel de progresso */}
      <div className={`${styles.svgContainer} ${isVisible ? styles.visible : ''}`}>
        <svg
          viewBox="0 0 62 62"
          className={styles.progressSvg}
          role="progressbar"
          aria-valuenow={valorAtual}
          aria-valuemin={0}
          aria-valuemax={valorMaximo}
          aria-label={ariaLabel || `${rotulo || 'Progresso'}: ${valorAtual} de ${valorMaximo}`}
        >
          {/* Trilha de fundo */}
          <circle
            cx="31"
            cy="31"
            r={raio}
            fill="none"
            stroke="#e5e7eb"
            strokeWidth={config.strokeWidth}
            opacity={0.3}
            className={styles.backgroundRing}
          />
          
          {/* Anel de progresso */}
          <circle
            cx="31"
            cy="31"
            r={raio}
            fill="none"
            stroke={corAtual}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumferencia}
            strokeDashoffset={strokeDashoffset}
            className={styles.progressRing}
            transform="rotate(-90 31 31)"
          />
        </svg>

        {/* Conteúdo central */}
        <div className={`${styles.centerContent} ${isVisible ? styles.contentVisible : ''}`}>
          <div className={styles.mainValue}>
            {valorFormatado}<span className={styles.separator}>/</span><span className={styles.maxValue}>{valorMaximo}</span>
          </div>
          
          {showPercentual && (
            <div className={styles.percentualValue}>
              {Math.round(currentPercentual)}%
            </div>
          )}
          
          {rotulo && (
            <div className={styles.label}>
              {rotulo}
            </div>
          )}
        </div>
      </div>
      
      {/* Período abaixo do círculo */}
      {periodo && (
        <div className={styles.periodoExterno}>
          {formatPeriodoComEstilo(periodo)}
        </div>
      )}
    </div>
  );
};
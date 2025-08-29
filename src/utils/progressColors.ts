/**
 * Utilitário de cores para indicadores de progresso
 * Baseado no padrão visual do calendário supervisor
 * Implementa game feel através de cores inteligentes e transições
 */

export interface ProgressColorConfig {
  color: string;
  rgb: string;
  shadow: string;
  status: 'success' | 'warning' | 'danger' | 'info';
  intensity: 'low' | 'medium' | 'high';
}

/**
 * Função principal para determinar cor baseada no percentual
 * Reutiliza a lógica existente das barras com melhorias para game feel
 */
export const getProgressColor = (percentual: number): ProgressColorConfig => {
  // Normalizar percentual
  const perc = Math.max(0, Math.min(100, percentual));
  
  if (perc >= 90) {
    return {
      color: '#ef4444',
      rgb: '239, 68, 68',
      shadow: 'rgba(239, 68, 68, 0.3)',
      status: 'danger',
      intensity: 'high'
    };
  }
  
  if (perc >= 70) {
    return {
      color: '#f59e0b',
      rgb: '245, 158, 11',
      shadow: 'rgba(245, 158, 11, 0.3)',
      status: 'warning',
      intensity: 'medium'
    };
  }
  
  return {
    color: '#10b981',
    rgb: '16, 185, 129',
    shadow: 'rgba(16, 185, 129, 0.3)',
    status: 'success',
    intensity: 'low'
  };
};

/**
 * Cores específicas para diferentes tipos de operações
 * Baseado no padrão do calendário supervisor
 */
export const operationColors = {
  pendentes: {
    color: '#f59e0b',
    rgb: '245, 158, 11',
    shadow: 'rgba(245, 158, 11, 0.4)'
  },
  confirmados: {
    color: '#10b981',
    rgb: '16, 185, 129',
    shadow: 'rgba(16, 185, 129, 0.4)'
  },
  inativas: {
    color: '#6b7280',
    rgb: '107, 114, 128',
    shadow: 'rgba(107, 114, 128, 0.3)'
  }
};

/**
 * Função para cores de trilha (fundo do anel)
 */
export const getTrackColor = (opacity: number = 0.3): string => {
  return `rgba(229, 231, 235, ${opacity})`; // #e5e7eb com opacidade
};

/**
 * Função para determinar intensidade de animação baseada no status
 * Implementa o princípio de "proporção" do game feel
 */
export const getAnimationIntensity = (config: ProgressColorConfig): {
  duration: string;
  easing: string;
  scale: number;
  glowIntensity: number;
} => {
  switch (config.intensity) {
    case 'high':
      return {
        duration: '0.4s',
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        scale: 1.05,
        glowIntensity: 0.6
      };
    case 'medium':
      return {
        duration: '0.5s',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        scale: 1.03,
        glowIntensity: 0.4
      };
    case 'low':
    default:
      return {
        duration: '0.6s',
        easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
        scale: 1.02,
        glowIntensity: 0.3
      };
  }
};

/**
 * Função para cores de estados especiais
 */
export const specialStates = {
  loading: {
    color: '#3b82f6',
    rgb: '59, 130, 246',
    shadow: 'rgba(59, 130, 246, 0.4)'
  },
  complete: {
    color: '#10b981',
    rgb: '16, 185, 129',
    shadow: 'rgba(16, 185, 129, 0.5)'
  },
  error: {
    color: '#ef4444',
    rgb: '239, 68, 68',
    shadow: 'rgba(239, 68, 68, 0.5)'
  },
  disabled: {
    color: '#9ca3af',
    rgb: '156, 163, 175',
    shadow: 'rgba(156, 163, 175, 0.2)'
  }
};

/**
 * Função para gerar gradientes suaves entre estados
 * Útil para transições mais elegantes
 */
export const getGradientColor = (percentual: number): string => {
  const perc = Math.max(0, Math.min(100, percentual));
  
  if (perc >= 90) {
    return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
  }
  
  if (perc >= 70) {
    // Transição suave entre amarelo e vermelho
    const factor = (perc - 70) / 20;
    return `linear-gradient(135deg, #f59e0b ${100 - factor * 50}%, #ef4444 ${factor * 50}%)`;
  }
  
  if (perc >= 50) {
    // Transição suave entre verde e amarelo
    const factor = (perc - 50) / 20;
    return `linear-gradient(135deg, #10b981 ${100 - factor * 50}%, #f59e0b ${factor * 50}%)`;
  }
  
  return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
};

/**
 * Função para determinar contraste de texto
 * Garante acessibilidade visual
 */
export const getTextColor = (backgroundColor: string): string => {
  // Para cores escuras, usar texto claro
  if (backgroundColor === '#ef4444' || backgroundColor === '#dc2626') {
    return '#ffffff';
  }
  
  // Para cores médias, usar texto escuro
  if (backgroundColor === '#f59e0b') {
    return '#1f2937';
  }
  
  // Para cores claras, usar texto escuro
  return '#1f2937';
};

/**
 * Função para cores responsivas baseadas no viewport
 * Ajusta intensidade conforme o tamanho da tela
 */
export const getResponsiveColorConfig = (config: ProgressColorConfig, viewport: 'mobile' | 'tablet' | 'desktop'): ProgressColorConfig => {
  const intensityMap = {
    mobile: { ...config, intensity: 'low' as const },
    tablet: { ...config, intensity: 'medium' as const },
    desktop: config
  };
  
  return intensityMap[viewport];
};

/**
 * Função simplificada que retorna apenas a cor como string
 * Para compatibilidade com componentes que esperam string
 */
export const getProgressColorString = (percentual: number): string => {
  return getProgressColor(percentual).color;
};

/**
 * Hook para cores responsivas em componentes React
 * Detecta automaticamente o viewport e retorna configuração adequada
 */
export const useResponsiveColors = () => {
  // Implementação básica - pode ser expandida com useEffect e window.matchMedia
  const getViewport = (): 'mobile' | 'tablet' | 'desktop' => {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  };
  
  return {
    getColorForViewport: (percentual: number) => {
      const config = getProgressColor(percentual);
      const viewport = getViewport();
      return getResponsiveColorConfig(config, viewport);
    },
    getColorString: getProgressColorString,
    getViewportType: getViewport
  };
};
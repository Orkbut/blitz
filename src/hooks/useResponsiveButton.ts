import { useMemo, CSSProperties } from 'react';

export type UseResponsiveButtonConfig = {
  containerHeight: number;
  containerWidth: number;
  buttonHeight: number;
  isVisible: boolean;
};

export type UseResponsiveButtonResult = {
  style: CSSProperties;
  isVisible: boolean;
  dimensions: {
    width: string;
    height: string;
    fontSize: string;
    padding: string;
  };
};

/**
 * Hook inspirado no useAppointment do react-hook-calendar
 * Garante que botões de ação rápida nunca sejam cortados
 * Aplica responsividade inteligente baseada no container
 */
export function useResponsiveButton(config: UseResponsiveButtonConfig): UseResponsiveButtonResult {
  return useMemo(() => {
    const { containerHeight, containerWidth, buttonHeight, isVisible } = config;

    if (!isVisible) {
      return {
        style: { display: 'none' },
        isVisible: false,
        dimensions: {
          width: '0px',
          height: '0px',
          fontSize: '0px',
          padding: '0px',
        },
      };
    }

    // Cálculos baseados no container (técnica do react-hook-calendar)
    const availableHeight = containerHeight - 30; // Espaço para número do dia e header
    const availableWidth = containerWidth - 8; // Margem lateral

    // Altura responsiva do botão (nunca maior que o espaço disponível)
    const responsiveHeight = Math.min(buttonHeight, availableHeight * 0.25);
    
    // Largura responsiva (sempre cabe no container)
    const responsiveWidth = Math.min(availableWidth, containerWidth * 0.95);

    // Font size baseado na altura do botão
    const fontSize = Math.max(8, Math.min(12, responsiveHeight * 0.6));

    // Padding proporcional
    const verticalPadding = Math.max(1, responsiveHeight * 0.15);
    const horizontalPadding = Math.max(2, responsiveWidth * 0.08);

    return {
      style: {
        width: `${responsiveWidth}px`,
        height: `${responsiveHeight}px`,
        fontSize: `${fontSize}px`,
        padding: `${verticalPadding}px ${horizontalPadding}px`,
        position: 'absolute',
        bottom: '2px',
        left: '50%',
        transform: 'translateX(-50%)',
        boxSizing: 'border-box',
      },
      isVisible: true,
      dimensions: {
        width: `${responsiveWidth}px`,
        height: `${responsiveHeight}px`,
        fontSize: `${fontSize}px`,
        padding: `${verticalPadding}px ${horizontalPadding}px`,
      },
    };
  }, [config.containerHeight, config.containerWidth, config.buttonHeight, config.isVisible]);
}
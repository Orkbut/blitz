/**
 * Hook useResponsive
 * 
 * Hook customizado para detecção de responsividade
 * com breakpoints otimizados para o modal.
 */

import { useState, useEffect } from 'react';
import { constants } from '../utils/constants';

interface ResponsiveState {
  width: number;
  height: number;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
}

export const useResponsive = (): ResponsiveState => {
  const [screenSize, setScreenSize] = useState<ResponsiveState>(() => {
    // Verificação para SSR
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        isMobile: false,
        isTablet: false,
        isDesktop: true
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;

    return {
      width,
      height,
      isMobile: width <= constants.BREAKPOINTS.MOBILE_MAX,
      isTablet: width >= constants.BREAKPOINTS.TABLET_MIN && width <= constants.BREAKPOINTS.TABLET_MAX,
      isDesktop: width >= constants.BREAKPOINTS.DESKTOP_MIN
    };
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setScreenSize({
        width,
        height,
        isMobile: width <= constants.BREAKPOINTS.MOBILE_MAX,
        isTablet: width >= constants.BREAKPOINTS.TABLET_MIN && width <= constants.BREAKPOINTS.TABLET_MAX,
        isDesktop: width >= constants.BREAKPOINTS.DESKTOP_MIN
      });
    };

    window.addEventListener('resize', handleResize);
    
    // Chamada inicial para garantir valores corretos
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return screenSize;
};
/**
 * 🧪 TESTES PARA ACTIVITY TRACKER
 * 
 * Testa detecção de atividade do usuário e visibilidade do documento
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { ActivityTracker, getGlobalActivityTracker, destroyGlobalActivityTracker } from '../hooks/utils/activity-tracker';

// Mock timers
vi.useFakeTimers();

// Mock do DOM
const mockDocument = {
  hidden: false,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

const mockWindow = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock global objects
Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
});

Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
});

describe('ActivityTracker', () => {
  let tracker: ActivityTracker;
  let mockCallback: Mock;
  let mockVisibilityCallback: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallback = vi.fn();
    mockVisibilityCallback = vi.fn();
    
    // Reset document.hidden
    mockDocument.hidden = false;
  });

  afterEach(() => {
    if (tracker) {
      tracker.destroy();
    }
    destroyGlobalActivityTracker();
    vi.clearAllTimers();
  });

  describe('Inicialização', () => {
    it('deve inicializar com configuração padrão', () => {
      tracker = new ActivityTracker();
      const state = tracker.getState();
      
      expect(state.isActive).toBe(true);
      expect(state.isVisible).toBe(true);
      expect(state.lastActivityTime).toBeGreaterThan(0);
    });

    it('deve inicializar com configuração customizada', () => {
      tracker = new ActivityTracker({
        inactivityTimeout: 30000,
        checkInterval: 2000,
        debug: true
      });
      
      const state = tracker.getState();
      expect(state.isActive).toBe(true);
      expect(state.isVisible).toBe(true);
    });

    it('deve configurar event listeners', () => {
      tracker = new ActivityTracker();
      
      // Verificar se addEventListener foi chamado para eventos de atividade
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'mousedown', 
        expect.any(Function), 
        { passive: true }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'mousemove', 
        expect.any(Function), 
        { passive: true }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        'keypress', 
        expect.any(Function), 
        { passive: true }
      );
      
      // Verificar se addEventListener foi chamado para visibilidade
      expect(mockDocument.addEventListener).toHaveBeenCalledWith(
        'visibilitychange',
        expect.any(Function)
      );
    });
  });

  describe('Detecção de Atividade', () => {
    beforeEach(() => {
      tracker = new ActivityTracker({
        inactivityTimeout: 1000, // 1 segundo para testes
        checkInterval: 100       // 100ms para testes
      });
    });

    it('deve detectar atividade do usuário', () => {
      tracker.addActivityListener(mockCallback);
      
      // Simular inatividade
      vi.advanceTimersByTime(1500);
      tracker.checkInactivity();
      
      expect(tracker.getState().isActive).toBe(false);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          isVisible: true
        })
      );
      
      // Simular atividade
      tracker.updateActivity();
      
      expect(tracker.getState().isActive).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: true,
          isVisible: true
        })
      );
    });

    it('deve verificar inatividade automaticamente', () => {
      tracker.addActivityListener(mockCallback);
      
      // Avançar tempo para trigger da verificação automática
      vi.advanceTimersByTime(1200);
      
      expect(tracker.getState().isActive).toBe(false);
      expect(mockCallback).toHaveBeenCalled();
    });

    it('deve atualizar timestamp da última atividade', () => {
      const initialTime = tracker.getState().lastActivityTime;
      
      // Aguardar um pouco
      vi.advanceTimersByTime(100);
      
      tracker.updateActivity();
      const newTime = tracker.getState().lastActivityTime;
      
      expect(newTime).toBeGreaterThan(initialTime);
    });
  });

  describe('Detecção de Visibilidade', () => {
    beforeEach(() => {
      tracker = new ActivityTracker();
    });

    it('deve detectar mudanças de visibilidade', () => {
      tracker.addVisibilityListener(mockVisibilityCallback);
      
      // Simular aba ficando oculta
      mockDocument.hidden = true;
      
      // Simular evento de mudança de visibilidade
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1];
      
      if (visibilityHandler) {
        visibilityHandler();
      }
      
      expect(mockVisibilityCallback).toHaveBeenCalledWith(false);
      expect(tracker.getState().isVisible).toBe(false);
      
      // Simular aba ficando visível
      mockDocument.hidden = false;
      
      if (visibilityHandler) {
        visibilityHandler();
      }
      
      expect(mockVisibilityCallback).toHaveBeenCalledWith(true);
      expect(tracker.getState().isVisible).toBe(true);
    });
  });

  describe('Gerenciamento de Listeners', () => {
    beforeEach(() => {
      tracker = new ActivityTracker();
    });

    it('deve adicionar e remover listeners de atividade', () => {
      tracker.addActivityListener(mockCallback);
      
      // Simular mudança de atividade
      tracker.updateActivity();
      
      // Remover listener
      tracker.removeActivityListener(mockCallback);
      
      // Simular outra mudança - callback não deve ser chamado
      tracker.updateActivity();
      
      expect(mockCallback).toHaveBeenCalledTimes(0); // Não foi chamado pois estava ativo
    });

    it('deve adicionar e remover listeners de visibilidade', () => {
      tracker.addVisibilityListener(mockVisibilityCallback);
      
      // Remover listener
      tracker.removeVisibilityListener(mockVisibilityCallback);
      
      // Simular mudança de visibilidade
      mockDocument.hidden = true;
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1];
      
      if (visibilityHandler) {
        visibilityHandler();
      }
      
      expect(mockVisibilityCallback).not.toHaveBeenCalled();
    });

    it('deve tratar erros em callbacks graciosamente', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      tracker.addActivityListener(errorCallback);
      
      // Simular mudança de estado para ativar callback
      vi.advanceTimersByTime(1500);
      tracker.checkInactivity(); // Tornar inativo
      tracker.updateActivity(); // Tornar ativo novamente - isso deve chamar o callback
      
      // Não deve quebrar o tracker
      expect(tracker.getState().isActive).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[ActivityTracker] Error in activity callback:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      tracker = new ActivityTracker();
    });

    it('deve limpar recursos ao destruir', () => {
      tracker.addActivityListener(mockCallback);
      tracker.addVisibilityListener(mockVisibilityCallback);
      
      tracker.destroy();
      
      // Verificar se removeEventListener foi chamado
      expect(mockWindow.removeEventListener).toHaveBeenCalled();
      expect(mockDocument.removeEventListener).toHaveBeenCalled();
    });
  });

  describe('Global Activity Tracker', () => {
    it('deve retornar mesma instância global', () => {
      const tracker1 = getGlobalActivityTracker();
      const tracker2 = getGlobalActivityTracker();
      
      expect(tracker1).toBe(tracker2);
    });

    it('deve destruir instância global', () => {
      const globalTracker = getGlobalActivityTracker();
      const destroySpy = vi.spyOn(globalTracker, 'destroy');
      
      destroyGlobalActivityTracker();
      
      expect(destroySpy).toHaveBeenCalled();
    });

    it('deve criar nova instância após destruir global', () => {
      const tracker1 = getGlobalActivityTracker();
      destroyGlobalActivityTracker();
      const tracker2 = getGlobalActivityTracker();
      
      expect(tracker1).not.toBe(tracker2);
    });
  });
});
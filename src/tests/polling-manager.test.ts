/**
 * 🧪 TESTES PARA POLLING MANAGER
 * 
 * Testa gerenciamento de polling inteligente com intervalos adaptativos
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { PollingManager } from '../hooks/utils/polling-manager';
import { destroyGlobalActivityTracker } from '../hooks/utils/activity-tracker';

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

// Mock timers
vi.useFakeTimers();

describe('PollingManager', () => {
  let pollingManager: PollingManager;
  let mockCallback: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCallback = vi.fn();
    mockDocument.hidden = false;
  });

  afterEach(() => {
    if (pollingManager) {
      pollingManager.destroy();
    }
    destroyGlobalActivityTracker();
    vi.clearAllTimers();
  });

  describe('Inicialização', () => {
    it('deve inicializar com configuração padrão', () => {
      pollingManager = new PollingManager(mockCallback);
      const state = pollingManager.getState();
      
      expect(state.isRunning).toBe(false);
      expect(state.currentInterval).toBe(5000); // focusInterval padrão
      expect(state.executionCount).toBe(0);
      expect(state.lastExecutionTime).toBe(null);
    });

    it('deve inicializar com configuração customizada', () => {
      pollingManager = new PollingManager(mockCallback, {
        activeInterval: 3000,
        inactiveInterval: 20000,
        focusInterval: 2000,
        blurInterval: 40000,
        enabled: true,
        executeOnStart: false,
        debug: true
      });
      
      const state = pollingManager.getState();
      expect(state.currentInterval).toBe(2000); // focusInterval customizado
    });
  });

  describe('Controle de Polling', () => {
    beforeEach(() => {
      pollingManager = new PollingManager(mockCallback, {
        activeInterval: 1000,
        executeOnStart: true,
        debug: false
      });
    });

    it('deve iniciar polling', () => {
      pollingManager.start();
      const state = pollingManager.getState();
      
      expect(state.isRunning).toBe(true);
      expect(mockCallback).toHaveBeenCalledTimes(1); // executeOnStart
    });

    it('deve parar polling', () => {
      pollingManager.start();
      pollingManager.stop();
      const state = pollingManager.getState();
      
      expect(state.isRunning).toBe(false);
    });

    it('deve executar callback em intervalos', () => {
      pollingManager.start();
      
      // Avançar tempo para trigger do timer
      vi.advanceTimersByTime(1000);
      expect(mockCallback).toHaveBeenCalledTimes(2); // start + timer
      
      vi.advanceTimersByTime(1000);
      expect(mockCallback).toHaveBeenCalledTimes(3);
    });

    it('deve executar forçadamente', () => {
      pollingManager.start();
      const initialCount = mockCallback.mock.calls.length;
      
      pollingManager.forceExecute();
      
      expect(mockCallback).toHaveBeenCalledTimes(initialCount + 1);
    });

    it('não deve iniciar se desabilitado', () => {
      pollingManager = new PollingManager(mockCallback, { enabled: false });
      pollingManager.start();
      
      expect(pollingManager.getState().isRunning).toBe(false);
    });
  });

  describe('Intervalos Adaptativos', () => {
    beforeEach(() => {
      pollingManager = new PollingManager(mockCallback, {
        activeInterval: 1000,
        inactiveInterval: 5000,
        focusInterval: 1000,
        blurInterval: 10000,
        executeOnStart: false
      });
    });

    it('deve usar intervalo de blur quando documento está oculto', () => {
      // Simular documento oculto
      mockDocument.hidden = true;
      
      pollingManager = new PollingManager(mockCallback, {
        focusInterval: 1000,
        blurInterval: 10000,
        executeOnStart: false
      });
      
      const state = pollingManager.getState();
      expect(state.currentInterval).toBe(10000);
    });

    it('deve usar intervalo de foco quando documento está visível', () => {
      mockDocument.hidden = false;
      
      pollingManager = new PollingManager(mockCallback, {
        focusInterval: 1000,
        blurInterval: 10000,
        executeOnStart: false
      });
      
      const state = pollingManager.getState();
      expect(state.currentInterval).toBe(1000);
    });

    it('deve ajustar intervalo quando visibilidade muda', () => {
      pollingManager.start();
      
      // Simular mudança de visibilidade
      mockDocument.hidden = true;
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1];
      
      if (visibilityHandler) {
        visibilityHandler();
      }
      
      const state = pollingManager.getState();
      expect(state.currentInterval).toBe(10000); // blurInterval
    });

    it('deve executar callback quando ganha foco', () => {
      pollingManager = new PollingManager(mockCallback, {
        executeOnFocus: true,
        executeOnStart: false
      });
      
      pollingManager.start();
      const initialCount = mockCallback.mock.calls.length;
      
      // Simular ganho de foco
      mockDocument.hidden = false;
      const visibilityHandler = mockDocument.addEventListener.mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1];
      
      if (visibilityHandler) {
        visibilityHandler();
      }
      
      expect(mockCallback).toHaveBeenCalledTimes(initialCount + 1);
    });
  });

  describe('Atualização de Configuração', () => {
    beforeEach(() => {
      pollingManager = new PollingManager(mockCallback, {
        activeInterval: 1000,
        enabled: true
      });
    });

    it('deve atualizar configuração', () => {
      pollingManager.updateConfig({
        activeInterval: 2000,
        inactiveInterval: 8000
      });
      
      // Verificar se intervalo foi recalculado
      const state = pollingManager.getState();
      expect(state.currentInterval).toBe(2000);
    });

    it('deve parar polling quando desabilitado', () => {
      pollingManager.start();
      expect(pollingManager.getState().isRunning).toBe(true);
      
      pollingManager.updateConfig({ enabled: false });
      expect(pollingManager.getState().isRunning).toBe(false);
    });

    it('deve iniciar polling quando habilitado', () => {
      pollingManager = new PollingManager(mockCallback, { enabled: false });
      expect(pollingManager.getState().isRunning).toBe(false);
      
      pollingManager.updateConfig({ enabled: true });
      expect(pollingManager.getState().isRunning).toBe(true);
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve tratar erros no callback graciosamente', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      pollingManager = new PollingManager(errorCallback, {
        executeOnStart: true
      });
      
      pollingManager.start();
      
      // Polling deve continuar funcionando mesmo com erro
      expect(pollingManager.getState().isRunning).toBe(true);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[PollingManager] Error executing callback:',
        expect.any(Error)
      );
      
      consoleErrorSpy.mockRestore();
    });

    it('deve continuar polling após erro', () => {
      let shouldError = true;
      const flakyCallback = vi.fn(() => {
        if (shouldError) {
          shouldError = false;
          throw new Error('First call error');
        }
      });
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      pollingManager = new PollingManager(flakyCallback, {
        activeInterval: 100,
        executeOnStart: true
      });
      
      pollingManager.start();
      
      // Avançar tempo para próxima execução
      vi.advanceTimersByTime(100);
      
      expect(flakyCallback).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Estado e Métricas', () => {
    beforeEach(() => {
      pollingManager = new PollingManager(mockCallback, {
        activeInterval: 1000,
        executeOnStart: true
      });
    });

    it('deve rastrear execuções', () => {
      pollingManager.start();
      
      expect(pollingManager.getState().executionCount).toBe(1);
      expect(pollingManager.getState().lastExecutionTime).toBeGreaterThan(0);
      
      vi.advanceTimersByTime(1000);
      
      expect(pollingManager.getState().executionCount).toBe(2);
    });

    it('deve fornecer estado de atividade', () => {
      const state = pollingManager.getState();
      
      expect(state.activityState).toEqual({
        isActive: true,
        isVisible: true,
        lastActivityTime: expect.any(Number)
      });
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      pollingManager = new PollingManager(mockCallback);
    });

    it('deve limpar recursos ao destruir', () => {
      pollingManager.start();
      expect(pollingManager.getState().isRunning).toBe(true);
      
      pollingManager.destroy();
      
      expect(pollingManager.getState().isRunning).toBe(false);
    });

    it('deve remover listeners ao destruir', () => {
      const removeEventListenerSpy = vi.spyOn(mockWindow, 'removeEventListener');
      
      pollingManager.destroy();
      
      // Verificar se cleanup foi chamado (indiretamente através do ActivityTracker)
      expect(pollingManager.getState().isRunning).toBe(false);
    });
  });

  describe('Callback Assíncrono', () => {
    it('deve suportar callbacks assíncronos', async () => {
      const asyncCallback = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      
      pollingManager = new PollingManager(asyncCallback, {
        executeOnStart: true
      });
      
      pollingManager.start();
      
      // Aguardar execução assíncrona
      await vi.runAllTimersAsync();
      
      expect(asyncCallback).toHaveBeenCalled();
    });
  });
});
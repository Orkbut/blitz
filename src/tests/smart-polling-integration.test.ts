/**
 * 🧪 TESTE DE INTEGRAÇÃO - SMART POLLING
 * 
 * Testa a funcionalidade básica do sistema de polling inteligente
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Smart Polling Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('deve importar utilitários sem erro', async () => {
    const { ActivityTracker } = await import('../hooks/utils/activity-tracker');
    const { PollingManager } = await import('../hooks/utils/polling-manager');
    
    expect(ActivityTracker).toBeDefined();
    expect(PollingManager).toBeDefined();
  });

  it('deve criar ActivityTracker com configuração básica', async () => {
    const { ActivityTracker } = await import('../hooks/utils/activity-tracker');
    
    // Mock DOM
    Object.defineProperty(global, 'document', {
      value: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    });

    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    });

    const tracker = new ActivityTracker({
      inactivityTimeout: 5000,
      debug: false
    });

    const state = tracker.getState();
    
    expect(state.isActive).toBe(true);
    expect(state.isVisible).toBe(true);
    expect(state.lastActivityTime).toBeGreaterThan(0);

    tracker.destroy();
  });

  it('deve criar PollingManager com callback básico', async () => {
    const { PollingManager } = await import('../hooks/utils/polling-manager');
    
    // Mock DOM
    Object.defineProperty(global, 'document', {
      value: {
        hidden: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    });

    Object.defineProperty(global, 'window', {
      value: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      },
      writable: true
    });

    const mockCallback = vi.fn();
    const manager = new PollingManager(mockCallback, {
      activeInterval: 1000,
      enabled: true,
      executeOnStart: false,
      debug: false
    });

    const state = manager.getState();
    
    expect(state.isRunning).toBe(false);
    expect(state.currentInterval).toBeGreaterThan(0);
    expect(state.executionCount).toBe(0);

    manager.destroy();
  });

  it('deve validar que os utilitários estão exportados corretamente', async () => {
    const utils = await import('../hooks/utils/index');
    
    expect(utils.ActivityTracker).toBeDefined();
    expect(utils.PollingManager).toBeDefined();
    expect(utils.getGlobalActivityTracker).toBeDefined();
    expect(utils.destroyGlobalActivityTracker).toBeDefined();
  });
});
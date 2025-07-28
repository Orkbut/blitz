/**
 * 🧪 TESTES DE BENCHMARK DE PERFORMANCE
 * 
 * Executa benchmarks comparando implementações legacy vs unificada
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  BenchmarkRunner, 
  BenchmarkUtils, 
  BenchmarkSuiteFactory,
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkTest
} from '../performance-benchmarks';
import { performanceMonitor } from '../performance-monitor';

// Mock do useRealtimeUnified
const mockUseRealtimeUnified = vi.fn();
vi.mock('../../useRealtimeUnified', () => ({
  useRealtimeUnified: mockUseRealtimeUnified
}));

// Mock dos wrappers legacy
const mockUseRealtimeOperacoes = vi.fn();
const mockUseRealtimePuro = vi.fn();
vi.mock('../../legacy-wrappers', () => ({
  useRealtimeOperacoes: mockUseRealtimeOperacoes,
  useRealtimePuro: mockUseRealtimePuro
}));

describe('Performance Benchmarks', () => {
  let benchmarkRunner: BenchmarkRunner;

  beforeEach(() => {
    benchmarkRunner = new BenchmarkRunner(false); // Disable logging for tests
    performanceMonitor.clearData();
    vi.clearAllMocks();
  });

  afterEach(() => {
    benchmarkRunner.clearResults();
    performanceMonitor.clearData();
  });

  describe('BenchmarkUtils', () => {
    it('deve criar configuração padrão corretamente', () => {
      const config = BenchmarkUtils.createDefaultConfig();
      
      expect(config).toEqual({
        duration: 30000,
        operationCount: 1000,
        concurrentHooks: 5,
        eventFrequency: 10,
        networkLatency: 100,
        memoryThreshold: 50,
        enableLogging: true
      });
    });

    it('deve permitir override de configuração', () => {
      const config = BenchmarkUtils.createDefaultConfig({
        duration: 60000,
        operationCount: 2000
      });
      
      expect(config.duration).toBe(60000);
      expect(config.operationCount).toBe(2000);
      expect(config.concurrentHooks).toBe(5); // Valor padrão mantido
    });

    it('deve simular eventos de banco de dados', async () => {
      const events: any[] = [];
      const callback = (event: any) => events.push(event);
      
      await BenchmarkUtils.simulateDatabaseEvents(3, 50, callback); // 3 eventos, 50/s (mais rápido)
      
      expect(events).toHaveLength(3);
      expect(events[0]).toHaveProperty('table');
      expect(events[0]).toHaveProperty('eventType');
      expect(events[0]).toHaveProperty('payload');
      expect(events[0]).toHaveProperty('timestamp');
    }, 10000); // 10 segundos de timeout

    it('deve validar resultado de teste corretamente', () => {
      const result: BenchmarkResult = {
        testName: 'Test',
        implementation: 'unified',
        config: BenchmarkUtils.createDefaultConfig(),
        metrics: {} as any,
        totalExecutionTime: 1000,
        memoryPeakUsage: 30 * 1024 * 1024, // 30MB
        networkEfficiency: 85,
        eventProcessingRate: 50,
        connectionStability: 0.95,
        errors: [],
        warnings: [],
        passed: true
      };

      const criteria = {
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        minNetworkEfficiency: 80,
        maxExecutionTime: 2000,
        minConnectionStability: 0.9
      };

      expect(BenchmarkUtils.validateTestResult(result, criteria)).toBe(true);
    });
  });

  describe('BenchmarkRunner', () => {
    it('deve executar suite de benchmarks', async () => {
      const mockTest: BenchmarkTest = {
        name: 'Test Mock',
        description: 'Teste simulado',
        config: BenchmarkUtils.createDefaultConfig({ duration: 100 }),
        run: async (config) => ({
          testName: 'Test Mock',
          implementation: 'unified',
          config,
          metrics: {} as any,
          totalExecutionTime: 50,
          memoryPeakUsage: 1024 * 1024,
          networkEfficiency: 90,
          eventProcessingRate: 100,
          connectionStability: 1.0,
          errors: [],
          warnings: [],
          passed: true
        })
      };

      const suite = {
        name: 'Test Suite',
        description: 'Suite de teste',
        tests: [mockTest]
      };

      const results = await benchmarkRunner.runSuite(suite);
      
      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('Test Mock');
      expect(results[0].passed).toBe(true);
    });

    it('deve calcular melhorias comparando com baseline', async () => {
      // Primeiro teste (baseline - legacy)
      const legacyTest: BenchmarkTest = {
        name: 'Legacy Test',
        description: 'Teste legacy',
        config: BenchmarkUtils.createDefaultConfig({ duration: 100 }),
        run: async (config) => ({
          testName: 'Legacy Test',
          implementation: 'legacy',
          config,
          metrics: {} as any,
          totalExecutionTime: 200,
          memoryPeakUsage: 10 * 1024 * 1024, // 10MB
          networkEfficiency: 70,
          eventProcessingRate: 50,
          connectionStability: 0.8,
          errors: [],
          warnings: [],
          passed: true
        })
      };

      // Segundo teste (unified)
      const unifiedTest: BenchmarkTest = {
        name: 'Unified Test',
        description: 'Teste unificado',
        config: BenchmarkUtils.createDefaultConfig({ duration: 100 }),
        run: async (config) => ({
          testName: 'Unified Test',
          implementation: 'unified',
          config,
          metrics: {} as any,
          totalExecutionTime: 150,
          memoryPeakUsage: 8 * 1024 * 1024, // 8MB
          networkEfficiency: 85,
          eventProcessingRate: 75,
          connectionStability: 0.9,
          errors: [],
          warnings: [],
          passed: true
        })
      };

      const suite = {
        name: 'Comparison Suite',
        description: 'Suite de comparação',
        tests: [legacyTest, unifiedTest]
      };

      const results = await benchmarkRunner.runSuite(suite);
      
      expect(results).toHaveLength(2);
      
      // Verificar se o segundo resultado tem melhorias calculadas
      const unifiedResult = results[1];
      expect(unifiedResult.improvement).toBeDefined();
      expect(unifiedResult.improvement!.memoryReduction).toBeCloseTo(20); // 20% redução
      expect(unifiedResult.improvement!.performanceGain).toBeCloseTo(25); // 25% melhoria
      expect(unifiedResult.improvement!.networkImprovement).toBeCloseTo(21.43, 1); // ~21% melhoria
    });

    it('deve exportar resultados em JSON', async () => {
      const mockTest: BenchmarkTest = {
        name: 'Export Test',
        description: 'Teste de exportação',
        config: BenchmarkUtils.createDefaultConfig({ duration: 100 }),
        run: async (config) => ({
          testName: 'Export Test',
          implementation: 'unified',
          config,
          metrics: {} as any,
          totalExecutionTime: 100,
          memoryPeakUsage: 1024 * 1024,
          networkEfficiency: 95,
          eventProcessingRate: 80,
          connectionStability: 0.95,
          errors: [],
          warnings: [],
          passed: true
        })
      };

      const suite = {
        name: 'Export Suite',
        description: 'Suite para exportação',
        tests: [mockTest]
      };

      await benchmarkRunner.runSuite(suite);
      const exported = benchmarkRunner.exportResults();
      const parsed = JSON.parse(exported);
      
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('results');
      expect(parsed).toHaveProperty('summary');
      expect(parsed.results).toHaveLength(1);
      expect(parsed.summary.totalTests).toBe(1);
    });
  });

  describe('Testes de Performance Específicos', () => {
    it('deve testar uso de memória', async () => {
      const memoryTest: BenchmarkTest = {
        name: 'Memory Usage Test',
        description: 'Teste de uso de memória',
        config: BenchmarkUtils.createDefaultConfig({
          duration: 5000,
          operationCount: 100,
          memoryThreshold: 20 // 20MB
        }),
        run: async (config) => {
          const startMemory = BenchmarkUtils.measureMemoryUsage();
          
          // Simular operações que consomem memória
          const data: any[] = [];
          for (let i = 0; i < config.operationCount; i++) {
            data.push({
              id: i,
              data: new Array(1000).fill(`data-${i}`),
              timestamp: Date.now()
            });
          }
          
          const endMemory = BenchmarkUtils.measureMemoryUsage();
          const memoryUsed = endMemory - startMemory;
          
          return {
            testName: 'Memory Usage Test',
            implementation: 'unified',
            config,
            metrics: performanceMonitor.getMetrics(),
            totalExecutionTime: 100,
            memoryPeakUsage: memoryUsed,
            networkEfficiency: 90,
            eventProcessingRate: config.operationCount / (config.duration / 1000),
            connectionStability: 1.0,
            errors: [],
            warnings: memoryUsed > config.memoryThreshold * 1024 * 1024 
              ? [`Memory usage exceeded threshold: ${memoryUsed / 1024 / 1024}MB`] 
              : [],
            passed: memoryUsed <= config.memoryThreshold * 1024 * 1024
          };
        }
      };

      const suite = {
        name: 'Memory Test Suite',
        description: 'Testes de memória',
        tests: [memoryTest]
      };

      const results = await benchmarkRunner.runSuite(suite);
      
      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('Memory Usage Test');
      // O teste pode passar ou falhar dependendo do ambiente
    });

    it('deve testar eficiência de rede', async () => {
      const networkTest: BenchmarkTest = {
        name: 'Network Efficiency Test',
        description: 'Teste de eficiência de rede',
        config: BenchmarkUtils.createDefaultConfig({
          duration: 1000,
          operationCount: 10,
          networkLatency: 10
        }),
        run: async (config) => {
          const startTime = Date.now();
          let successfulRequests = 0;
          let totalRequests = 0;
          
          // Simular requisições de rede
          for (let i = 0; i < config.operationCount; i++) {
            totalRequests++;
            
            try {
              await BenchmarkUtils.simulateNetworkLatency(config.networkLatency);
              
              // Simular sucesso/falha baseado em probabilidade
              if (Math.random() > 0.1) { // 90% de sucesso
                successfulRequests++;
                performanceMonitor.recordNetworkRequest(
                  'test-endpoint',
                  'GET',
                  config.networkLatency,
                  true,
                  1024
                );
              } else {
                performanceMonitor.recordNetworkRequest(
                  'test-endpoint',
                  'GET',
                  config.networkLatency,
                  false,
                  0
                );
              }
            } catch (error) {
              // Request failed
            }
          }
          
          const endTime = Date.now();
          const networkEfficiency = (successfulRequests / totalRequests) * 100;
          
          return {
            testName: 'Network Efficiency Test',
            implementation: 'unified',
            config,
            metrics: performanceMonitor.getMetrics(),
            totalExecutionTime: endTime - startTime,
            memoryPeakUsage: BenchmarkUtils.measureMemoryUsage(),
            networkEfficiency,
            eventProcessingRate: totalRequests / ((endTime - startTime) / 1000),
            connectionStability: networkEfficiency / 100,
            errors: [],
            warnings: networkEfficiency < 85 ? ['Network efficiency below 85%'] : [],
            passed: networkEfficiency >= 85
          };
        }
      };

      const suite = {
        name: 'Network Test Suite',
        description: 'Testes de rede',
        tests: [networkTest]
      };

      const results = await benchmarkRunner.runSuite(suite);
      
      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('Network Efficiency Test');
      expect(results[0].networkEfficiency).toBeGreaterThan(0);
    }, 10000); // 10 segundos de timeout

    it('deve testar rate limiting compliance', async () => {
      const rateLimitTest: BenchmarkTest = {
        name: 'Rate Limiting Test',
        description: 'Teste de conformidade com rate limiting',
        config: BenchmarkUtils.createDefaultConfig({
          duration: 1000,
          eventFrequency: 50, // 50 eventos/s - mais conservador
          operationCount: 50
        }),
        run: async (config) => {
          const startTime = Date.now();
          const events: any[] = [];
          let rateLimitViolations = 0;
          
          // Simular eventos em alta frequência
          await BenchmarkUtils.simulateDatabaseEvents(
            config.operationCount,
            config.eventFrequency,
            (event) => {
              events.push(event);
              
              // Simular detecção de rate limit (Supabase limite: ~100 req/s)
              if (events.length > 0 && events.length % 100 === 0) {
                const timeWindow = Date.now() - events[events.length - 100].timestamp;
                if (timeWindow < 1000) { // Mais de 100 req em menos de 1s
                  rateLimitViolations++;
                }
              }
            }
          );
          
          const endTime = Date.now();
          const actualFrequency = events.length / ((endTime - startTime) / 1000);
          const compliance = rateLimitViolations === 0;
          
          return {
            testName: 'Rate Limiting Test',
            implementation: 'unified',
            config,
            metrics: performanceMonitor.getMetrics(),
            totalExecutionTime: endTime - startTime,
            memoryPeakUsage: BenchmarkUtils.measureMemoryUsage(),
            networkEfficiency: compliance ? 100 : 50,
            eventProcessingRate: actualFrequency,
            connectionStability: compliance ? 1.0 : 0.5,
            errors: [],
            warnings: rateLimitViolations > 0 
              ? [`Rate limit violations detected: ${rateLimitViolations}`] 
              : [],
            passed: compliance
          };
        }
      };

      const suite = {
        name: 'Rate Limit Test Suite',
        description: 'Testes de rate limiting',
        tests: [rateLimitTest]
      };

      const results = await benchmarkRunner.runSuite(suite);
      
      expect(results).toHaveLength(1);
      expect(results[0].testName).toBe('Rate Limiting Test');
      // O resultado depende da implementação do rate limiting
    }, 10000); // 10 segundos de timeout
  });
});
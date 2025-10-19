import { supabase, ParametroSistema } from '../database/supabase';

export class ParametrizacaoService {
  private static instance: ParametrizacaoService;
  private cache: Map<string, any> = new Map();
  private lastUpdate: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

  private constructor() {}

  static getInstance(): ParametrizacaoService {
    if (!ParametrizacaoService.instance) {
      ParametrizacaoService.instance = new ParametrizacaoService();
    }
    return ParametrizacaoService.instance;
  }

  async obterParametro<T = any>(nomeParametro: string): Promise<T> {
    if (this.isCacheValido() && this.cache.has(nomeParametro)) {
      return this.cache.get(nomeParametro);
    }

    const { data, error } = await supabase
      .from('parametros_sistema')
      .select('*')
      .eq('nome_parametro', nomeParametro)
      .single();

    if (error || !data) {
      throw new Error(`Parâmetro '${nomeParametro}' não encontrado`);
    }

    const valor = this.converterValor(data.valor_atual, data.tipo_valor);
    this.cache.set(nomeParametro, valor);
    
    return valor;
  }

  async obterLimiteCicloFuncional(): Promise<number> {
    return this.obterParametro<number>('LIMITE_CICLO_FUNCIONAL');
  }

  getSupabaseClient() {
    return supabase;
  }

  private converterValor(valor: string, tipo: string): any {
    switch (tipo) {
      case 'INTEGER':
        return parseInt(valor, 10);
      case 'DECIMAL':
        return parseFloat(valor);
      case 'BOOLEAN':
        return valor.toLowerCase() === 'true';
      case 'STRING':
      default:
        return valor;
    }
  }

  private isCacheValido(): boolean {
    if (!this.lastUpdate) {
      this.lastUpdate = new Date();
      return false;
    }
    return (Date.now() - this.lastUpdate.getTime()) < this.CACHE_DURATION;
  }

  limparCache(): void {
    this.cache.clear();
    this.lastUpdate = null;
  }
} 
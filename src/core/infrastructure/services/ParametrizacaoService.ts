import { createClient } from '@supabase/supabase-js';

export class ParametrizacaoService {
  private static instance: ParametrizacaoService;
  private parametros: Map<string, any> = new Map();
  private ultimaAtualizacao: Date | null = null;
  private supabase;

  private constructor() {
    // Configuração do Supabase - em produção, usar variáveis de ambiente
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  public static getInstance(): ParametrizacaoService {
    if (!ParametrizacaoService.instance) {
      ParametrizacaoService.instance = new ParametrizacaoService();
    }
    return ParametrizacaoService.instance;
  }

  private async carregarParametros(): Promise<void> {
    try {
      const { data, error } = await this.supabase
        .from('parametros_sistema')
        .select('nome_parametro, valor_atual, tipo_valor');

      if (error) throw error;

      // Limpar cache e recarregar
      this.parametros.clear();

      data?.forEach(param => {
        let valor: any = param.valor_atual;
        
        // Converter valor conforme o tipo
        switch (param.tipo_valor) {
          case 'INTEGER':
            valor = parseInt(param.valor_atual);
            break;
          case 'DECIMAL':
            valor = parseFloat(param.valor_atual);
            break;
          case 'BOOLEAN':
            valor = param.valor_atual.toLowerCase() === 'true';
            break;
          // STRING mantém como está
        }

        this.parametros.set(param.nome_parametro, valor);
      });

      this.ultimaAtualizacao = new Date();
      // Parameters loaded logging removed for performance
    } catch (error) {
      console.error('Erro ao carregar parâmetros do Supabase:', error);
      // Em caso de erro, usar valores padrão
      this.carregarParametrosPadrao();
    }
  }

  private carregarParametrosPadrao(): void {
    // Valores de fallback em caso de erro na conexão
    this.parametros.set('VALOR_DIARIA_COMPLETA', 137.78);
    this.parametros.set('VALOR_MEIA_DIARIA', 68.89);
    this.parametros.set('LIMITE_MENSAL_DIARIAS', 15);
    this.parametros.set('LIMITE_CICLO_FUNCIONAL', 15);
    this.parametros.set('LIMITE_MIN_PARTICIPANTES', 2);
    this.parametros.set('LIMITE_MAX_PARTICIPANTES', 30);

    this.parametros.set('PRAZO_MAX_JANELA_MESES', 2);
  }

  private async atualizarSeNecessario(): Promise<void> {
    const agora = new Date();
    
    // Recarregar a cada 5 minutos ou se não foi carregado ainda
    if (!this.ultimaAtualizacao || 
        (agora.getTime() - this.ultimaAtualizacao.getTime()) > 5 * 60 * 1000) {
      await this.carregarParametros();
    }
  }

  public async obterParametro<T>(nomeParametro: string): Promise<T> {
    await this.atualizarSeNecessario();
    
    const valor = this.parametros.get(nomeParametro);
    if (valor === undefined) {
      console.warn(`Parâmetro não encontrado: ${nomeParametro}`);
      throw new Error(`Parâmetro ${nomeParametro} não encontrado no sistema`);
    }
    
    return valor as T;
  }

  // Métodos específicos para parâmetros mais usados
  public async valorDiariaCompleta(): Promise<number> {
    return this.obterParametro<number>('VALOR_DIARIA_COMPLETA');
  }

  public async valorMeiaDiaria(): Promise<number> {
    return this.obterParametro<number>('VALOR_MEIA_DIARIA');
  }

  public async limiteMensalDiarias(): Promise<number> {
    return this.obterParametro<number>('LIMITE_MENSAL_DIARIAS');
  }

  public async limiteCicloFuncional(): Promise<number> {
    return this.obterParametro<number>('LIMITE_CICLO_FUNCIONAL');
  }

  public async limiteMinParticipantes(): Promise<number> {
    return this.obterParametro<number>('LIMITE_MIN_PARTICIPANTES');
  }

  public async limiteMaxParticipantes(): Promise<number> {
    return this.obterParametro<number>('LIMITE_MAX_PARTICIPANTES');
  }

  // Método para forçar recarregamento
  public async recarregarParametros(): Promise<void> {
    await this.carregarParametros();
  }

  /**
   * ✅ Busca parâmetros de limite para validações do supervisor
   */
  async buscarParametrosLimite(): Promise<{
    limiteCicloFuncional: number;
    limiteMensalDiarias: number;
  }> {
    await this.atualizarSeNecessario();

    return {
      limiteCicloFuncional: this.parametros.get('LIMITE_CICLO_FUNCIONAL') || 15,
      limiteMensalDiarias: this.parametros.get('LIMITE_MENSAL_DIARIAS') || 15
    };
  }
} 
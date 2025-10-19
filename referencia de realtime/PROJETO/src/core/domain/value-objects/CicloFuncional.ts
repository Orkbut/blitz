export interface CicloFuncionalProps {
  dataInicio: Date;
  dataFim: Date;
  ativo: boolean;
}

export class CicloFuncional {
  private constructor(private readonly props: CicloFuncionalProps) {
    this.validar();
  }

  static create(dataInicio: Date, dataFim: Date): CicloFuncional {
    return new CicloFuncional({
      dataInicio,
      dataFim,
      ativo: true
    });
  }

  static createFromDate(dataReferencia: Date): CicloFuncional {
    const { inicio, fim } = CicloFuncional.calcularPeriodoCiclo(dataReferencia);
    
    return new CicloFuncional({
      dataInicio: inicio,
      dataFim: fim,
      ativo: true
    });
  }

  static fromPersistence(props: CicloFuncionalProps): CicloFuncional {
    return new CicloFuncional(props);
  }

  private validar(): void {
    if (this.props.dataInicio >= this.props.dataFim) {
      throw new Error('Data de início deve ser anterior à data de fim');
    }

    const duracaoDias = this.calcularDuracaoDias();
    if (duracaoDias < 28 || duracaoDias > 31) {
      throw new Error('Ciclo funcional deve ter entre 28 e 31 dias');
    }
  }

  // Lógica principal: calcular período 10→09 baseado na data
  private static calcularPeriodoCiclo(dataReferencia: Date): { inicio: Date; fim: Date } {
    const ano = dataReferencia.getFullYear();
    const mes = dataReferencia.getMonth();

    // Período sempre vai do dia 10 do mês atual até dia 09 do mês seguinte
    const dataInicio = new Date(ano, mes, 10, 0, 0, 0, 0);
    
    // Próximo mês para o dia 09
    const proximoMes = mes === 11 ? 0 : mes + 1;
    const proximoAno = mes === 11 ? ano + 1 : ano;
    const dataFim = new Date(proximoAno, proximoMes, 9, 23, 59, 59, 999);

    return { inicio: dataInicio, fim: dataFim };
  }

  // Getters
  get dataInicio(): Date {
    return new Date(this.props.dataInicio);
  }

  get dataFim(): Date {
    return new Date(this.props.dataFim);
  }

  get ativo(): boolean {
    return this.props.ativo;
  }

  // Métodos de domínio
  calcularDuracaoDias(): number {
    const diffTime = this.props.dataFim.getTime() - this.props.dataInicio.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  contemData(data: Date): boolean {
    const dataComparacao = new Date(data);
    dataComparacao.setHours(0, 0, 0, 0);
    
    const inicio = new Date(this.props.dataInicio);
    inicio.setHours(0, 0, 0, 0);
    
    const fim = new Date(this.props.dataFim);
    fim.setHours(23, 59, 59, 999);

    return dataComparacao >= inicio && dataComparacao <= fim;
  }

  isAtual(): boolean {
    return this.contemData(new Date());
  }

  calcularDiasRestantes(): number {
    const hoje = new Date();
    if (!this.contemData(hoje)) {
      return 0;
    }

    const diffTime = this.props.dataFim.getTime() - hoje.getTime();
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  }

  calcularDiasTranscorridos(): number {
    const hoje = new Date();
    if (!this.contemData(hoje)) {
      return this.calcularDuracaoDias();
    }

    const diffTime = hoje.getTime() - this.props.dataInicio.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  }

  calcularPercentualTranscorrido(): number {
    const diasTranscorridos = this.calcularDiasTranscorridos();
    const duracaoTotal = this.calcularDuracaoDias();
    
    return Math.min(100, (diasTranscorridos / duracaoTotal) * 100);
  }

  // Métodos utilitários estáticos
  static obterCicloAtual(): CicloFuncional {
    return CicloFuncional.createFromDate(new Date());
  }

  static obterProximoCiclo(): CicloFuncional {
    const hoje = new Date();
    const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 10);
    return CicloFuncional.createFromDate(proximoMes);
  }

  static obterCicloAnterior(): CicloFuncional {
    const hoje = new Date();
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 10);
    return CicloFuncional.createFromDate(mesAnterior);
  }

  // Validações específicas do negócio
  podeParticiparEm(dataOperacao: Date): boolean {
    return this.contemData(dataOperacao) && this.ativo;
  }

  equals(other: CicloFuncional): boolean {
    return this.props.dataInicio.getTime() === other.props.dataInicio.getTime() &&
           this.props.dataFim.getTime() === other.props.dataFim.getTime();
  }

  toString(): string {
    const formatarData = (data: Date): string => {
      return data.toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    };

    return `${formatarData(this.props.dataInicio)} → ${formatarData(this.props.dataFim)}`;
  }

  toProps(): CicloFuncionalProps {
    return {
      dataInicio: new Date(this.props.dataInicio),
      dataFim: new Date(this.props.dataFim),
      ativo: this.props.ativo
    };
  }
} 
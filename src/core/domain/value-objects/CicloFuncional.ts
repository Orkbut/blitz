export class CicloFuncional {
  constructor(
    public readonly dataInicio: Date,
    public readonly dataFim: Date
  ) {
    if (dataInicio >= dataFim) {
      throw new Error('Data de início deve ser anterior à data de fim');
    }
  }

  static create(dataInicio: Date, dataFim: Date): CicloFuncional {
    return new CicloFuncional(dataInicio, dataFim);
  }

  contemData(data: Date): boolean {
    return data >= this.dataInicio && data <= this.dataFim;
  }

  diasRestantes(dataAtual: Date = new Date()): number {
    if (dataAtual > this.dataFim) return 0;
    if (dataAtual < this.dataInicio) return this.diasTotais();
    
    const diffTime = this.dataFim.getTime() - dataAtual.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  diasTotais(): number {
    const diffTime = this.dataFim.getTime() - this.dataInicio.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  estaAtivo(dataAtual: Date = new Date()): boolean {
    return this.contemData(dataAtual);
  }

  toString(): string {
    return `${this.dataInicio.toLocaleDateString()} - ${this.dataFim.toLocaleDateString()}`;
  }
} 
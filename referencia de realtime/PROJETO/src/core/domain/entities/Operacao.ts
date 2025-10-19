export interface OperacaoProps {
  id: number;
  dataOperacao: Date;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'DIARIA_COMPLETA' | 'MEIA_DIARIA';
  regionalId: number;
  supervisorId: number;
  limiteDiarias: number;
  limiteMeiasDiarias: number;

  observacoes?: string;
  ativa: boolean;
  criadaEm: Date;
  atualizadaEm: Date;
}

export class Operacao {
  private constructor(private props: OperacaoProps) {}

  static create(props: Omit<OperacaoProps, 'id' | 'criadaEm' | 'atualizadaEm'>): Operacao {
    // Validações de domínio
    if (props.limiteDiarias < 0) {
      throw new Error('Limite de diárias não pode ser negativo');
    }

    if (props.limiteMeiasDiarias < 0) {
      throw new Error('Limite de meias diárias não pode ser negativo');
    }



    if (props.dataOperacao < new Date()) {
      throw new Error('Data da operação não pode ser no passado');
    }

    return new Operacao({
      ...props,
      id: 0, // Será definido pelo banco
      criadaEm: new Date(),
      atualizadaEm: new Date()
    });
  }

  static fromPersistence(props: OperacaoProps): Operacao {
    return new Operacao(props);
  }

  // Getters
  get id(): number {
    return this.props.id;
  }

  get dataOperacao(): Date {
    return this.props.dataOperacao;
  }

  get modalidade(): 'BLITZ' | 'BALANCA' {
    return this.props.modalidade;
  }

  get tipo(): 'DIARIA_COMPLETA' | 'MEIA_DIARIA' {
    return this.props.tipo;
  }

  get regionalId(): number {
    return this.props.regionalId;
  }

  get supervisorId(): number {
    return this.props.supervisorId;
  }

  get limiteDiarias(): number {
    return this.props.limiteDiarias;
  }

  get limiteMeiasDiarias(): number {
    return this.props.limiteMeiasDiarias;
  }



  get observacoes(): string | undefined {
    return this.props.observacoes;
  }

  get ativa(): boolean {
    return this.props.ativa;
  }

  get criadaEm(): Date {
    return this.props.criadaEm;
  }

  get atualizadaEm(): Date {
    return this.props.atualizadaEm;
  }

  // Métodos de domínio
  possuiVagasDisponiveis(participacaoAtual: number): boolean {
    const limiteTotal = this.props.limiteDiarias + this.props.limiteMeiasDiarias;
    return participacaoAtual < limiteTotal;
  }

  podeParticipar(dataAtual: Date): boolean {
    return this.props.ativa && this.props.dataOperacao >= dataAtual;
  }

  atualizar(props: Partial<Pick<OperacaoProps, 'observacoes' | 'limiteDiarias' | 'limiteMeiasDiarias'>>): void {
    if (props.limiteDiarias !== undefined && props.limiteDiarias < 0) {
      throw new Error('Limite de diárias não pode ser negativo');
    }

    if (props.limiteMeiasDiarias !== undefined && props.limiteMeiasDiarias < 0) {
      throw new Error('Limite de meias diárias não pode ser negativo');
    }

    this.props = {
      ...this.props,
      ...props,
      atualizadaEm: new Date()
    };
  }

  cancelar(): void {
    this.props.ativa = false;
    this.props.atualizadaEm = new Date();
  }

  toProps(): OperacaoProps {
    return { ...this.props };
  }
} 
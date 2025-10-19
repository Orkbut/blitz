export interface RegionalProps {
  id: string;
  nome: string;
  sigla: string;
  ativa: boolean;
  criadaEm: Date;
  atualizadaEm: Date;
}

export class Regional {
  private constructor(private props: RegionalProps) {}

  static create(props: Omit<RegionalProps, 'id' | 'criadaEm' | 'atualizadaEm'>): Regional {
    return new Regional({
      ...props,
      id: crypto.randomUUID(),
      criadaEm: new Date(),
      atualizadaEm: new Date()
    });
  }

  static fromPersistence(props: RegionalProps): Regional {
    return new Regional(props);
  }

  get id(): string {
    return this.props.id;
  }

  get nome(): string {
    return this.props.nome;
  }

  get sigla(): string {
    return this.props.sigla;
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

  ativar(): void {
    this.props.ativa = true;
    this.props.atualizadaEm = new Date();
  }

  desativar(): void {
    this.props.ativa = false;
    this.props.atualizadaEm = new Date();
  }

  toJSON(): RegionalProps {
    return { ...this.props };
  }
} 
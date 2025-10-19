import { EstadoVisualType } from '../value-objects/EstadoVisual';

export interface ParticipacaoProps {
  id: number;
  membroId: number;
  operacaoId: number;
  estadoVisual: EstadoVisualType;
  posicaoFila?: number;
  dataParticipacao: Date;
  tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA';
  valorDiaria: number;
  motivoCancelamento?: string;
  ativa: boolean;
  criadaEm: Date;
  atualizadaEm: Date;
}

export class Participacao {
  private constructor(private props: ParticipacaoProps) {}

  static create(props: Omit<ParticipacaoProps, 'id' | 'criadaEm' | 'atualizadaEm'>): Participacao {
    // Validações de domínio
    if (props.valorDiaria <= 0) {
      throw new Error('Valor da diária deve ser maior que zero');
    }

    if (props.posicaoFila !== undefined && props.posicaoFila <= 0) {
      throw new Error('Posição na fila deve ser maior que zero');
    }

    if (props.dataParticipacao < new Date()) {
      throw new Error('Data de participação não pode ser no passado');
    }

    return new Participacao({
      ...props,
      id: 0, // Será definido pelo banco
      criadaEm: new Date(),
      atualizadaEm: new Date()
    });
  }

  static fromPersistence(props: ParticipacaoProps): Participacao {
    return new Participacao(props);
  }

  // Getters
  get id(): number {
    return this.props.id;
  }

  get membroId(): number {
    return this.props.membroId;
  }

  get operacaoId(): number {
    return this.props.operacaoId;
  }

  get estadoVisual(): EstadoVisualType {
    return this.props.estadoVisual;
  }

  get posicaoFila(): number | undefined {
    return this.props.posicaoFila;
  }

  get dataParticipacao(): Date {
    return this.props.dataParticipacao;
  }

  get tipoParticipacao(): 'DIARIA_COMPLETA' | 'MEIA_DIARIA' {
    return this.props.tipoParticipacao;
  }

  get valorDiaria(): number {
    return this.props.valorDiaria;
  }

  get motivoCancelamento(): string | undefined {
    return this.props.motivoCancelamento;
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
  confirmar(): void {
    if (this.props.estadoVisual !== 'DISPONIVEL' && this.props.estadoVisual !== 'NA_FILA') {
      throw new Error('Apenas participações disponíveis ou na fila podem ser confirmadas');
    }

    this.props.estadoVisual = 'CONFIRMADO';
    this.props.posicaoFila = undefined;
    this.props.atualizadaEm = new Date();
  }

  adicionarNaFila(posicao: number): void {
    if (posicao <= 0) {
      throw new Error('Posição na fila deve ser maior que zero');
    }

    this.props.estadoVisual = 'NA_FILA';
    this.props.posicaoFila = posicao;
    this.props.atualizadaEm = new Date();
  }

  cancelar(motivo: string): void {
    if (!motivo || motivo.trim().length === 0) {
      throw new Error('Motivo do cancelamento é obrigatório');
    }

    this.props.estadoVisual = 'CANCELADO';
    this.props.motivoCancelamento = motivo.trim();
    this.props.ativa = false;
    this.props.atualizadaEm = new Date();
  }

  finalizar(): void {
    if (this.props.estadoVisual !== 'CONFIRMADO') {
      throw new Error('Apenas participações confirmadas podem ser finalizadas');
    }

    this.props.estadoVisual = 'FINALIZADO';
    this.props.atualizadaEm = new Date();
  }

  atualizarPosicaoFila(novaPosicao: number): void {
    if (this.props.estadoVisual !== 'NA_FILA') {
      throw new Error('Apenas participações na fila podem ter posição alterada');
    }

    if (novaPosicao <= 0) {
      throw new Error('Posição na fila deve ser maior que zero');
    }

    this.props.posicaoFila = novaPosicao;
    this.props.atualizadaEm = new Date();
  }

  isAtiva(): boolean {
    return this.props.ativa;
  }

  isConfirmada(): boolean {
    return this.props.estadoVisual === 'CONFIRMADO';
  }

  isNaFila(): boolean {
    return this.props.estadoVisual === 'NA_FILA';
  }

  isCancelada(): boolean {
    return this.props.estadoVisual === 'CANCELADO';
  }

  isFinalizada(): boolean {
    return this.props.estadoVisual === 'FINALIZADO';
  }

  toProps(): ParticipacaoProps {
    return { ...this.props };
  }
} 
export type ModalidadeType = 'BLITZ' | 'BALANCA';

export interface ModalidadeConfig {
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  duracaoMinima: number; // em horas
  requereEquipamentos: boolean;
}

export class Modalidade {
  private static readonly CONFIGURACOES: Record<ModalidadeType, ModalidadeConfig> = {
    BLITZ: {
      nome: 'Blitz',
      descricao: 'Operação de fiscalização rápida com abordagem direta',
      icone: 'zap',
      cor: '#dc3545',
      duracaoMinima: 4,
      requereEquipamentos: false
    },
    BALANCA: {
      nome: 'Balança',
      descricao: 'Operação de fiscalização com pesagem de veículos',
      icone: 'scale',
      cor: '#007bff',
      duracaoMinima: 8,
      requereEquipamentos: true
    }
  };

  private constructor(private readonly valor: ModalidadeType) {
    if (!Modalidade.CONFIGURACOES[valor]) {
      throw new Error(`Modalidade inválida: ${valor}`);
    }
  }

  static create(valor: ModalidadeType): Modalidade {
    return new Modalidade(valor);
  }

  static blitz(): Modalidade {
    return new Modalidade('BLITZ');
  }

  static balanca(): Modalidade {
    return new Modalidade('BALANCA');
  }

  static fromString(valor: string): Modalidade {
    const modalidadeUpper = valor.toUpperCase() as ModalidadeType;
    
    if (!Modalidade.CONFIGURACOES[modalidadeUpper]) {
      throw new Error(`Modalidade inválida: ${valor}`);
    }

    return new Modalidade(modalidadeUpper);
  }

  get tipo(): ModalidadeType {
    return this.valor;
  }

  get config(): ModalidadeConfig {
    return Modalidade.CONFIGURACOES[this.valor];
  }

  get nome(): string {
    return this.config.nome;
  }

  get descricao(): string {
    return this.config.descricao;
  }

  get icone(): string {
    return this.config.icone;
  }

  get cor(): string {
    return this.config.cor;
  }

  get duracaoMinima(): number {
    return this.config.duracaoMinima;
  }

  get requereEquipamentos(): boolean {
    return this.config.requereEquipamentos;
  }

  isBlitz(): boolean {
    return this.valor === 'BLITZ';
  }

  isBalanca(): boolean {
    return this.valor === 'BALANCA';
  }

  equals(other: Modalidade): boolean {
    return this.valor === other.valor;
  }

  toString(): string {
    return this.valor;
  }

  // Métodos de validação específicos
  validarDuracao(duracaoHoras: number): boolean {
    return duracaoHoras >= this.duracaoMinima;
  }

  calcularEquipeMinima(efetivo: number): number {
    // Regras específicas por modalidade
    switch (this.valor) {
      case 'BLITZ':
        return Math.max(2, Math.ceil(efetivo * 0.1)); // Mínimo 2, máximo 10% do efetivo
      case 'BALANCA':
        return Math.max(4, Math.ceil(efetivo * 0.15)); // Mínimo 4, máximo 15% do efetivo
      default:
        return 2;
    }
  }

  // Validar compatibilidade com tipo de diária
  isCompativelComTipo(tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA'): boolean {
    if (this.valor === 'BALANCA' && tipoParticipacao === 'MEIA_DIARIA') {
      return false; // Balança sempre requer diária completa
    }
    return true;
  }
} 
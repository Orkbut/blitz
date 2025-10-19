export type EstadoVisualType = 
  | 'DISPONIVEL'
  | 'CONFIRMADO'
  | 'NA_FILA'
  | 'NAO_DISPONIVEL'
  | 'CANCELADO'
  | 'FINALIZADO'
  | 'ADICIONADO_SUP';

export interface EstadoVisualConfig {
  cor: string;
  icone: string;
  descricao: string;
  permiteAcao: boolean;
}

export class EstadoVisual {
  private static readonly CONFIGURACOES: Record<EstadoVisualType, EstadoVisualConfig> = {
    DISPONIVEL: {
      cor: '#007bff',
      icone: 'calendar-plus',
      descricao: 'Operação disponível para participação',
      permiteAcao: true
    },
    CONFIRMADO: {
      cor: '#28a745',
      icone: 'check-circle',
      descricao: 'Participação confirmada',
      permiteAcao: false
    },
    NA_FILA: {
      cor: '#ffc107',
      icone: 'clock',
      descricao: 'Na fila de espera',
      permiteAcao: false
    },
    NAO_DISPONIVEL: {
      cor: '#6c757d',
      icone: 'x-circle',
      descricao: 'Não disponível para participação',
      permiteAcao: false
    },
    CANCELADO: {
      cor: '#dc3545',
      icone: 'x-circle',
      descricao: 'Operação cancelada',
      permiteAcao: false
    },
    FINALIZADO: {
      cor: '#17a2b8',
      icone: 'check-square',
      descricao: 'Operação finalizada',
      permiteAcao: false
    },
    ADICIONADO_SUP: {
      cor: '#28a745',
      icone: 'user-plus',
      descricao: 'Adicionado diretamente pelo supervisor',
      permiteAcao: false
    }
  };

  private constructor(private readonly valor: EstadoVisualType) {}

  static create(valor: EstadoVisualType): EstadoVisual {
    return new EstadoVisual(valor);
  }

  static disponivel(): EstadoVisual {
    return new EstadoVisual('DISPONIVEL');
  }

  static confirmado(): EstadoVisual {
    return new EstadoVisual('CONFIRMADO');
  }

  static naFila(): EstadoVisual {
    return new EstadoVisual('NA_FILA');
  }

  static naoDisponivel(): EstadoVisual {
    return new EstadoVisual('NAO_DISPONIVEL');
  }

  static cancelado(): EstadoVisual {
    return new EstadoVisual('CANCELADO');
  }

  static finalizado(): EstadoVisual {
    return new EstadoVisual('FINALIZADO');
  }

  static adicionadoSupervisor(): EstadoVisual {
    return new EstadoVisual('ADICIONADO_SUP');
  }

  get tipo(): EstadoVisualType {
    return this.valor;
  }

  get configuracao(): EstadoVisualConfig {
    return EstadoVisual.CONFIGURACOES[this.valor];
  }

  get cor(): string {
    return this.configuracao.cor;
  }

  get icone(): string {
    return this.configuracao.icone;
  }

  get descricao(): string {
    return this.configuracao.descricao;
  }

  get permiteAcao(): boolean {
    return this.configuracao.permiteAcao;
  }

  equals(outro: EstadoVisual): boolean {
    return this.valor === outro.valor;
  }

  toString(): string {
    return this.valor;
  }
} 
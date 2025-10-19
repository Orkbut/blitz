import { EstadoVisual, EstadoVisualType } from '../value-objects/EstadoVisual';

export interface ComandoEuVou {
  membroId: number;
  operacaoId: number;
  dataOperacao: Date;
}

export interface ResultadoEuVou {
  sucesso: boolean;
  estadoVisual: EstadoVisualType;
  motivo?: string;
  posicaoFila?: number;
}

export interface ValidadorParticipacao {
  validarCicloFuncional(membroId: number, dataOperacao: Date): Promise<boolean>;
  validarLimiteMensal(membroId: number, mes: number, ano: number): Promise<boolean>;
  validarExclusividadeDiaria(membroId: number, dataOperacao: Date): Promise<boolean>;
  validarVagasDisponiveis(operacaoId: number): Promise<boolean>;
}

export interface RepositorioParticipacao {
  salvarParticipacao(membroId: number, operacaoId: number, estado: EstadoVisualType): Promise<void>;
  adicionarFilaEspera(membroId: number, operacaoId: number): Promise<number>;
}

/**
 * EuVouOrchestrator - Domain Service Central
 * 
 * Responsável por orquestrar todo o fluxo "EU VOU" conforme regras de negócio:
 * 1. Validação de Ciclo Funcional (máx 15 atividades 10→09)
 * 2. Validação de Limite Mensal (máx 15 diárias/mês)
 * 3. Validação de Exclusividade Diária (1 operação/dia)
 * 4. Gestão de Vagas e Fila de Espera
 */
export class EuVouOrchestrator {
  constructor(
    private validador: ValidadorParticipacao,
    private repositorio: RepositorioParticipacao
  ) {}

  async executar(comando: ComandoEuVou): Promise<ResultadoEuVou> {
    return this.executarComandoEuVou(comando);
  }

  async executarComandoEuVou(comando: ComandoEuVou): Promise<ResultadoEuVou> {
    const { membroId, operacaoId, dataOperacao } = comando;

    // 1. Validar Ciclo Funcional (15 atividades máx no período 10→09)
    const cicloValido = await this.validador.validarCicloFuncional(membroId, dataOperacao);
    if (!cicloValido) {
      return {
        sucesso: false,
        estadoVisual: 'NAO_DISPONIVEL',
        motivo: 'Limite de 15 atividades no ciclo funcional (10→09) atingido'
      };
    }

    // 2. Validar Limite Mensal (15 diárias máx por mês calendário)
    const mes = dataOperacao.getMonth() + 1;
    const ano = dataOperacao.getFullYear();
    const limiteValido = await this.validador.validarLimiteMensal(membroId, mes, ano);
    if (!limiteValido) {
      return {
        sucesso: false,
        estadoVisual: 'NAO_DISPONIVEL',
        motivo: 'Limite de 15 diárias mensais atingido'
      };
    }

    // 3. Validar Exclusividade Diária (1 operação por dia)
    const exclusividadeValida = await this.validador.validarExclusividadeDiaria(membroId, dataOperacao);
    if (!exclusividadeValida) {
      return {
        sucesso: false,
        estadoVisual: 'NAO_DISPONIVEL',
        motivo: 'Já possui operação confirmada nesta data'
      };
    }

    // 4. Verificar Vagas Disponíveis
    const vagasDisponiveis = await this.validador.validarVagasDisponiveis(operacaoId);
    
    if (vagasDisponiveis) {
      // CONFIRMADO - Vaga disponível
      await this.repositorio.salvarParticipacao(membroId, operacaoId, 'CONFIRMADO');
      return {
        sucesso: true,
        estadoVisual: 'CONFIRMADO',
        motivo: 'Participação confirmada com sucesso'
      };
    } else {
      // NA_FILA - Sem vagas, adicionar à fila de espera
      const posicaoFila = await this.repositorio.adicionarFilaEspera(membroId, operacaoId);
      return {
        sucesso: true,
        estadoVisual: 'NA_FILA',
        motivo: 'Adicionado à fila de espera',
        posicaoFila
      };
    }
  }

  /**
   * Determina o estado visual para um membro em uma operação
   * Baseado nas validações sem executar o comando
   */
  async determinarEstadoVisual(membroId: number, operacaoId: number, dataOperacao: Date): Promise<EstadoVisualType> {
    // Verificar todas as validações
    const [cicloValido, limiteValido, exclusividadeValida, vagasDisponiveis] = await Promise.all([
      this.validador.validarCicloFuncional(membroId, dataOperacao),
      this.validador.validarLimiteMensal(membroId, dataOperacao.getMonth() + 1, dataOperacao.getFullYear()),
      this.validador.validarExclusividadeDiaria(membroId, dataOperacao),
      this.validador.validarVagasDisponiveis(operacaoId)
    ]);

    // Se alguma validação falhar, não está disponível
    if (!cicloValido || !limiteValido || !exclusividadeValida) {
      return 'NAO_DISPONIVEL';
    }

    // Se passou nas validações, está disponível
    return 'DISPONIVEL';
  }
} 
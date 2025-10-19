import { EuVouOrchestrator, ComandoEuVou, ResultadoEuVou } from '../../../domain/services/EuVouOrchestrator';
import { IParticipacaoRepository } from '../../ports/repositories/IParticipacaoRepository';

export interface EuVouRequest {
  membroId: number;
  operacaoId: number;
  dataOperacao: Date;
}

export interface EuVouResponse {
  sucesso: boolean;
  estadoVisual: 'DISPONIVEL' | 'CONFIRMADO' | 'NA_FILA' | 'NAO_DISPONIVEL' | 'CANCELADO' | 'FINALIZADO';
  mensagem: string;
  posicaoFila?: number;
}

export class EuVouUseCase {
  
  constructor(
    private readonly participacaoRepository: IParticipacaoRepository,
    private readonly euVouOrchestrator: EuVouOrchestrator
  ) {}

  async executar(request: EuVouRequest): Promise<EuVouResponse> {
    try {
      // Validar entrada
      this.validarRequest(request);

      // Criar comando
      const comando: ComandoEuVou = {
        membroId: request.membroId,
        operacaoId: request.operacaoId,
        dataOperacao: request.dataOperacao
      };

      // Executar através do orchestrator
      const resultado = await this.euVouOrchestrator.executar(comando);

      // Mapear resposta
      return {
        sucesso: resultado.sucesso,
        estadoVisual: resultado.estadoVisual as any,
        mensagem: resultado.motivo || 'Operação executada com sucesso',
        posicaoFila: resultado.posicaoFila
      };

    } catch (error) {
      return {
        sucesso: false,
        estadoVisual: 'NAO_DISPONIVEL',
        mensagem: error instanceof Error ? error.message : 'Erro interno do sistema'
      };
    }
  }

  private validarRequest(request: EuVouRequest): void {
    if (!request.membroId || request.membroId <= 0) {
      throw new Error('ID do membro é obrigatório');
    }

    if (!request.operacaoId || request.operacaoId <= 0) {
      throw new Error('ID da operação é obrigatório');
    }

    if (!request.dataOperacao) {
      throw new Error('Data da operação é obrigatória');
    }

    // Validar se data não é no passado
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataOperacao = new Date(request.dataOperacao);
    dataOperacao.setHours(0, 0, 0, 0);

    if (dataOperacao < hoje) {
      throw new Error('Não é possível participar de operações em datas passadas');
    }
  }
} 
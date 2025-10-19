import { ParametrizacaoService } from '../../infrastructure/services/ParametrizacaoService';
import { Modalidade, ModalidadeType } from '../value-objects/Modalidade';

export interface CalculoDiariaRequest {
  modalidade: ModalidadeType;
  tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA';
  horasOperacao: number;
  possuiAdicionalNoturno: boolean;
  possuiAdicionalRisco: boolean;
  dataOperacao: Date;
}

export interface CalculoDiariaResult {
  valorBase: number;
  adicionalNoturno: number;
  adicionalRisco: number;
  valorTotal: number;
  detalhes: {
    modalidade: string;
    tipo: string;
    horasComputadas: number;
    percentualAdicionalNoturno: number;
    percentualAdicionalRisco: number;
  };
}

export class CalculadoraDiaria {
  
  constructor(private parametrizacaoService: ParametrizacaoService) {}

  async calcular(request: CalculoDiariaRequest): Promise<CalculoDiariaResult> {
    // Validar entrada
    this.validarRequest(request);

    // Obter valores base dos parâmetros
    const modalidade = Modalidade.create(request.modalidade);
    const valorBaseCompleta = await this.parametrizacaoService.obterParametro<number>('VALOR_DIARIA_COMPLETA');
    const valorBaseMeia = await this.parametrizacaoService.obterParametro<number>('VALOR_MEIA_DIARIA');

    // Calcular valor base
    const valorBase = this.calcularValorBase(
      request.tipoParticipacao, 
      valorBaseCompleta, 
      valorBaseMeia,
      modalidade
    );

    // Calcular adicionais
    const adicionalNoturno = request.possuiAdicionalNoturno 
      ? await this.calcularAdicionalNoturno(valorBase)
      : 0;

    const adicionalRisco = request.possuiAdicionalRisco 
      ? await this.calcularAdicionalRisco(valorBase, modalidade)
      : 0;

    // Calcular total
    const valorTotal = valorBase + adicionalNoturno + adicionalRisco;

    return {
      valorBase,
      adicionalNoturno,
      adicionalRisco,
      valorTotal,
      detalhes: {
        modalidade: modalidade.nome,
        tipo: request.tipoParticipacao,
        horasComputadas: this.calcularHorasComputadas(request.horasOperacao, modalidade),
        percentualAdicionalNoturno: request.possuiAdicionalNoturno 
          ? await this.parametrizacaoService.obterParametro<number>('PERCENTUAL_ADICIONAL_NOTURNO')
          : 0,
        percentualAdicionalRisco: request.possuiAdicionalRisco 
          ? await this.parametrizacaoService.obterParametro<number>('PERCENTUAL_ADICIONAL_RISCO')
          : 0
      }
    };
  }

  private calcularValorBase(
    tipo: 'DIARIA_COMPLETA' | 'MEIA_DIARIA',
    valorCompleta: number,
    valorMeia: number,
    modalidade: Modalidade
  ): number {
    let valorBase = tipo === 'DIARIA_COMPLETA' ? valorCompleta : valorMeia;

    // Aplicar multiplicador específico da modalidade se configurado
    if (modalidade.isBalanca()) {
      // Balança pode ter valor diferenciado por ser mais complexa
      valorBase *= 1.0; // Por enquanto sem diferenciação, mas estrutura pronta
    }

    return valorBase;
  }

  private async calcularAdicionalNoturno(valorBase: number): Promise<number> {
    const percentual = await this.parametrizacaoService.obterParametro<number>('PERCENTUAL_ADICIONAL_NOTURNO');
    return (valorBase * percentual) / 100;
  }

  private async calcularAdicionalRisco(valorBase: number, modalidade: Modalidade): Promise<number> {
    const percentual = await this.parametrizacaoService.obterParametro<number>('PERCENTUAL_ADICIONAL_RISCO');
    
    // Adicional de risco pode variar por modalidade
    let multiplicadorRisco = 1.0;
    
    if (modalidade.isBalanca()) {
      // Balança pode ter risco diferenciado
      multiplicadorRisco = await this.parametrizacaoService.obterParametro<number>('MULTIPLICADOR_RISCO_BALANCA') || 1.0;
    }

    return (valorBase * percentual * multiplicadorRisco) / 100;
  }

  private calcularHorasComputadas(horasOperacao: number, modalidade: Modalidade): number {
    // Aplicar regras de duração mínima por modalidade
    const duracaoMinima = modalidade.duracaoMinima;
    return Math.max(horasOperacao, duracaoMinima);
  }

  private validarRequest(request: CalculoDiariaRequest): void {
    if (!request.modalidade) {
      throw new Error('Modalidade é obrigatória');
    }

    if (!request.tipoParticipacao) {
      throw new Error('Tipo de participação é obrigatório');
    }

    if (request.horasOperacao <= 0) {
      throw new Error('Horas de operação deve ser maior que zero');
    }

    if (!request.dataOperacao) {
      throw new Error('Data da operação é obrigatória');
    }

    // Validar compatibilidade modalidade x tipo
    const modalidade = Modalidade.create(request.modalidade);
    if (!modalidade.isCompativelComTipo(request.tipoParticipacao)) {
      throw new Error(`Modalidade ${request.modalidade} não é compatível com ${request.tipoParticipacao}`);
    }
  }

  // Métodos utilitários para cálculos específicos
  async calcularTotalMensal(
    membroId: number, 
    mes: number, 
    ano: number
  ): Promise<{
    totalParticipacoes: number;
    valorTotalDiarias: number;
    valorTotalAdicionais: number;
    valorTotalGeral: number;
  }> {
    // TODO: Implementar quando repositories estiverem prontos
    // Buscar todas as participações do membro no mês
    // Calcular total de cada uma
    // Somar todos os valores

    return {
      totalParticipacoes: 0,
      valorTotalDiarias: 0,
      valorTotalAdicionais: 0,
      valorTotalGeral: 0
    };
  }

  async simularCalculoOperacao(
    operacaoId: number,
    tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA'
  ): Promise<CalculoDiariaResult> {
    // TODO: Implementar quando repositories estiverem prontos
    // Buscar dados da operação
    // Simular cálculo baseado nos dados da operação

    // Por enquanto, retorna simulação básica
    return this.calcular({
      modalidade: 'BLITZ',
      tipoParticipacao,
      horasOperacao: 8,
      possuiAdicionalNoturno: false,
      possuiAdicionalRisco: false,
      dataOperacao: new Date()
    });
  }

  // Método para atualização de valores em lote
  async recalcularDiariasOperacao(operacaoId: number): Promise<{
    participacoesAtualizadas: number;
    valorAnterior: number;
    valorNovo: number;
  }> {
    // TODO: Implementar quando repositories estiverem prontos
    // Buscar todas as participações da operação
    // Recalcular valores com parâmetros atuais
    // Atualizar no banco
    // Registrar auditoria

    return {
      participacoesAtualizadas: 0,
      valorAnterior: 0,
      valorNovo: 0
    };
  }

  // Método para validar se operação possui orçamento suficiente
  async validarOrcamento(
    operacaoId: number,
    orcamentoDisponivel: number
  ): Promise<{
    orcamentoSuficiente: boolean;
    valorEstimado: number;
    saldoRestante: number;
  }> {
    // TODO: Implementar quando repositories estiverem prontos
    // Calcular custo total estimado da operação
    // Comparar com orçamento disponível

    return {
      orcamentoSuficiente: true,
      valorEstimado: 0,
      saldoRestante: orcamentoDisponivel
    };
  }
} 
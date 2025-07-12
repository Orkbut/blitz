import { ParametrizacaoService } from '../../infrastructure/services/ParametrizacaoService';

export class CalculadoraDiaria {
  constructor(
    private readonly parametrizacaoService: ParametrizacaoService
  ) {}

  async calcularValorDiaria(
    operacaoId: number,
    tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA'
  ): Promise<number> {
    try {
      if (tipoParticipacao === 'DIARIA_COMPLETA') {
        return await this.parametrizacaoService.obterParametro('VALOR_DIARIA_COMPLETA');
      } else {
        return await this.parametrizacaoService.obterParametro('VALOR_MEIA_DIARIA');
      }
    } catch (error) {
      // Valores padrão caso não consiga buscar do banco
      return tipoParticipacao === 'DIARIA_COMPLETA' ? 150.00 : 75.00;
    }
  }

  async simularCalculoOperacao(
    operacaoId: number,
    tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA'
  ): Promise<{ diaria_completa: number; meia_diaria: number }> {
    try {
      const valorCompleta = await this.parametrizacaoService.obterParametro('VALOR_DIARIA_COMPLETA') as number;
      const valorMeia = await this.parametrizacaoService.obterParametro('VALOR_MEIA_DIARIA') as number;
      
      return {
        diaria_completa: valorCompleta || 150.00,
        meia_diaria: valorMeia || 75.00
      };
    } catch (error) {
      // Valores padrão
      return {
        diaria_completa: 150.00,
        meia_diaria: 75.00
      };
    }
  }
} 
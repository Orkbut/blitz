/**
 * VALIDADOR DE PARTICIPAÇÃO
 * 
 * 🔑 REGRAS FUNDAMENTAIS:
 * - O banco de dados é a fonte absoluta da verdade
 * - Todas as validações devem consultar dados frescos do banco
 * - Não pode haver inconsistências entre validação e dados reais
 * 
 * 📋 REGRAS DE NEGÓCIO:
 * - O supervisor pode exceder o limite de participantes que ele mesmo definiu
 * - Existe exceção no banco de dados que permite ao supervisor adicionar mais participantes
 * - Esta exceção é uma regra de negócio válida e intencional
 * - As validações aqui se aplicam principalmente a participações normais dos membros
 */

import { ParametrizacaoService } from '../../infrastructure/services/ParametrizacaoService';
import { SupabaseOperacaoRepository } from '../../infrastructure/repositories/SupabaseOperacaoRepository';
import { SupabaseServidorRepository } from '../../infrastructure/repositories/SupabaseServidorRepository';
import { supabase } from '@/lib/supabase';

// 🎯 ENUM: Contexto de validação
export enum ContextoValidacao {
  SOLICITACAO = 'SOLICITACAO',
  CONFIRMACAO = 'CONFIRMACAO'
}

export interface ResultadoValidacao {
  podeParticipar: boolean;
  motivos: string[];
}

export class ValidadorParticipacao {
  private parametrizacaoService: ParametrizacaoService;
  private operacaoRepository: SupabaseOperacaoRepository;
  private servidorRepository: SupabaseServidorRepository;

  constructor() {
    this.parametrizacaoService = ParametrizacaoService.getInstance();
    this.operacaoRepository = new SupabaseOperacaoRepository();
    this.servidorRepository = new SupabaseServidorRepository();
  }

  // 🎯 MÉTODO PRINCIPAL: Rotear validação baseada no contexto
  async validar(
    servidorId: number, 
    operacaoId: number,
    contexto: ContextoValidacao = ContextoValidacao.SOLICITACAO
  ): Promise<ResultadoValidacao> {
    if (contexto === ContextoValidacao.SOLICITACAO) {
      return this.validarParaSolicitacao(servidorId, operacaoId);
    } else {
      return this.validarParaConfirmacao(servidorId, operacaoId);
    }
  }

  // 🎯 VALIDAÇÃO PARA SOLICITAÇÃO: Apenas verificações básicas
  async validarParaSolicitacao(servidorId: number, operacaoId: number): Promise<ResultadoValidacao> {
    const motivos: string[] = [];

    try {
      // 1. ✅ CARREGAR DADOS BÁSICOS
      const [operacao, servidor] = await Promise.all([
        this.carregarOperacao(operacaoId),
        this.carregarServidor(servidorId)
      ]);

      if (!operacao || !servidor) {
        motivos.push('Operação ou servidor não encontrado');
        return { podeParticipar: false, motivos };
      }

      // 2. ✅ VALIDAR APENAS: Estado da operação (aceitar AGUARDANDO_SOLICITACOES para solicitação)
      const statusValidos = ['ATIVA', 'AGUARDANDO_SOLICITACOES'];
      if (!statusValidos.includes(operacao.status)) {
        motivos.push(`Operação não está disponível para solicitações (status: ${operacao.status})`);
      }

      // 3. ✅ VALIDAR APENAS: Limite básico de participantes na operação
      const participacoesAtivas = await this.contarParticipacoes(operacaoId);

      // ✅ PARA SOLICITAÇÃO: Aceitar mesmo se estiver no limite (fila de espera)
      // Só bloquear se estiver muito acima do limite (segurança)
      const limiteSeguranca = (operacao.limite_participantes || 0) * 3; // 3x mais que o limite
      if (participacoesAtivas >= limiteSeguranca) {
        motivos.push(`Operação com muitas solicitações (${participacoesAtivas})`);
      }

      // 4. ❌ NÃO VALIDAR: Limites de ciclo funcional
      
      // 5. ❌ NÃO VALIDAR: Limites de diárias mensais

      // 6. ✅ VALIDAR APENAS: Conflito de data (mesmo servidor, mesma data)
      if (await this.temConflitoPorData(servidorId, operacao.data_operacao)) {
        motivos.push('Servidor já possui participação ativa na mesma data');
      }

      const podeParticipar = motivos.length === 0;

      return { podeParticipar, motivos };

    } catch (error) {
      return { 
        podeParticipar: false, 
        motivos: ['Erro interno na validação'] 
      };
    }
  }

  // 🎯 VALIDAÇÃO PARA CONFIRMAÇÃO: Todas as regras de negócio
  async validarParaConfirmacao(servidorId: number, operacaoId: number): Promise<ResultadoValidacao> {
    const motivos: string[] = [];

    try {
      // 1. ✅ CARREGAR DADOS COMPLETOS
      const [operacao, servidor] = await Promise.all([
        this.carregarOperacao(operacaoId),
        this.carregarServidor(servidorId)
      ]);

      if (!operacao || !servidor) {
        motivos.push('Operação ou servidor não encontrado');
        return { podeParticipar: false, motivos };
      }

      // Dados carregados

      // 2. ✅ VALIDAR: Estado da operação (confirmação aceita apenas ATIVA)
      if (operacao.status !== 'ATIVA') {
        motivos.push(`Operação não está ativa para confirmação (status: ${operacao.status})`);
      }

      // 3. ✅ VALIDAR: Limite de participantes na operação
      const participacoesAtivas = await this.contarParticipacoes(operacaoId);

      if (participacoesAtivas >= (operacao.limite_participantes || 0)) {
        motivos.push('Operação já atingiu o limite de participantes');
      }

      // 4. ✅ VALIDAR: Limites de ciclo funcional
      const limiteCicloResult = await this.validarLimiteCicloFuncional(servidorId, operacao.data_operacao);
      if (!limiteCicloResult.podeParticipar) {
        motivos.push(...limiteCicloResult.motivos);
      }

      // 5. ✅ VALIDAR: Limites de diárias mensais (apenas para PLANEJADA)
      if (operacao.tipo === 'PLANEJADA') {
        const limiteDiariasResult = await this.validarLimiteMensalDiarias(servidorId, operacao.data_operacao);
        if (!limiteDiariasResult.podeParticipar) {
          motivos.push(...limiteDiariasResult.motivos);
        }
      }

      // 6. ✅ VALIDAR: Conflito de data
      if (await this.temConflitoPorData(servidorId, operacao.data_operacao)) {
        motivos.push('Servidor já possui participação ativa na mesma data');
      }

      const podeParticipar = motivos.length === 0;

      return { podeParticipar, motivos };

    } catch (error) {
      return { 
        podeParticipar: false, 
        motivos: ['Erro interno na validação'] 
      };
    }
  }

  // Método específico para validação rápida (sem todas as verificações)
  async validacaoRapida(membroId: number, operacaoId: number): Promise<boolean> {
    try {
      const operacao = await this.operacaoRepository.buscarPorId(operacaoId);
      if (!operacao || !operacao.ativa) {
        return false;
      }

      const jaParticipa = await this.operacaoRepository.verificarParticipacaoExistente(membroId, operacaoId);
      if (jaParticipa) {
        return false;
      }

      const participantesConfirmados = await this.operacaoRepository.contarParticipantesConfirmados(operacaoId);
      const podeParticipar = participantesConfirmados < operacao.limite_participantes;
      
      return podeParticipar;
    } catch (error) {
      return false;
    }
  }

  // Helper para carregar operação
  private async carregarOperacao(operacaoId: number) {
    const operacao = await this.operacaoRepository.buscarPorId(operacaoId);
    return operacao;
  }

  // Helper para carregar servidor
  private async carregarServidor(servidorId: number) {
    const servidor = await this.servidorRepository.buscarPorId(servidorId);
    return servidor;
  }

  // Helper para contar participantes ativos
  private async contarParticipacoes(operacaoId: number) {
    const count = await this.operacaoRepository.contarParticipantesConfirmados(operacaoId);
    return count;
  }

  // Helper para verificar conflito por data
  private async temConflitoPorData(servidorId: number, dataOperacao: string) {
    return this.servidorRepository.verificarRestricaoTemporal(servidorId, dataOperacao);
  }

  // Helper para validar limite de ciclo funcional
  private async validarLimiteCicloFuncional(servidorId: number, dataOperacao: string) {
    const hoje = new Date();
    const dataOperacaoDate = new Date(dataOperacao);
    const diasDiferenca = Math.ceil((dataOperacaoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    
    const prazoMinimo = 1; // Valor fixo: mínimo 1 dia de antecedência
    if (diasDiferenca < prazoMinimo) {
      return { podeParticipar: false, motivos: [`Operação deve ser agendada com pelo menos ${prazoMinimo} dia(s) de antecedência`] };
    }
    return { podeParticipar: true, motivos: [] };
  }

  // Helper para validar limite mensal de diárias
  private async validarLimiteMensalDiarias(servidorId: number, dataOperacao: string) {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    
    const diariasNoMes = await this.servidorRepository.contarDiariasNoMes(servidorId, ano, mes);
    const limiteMensal = await this.parametrizacaoService.limiteMensalDiarias();
    
    if (diariasNoMes >= limiteMensal) {
      return { podeParticipar: false, motivos: [`Servidor já atingiu limite mensal de ${limiteMensal} diárias`] };
    }
    return { podeParticipar: true, motivos: [] };
  }
} 
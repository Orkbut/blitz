/**
 * 🎭 EU VOU ORCHESTRATOR SIMPLIFICADO
 * 
 * NOVA VERSÃO QUE:
 * - USA ValidadorUnico (remove lógica duplicada)
 * - Age apenas como COORDENADOR
 * - Delega validações para ValidadorUnico
 * - Executa apenas a persistência final
 * 
 * SUBSTITUI:
 * - EuVouOrchestrator.ts (versão complexa com lógica duplicada)
 * 
 * RESPONSABILIDADES REDUZIDAS:
 * - Coordenar o fluxo (ValidadorUnico → Persistência → Resposta)
 * - Executar ações de persistência
 * - Disparar eventos/notificações
 * - Retornar resultado formatado
 */

import { supabase } from '@/lib/supabase';
import { ValidadorUnico } from './ValidadorUnico';

// 📋 TIPOS E INTERFACES
interface ResultadoExecucao {
  sucesso: boolean;
  mensagem: string;
  tipoAcao: 'CONFIRMACAO' | 'SOLICITACAO';
  codigoErro?: string;
  detalhes?: any;
  dadosParticipacao?: {
    id: number;
    estado_visual: string;
    posicao_fila?: number;
    data_participacao: string;
  };
}

export class EuVouOrchestratorSimplificado {
  
  private validadorUnico: ValidadorUnico;

  constructor() {
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 🚨 ======= ORCHESTRATOR SIMPLIFICADO INICIALIZADO =======`);
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] ⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 🔄 Usa ValidadorUnico (remove lógica duplicada)`);
    
    this.validadorUnico = new ValidadorUnico();
  }

  /**
   * 🎯 MÉTODO PRINCIPAL SIMPLIFICADO
   * 
   * ANTES: 200+ linhas com validações duplicadas
   * AGORA: ~50 linhas focadas em coordenação
   */
  async executar(operacaoId: number, membroId: number): Promise<ResultadoExecucao> {
    
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 🚨 ======= EXECUÇÃO INICIADA =======`);
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 🎯 Operação: ${operacaoId}, Membro: ${membroId}`);
    console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] ⏰ Timestamp: ${new Date().toISOString()}`);

    try {
      // 1️⃣ DELEGAÇÃO PARA VALIDADOR ÚNICO
      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 📡 Delegando validação para ValidadorUnico...`);
      
      const resultadoValidacao = await this.validadorUnico.validarParticipacao(
        operacaoId, 
        membroId, 
        'SOLICITACAO'
      );

      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 📊 Resultado validação:`, {
        valido: resultadoValidacao.valido,
        estrategia: resultadoValidacao.estrategia,
        mensagem: resultadoValidacao.mensagem
      });

      // 2️⃣ VERIFICAÇÃO DE RESULTADO
      if (!resultadoValidacao.valido) {
        console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] ❌ Validação rejeitada: ${resultadoValidacao.mensagem}`);
        
        return {
          sucesso: false,
          mensagem: resultadoValidacao.mensagem,
          tipoAcao: 'SOLICITACAO',
          codigoErro: resultadoValidacao.codigoErro,
          detalhes: resultadoValidacao.detalhes
        };
      }

      // 3️⃣ EXECUÇÃO DA ESTRATÉGIA DETERMINADA
      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] ⚡ Executando estratégia: ${resultadoValidacao.estrategia}`);
      
      let resultadoExecucao: ResultadoExecucao;

      switch (resultadoValidacao.estrategia) {
        case 'CONFIRMACAO_DIRETA':
          resultadoExecucao = await this.executarConfirmacaoDireta(operacaoId, membroId, resultadoValidacao);
          break;
        
        case 'ADICIONAR_FILA':
          resultadoExecucao = await this.executarAdicaoFila(operacaoId, membroId, resultadoValidacao);
          break;
        
        default:
          throw new Error(`Estratégia desconhecida: ${resultadoValidacao.estrategia}`);
      }

      // 4️⃣ EVENTOS E NOTIFICAÇÕES
      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 📢 Disparando eventos...`);
      
      await this.dispararEventos(operacaoId, membroId, resultadoExecucao);

      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] ✅ Execução concluída com sucesso!`);
      console.log(`🎭 [ORCHESTRATOR-SIMPLIFICADO] 🏁 Resultado:`, resultadoExecucao);

      return resultadoExecucao;

    } catch (error) {
      console.error('🚨 [ORCHESTRATOR-SIMPLIFICADO] Erro interno:', error);
      
      return {
        sucesso: false,
        mensagem: 'Erro interno no processamento',
        tipoAcao: 'SOLICITACAO',
        codigoErro: 'ERRO_ORCHESTRATOR_INTERNO',
        detalhes: { error: error.message }
      };
    }
  }

  /**
   * ✅ EXECUÇÃO DE CONFIRMAÇÃO DIRETA
   * 
   * Apenas persiste - validação já foi feita pelo ValidadorUnico
   */
  private async executarConfirmacaoDireta(
    operacaoId: number, 
    membroId: number, 
    resultadoValidacao: any
  ): Promise<ResultadoExecucao> {
    
    console.log(`✅ [CONFIRMACAO-DIRETA] Criando participação confirmada...`);

    const { data: participacao, error } = await supabase
      .from('participacao')
      .insert({
        operacao_id: operacaoId,
        membro_id: membroId,
        estado_visual: 'CONFIRMADO',
        status_interno: 'CONFIRMADO',
        data_participacao: new Date().toISOString(),
        ativa: true,
        confirmado_automaticamente: true
      })
      .select()
      .single();

    if (error) {
      console.error('🚨 [CONFIRMACAO-DIRETA] Erro database:', error);
      throw new Error('Erro ao confirmar participação');
    }

    console.log(`✅ [CONFIRMACAO-DIRETA] Participação criada:`, participacao);

    return {
      sucesso: true,
      mensagem: resultadoValidacao.mensagem || 'Participação confirmada automaticamente!',
      tipoAcao: 'CONFIRMACAO',
      dadosParticipacao: {
        id: participacao.id,
        estado_visual: participacao.estado_visual,
        data_participacao: participacao.data_participacao
      }
    };
  }

  /**
   * 📋 EXECUÇÃO DE ADIÇÃO À FILA
   * 
   * Apenas persiste - validação já foi feita pelo ValidadorUnico
   */
  private async executarAdicaoFila(
    operacaoId: number, 
    membroId: number, 
    resultadoValidacao: any
  ): Promise<ResultadoExecucao> {
    
    console.log(`📋 [ADICAO-FILA] Criando participação pendente...`);

    const { data: participacao, error } = await supabase
      .from('participacao')
      .insert({
        operacao_id: operacaoId,
        membro_id: membroId,
        estado_visual: 'PENDENTE',
        status_interno: 'AGUARDANDO_SUPERVISOR',
        data_participacao: new Date().toISOString(),
        ativa: true
      })
      .select()
      .single();

    if (error) {
      console.error('🚨 [ADICAO-FILA] Erro database:', error);
      throw new Error('Erro ao adicionar à fila');
    }

    console.log(`📋 [ADICAO-FILA] Participação criada:`, participacao);

    return {
      sucesso: true,
      mensagem: resultadoValidacao.mensagem || 'Adicionado à fila de espera!',
      tipoAcao: 'SOLICITACAO',
      dadosParticipacao: {
        id: participacao.id,
        estado_visual: participacao.estado_visual,
        posicao_fila: resultadoValidacao.dadosCalculados?.posicao_fila_estimada,
        data_participacao: participacao.data_participacao
      }
    };
  }

  /**
   * 📢 DISPARO DE EVENTOS E NOTIFICAÇÕES
   * 
   * Responsável por notificar outros componentes sobre a mudança
   */
  private async dispararEventos(
    operacaoId: number, 
    membroId: number, 
    resultado: ResultadoExecucao
  ): Promise<void> {
    
    console.log(`📢 [DISPARAR-EVENTOS] Tipo: ${resultado.tipoAcao}`);

    try {
      // Registrar evento no histórico
      await supabase
        .from('evento_operacao')
        .insert({
          operacao_id: operacaoId,
          membro_id: membroId,
          tipo_evento: resultado.tipoAcao === 'CONFIRMACAO' ? 'PARTICIPACAO_CONFIRMADA' : 'PARTICIPACAO_CRIADA',
          data_evento: new Date().toISOString(),
          detalhes: {
            orchestrator: 'simplificado',
            resultado: resultado.tipoAcao,
            participacao_id: resultado.dadosParticipacao?.id
          }
        });

      // Em um sistema real, aqui seria disparado:
      // - Notificação real-time via Supabase
      // - Email/SMS se configurado
      // - Webhook para integrações
      
      console.log(`📢 [DISPARAR-EVENTOS] ✅ Eventos disparados com sucesso`);

    } catch (error) {
      console.error('🚨 [DISPARAR-EVENTOS] Erro ao disparar eventos:', error);
      // Não propaga o erro pois a operação principal já foi realizada
    }
  }

  /**
   * 📊 MÉTODO UTILITÁRIO - STATUS DA EXECUÇÃO
   * 
   * Útil para debugging e monitoramento
   */
  async obterStatusExecucao(operacaoId: number): Promise<any> {
    console.log(`📊 [STATUS-EXECUCAO] Operação: ${operacaoId}`);

    const estatisticas = await this.validadorUnico.obterEstatisticasOperacao(operacaoId);

    return {
      operacao_id: operacaoId,
      timestamp: new Date().toISOString(),
      orchestrator: 'simplificado',
      validador: 'unico',
      estatisticas,
      estrategias_disponíveis: ['CONFIRMACAO_DIRETA', 'ADICIONAR_FILA', 'REJEITADO']
    };
  }

  /**
   * 🔄 MÉTODO DE MIGRAÇÃO
   * 
   * Para facilitar a transição do EuVouOrchestrator original
   */
  static async migrarDo_EuVouOrchestrator_Original(): Promise<void> {
    console.log(`🔄 [MIGRACAO] Iniciando migração para orchestrator simplificado...`);
    
    // Em um sistema real, este método:
    // 1. Verificaria dados inconsistentes
    // 2. Reprocessaria participações pendentes
    // 3. Validaria integridade dos dados
    // 4. Geraria relatório de migração
    
    console.log(`🔄 [MIGRACAO] ✅ Migração simulada concluída`);
  }
} 
/**
 * EU VOU ORCHESTRATOR - SERVIÇO DE DOMÍNIO
 * 
 * 🔑 REGRAS FUNDAMENTAIS:
 * - O banco de dados é a fonte absoluta da verdade
 * - Todas as operações devem consultar dados frescos do banco
 * - Não pode haver inconsistências entre validações e dados reais
 * 
 * 📋 REGRAS DE NEGÓCIO:
 * - O supervisor pode exceder o limite de participantes que ele mesmo definiu
 * - Existe exceção no banco de dados que permite ao supervisor adicionar mais participantes
 * - Esta exceção é uma regra de negócio válida e intencional
 * - As validações de limite se aplicam principalmente a participações normais dos membros
 */

import { ValidadorParticipacao, ContextoValidacao, ResultadoValidacao } from './ValidadorParticipacao';
import { CalculadoraDiaria } from './CalculadoraDiaria';
import { ParametrizacaoService } from '../../infrastructure/services/ParametrizacaoService';
import { SupabaseOperacaoRepository } from '../../infrastructure/repositories/SupabaseOperacaoRepository';
import { SupabaseServidorRepository } from '../../infrastructure/repositories/SupabaseServidorRepository';
import { supabase } from '@/lib/supabase';
import { clickInspector } from '@/lib/logger';

export enum StatusParticipacao {
  CONFIRMADO = 'CONFIRMADO',
  NA_FILA = 'NA_FILA', 
  NAO_DISPONIVEL = 'NAO_DISPONIVEL'
}

export interface ComandoEuVou {
  membroId: number;
  operacaoId: number;
  tipoParticipacao: 'DIARIA_COMPLETA' | 'MEIA_DIARIA';
}

export interface ResultadoEuVou {
  status: StatusParticipacao;
  mensagem: string;
  detalhes?: string[];
  previewDiaria?: {
    diaria_completa: number;
    meia_diaria: number;
  };
  posicaoFila?: number;
}

export class EuVouOrchestrator {
  private validador: ValidadorParticipacao;
  private calculadora: CalculadoraDiaria;
  private operacaoRepository: SupabaseOperacaoRepository;
  private servidorRepository: SupabaseServidorRepository;

  constructor() {
    this.validador = new ValidadorParticipacao();
    this.calculadora = new CalculadoraDiaria(ParametrizacaoService.getInstance());
    this.operacaoRepository = new SupabaseOperacaoRepository();
    this.servidorRepository = new SupabaseServidorRepository();
  }

  // 🎯 MÉTODO PRINCIPAL: Executar solicitação (usar validação básica)
  async executar(membroId: number, operacaoId: number): Promise<any> {
    console.log(`[TEMP-LOG-ORCHESTRATOR] 🚀 INÍCIO EXECUÇÃO SOLICITAÇÃO - Membro ${membroId} → Op ${operacaoId}`);
    
    try {
      // 1. ✅ VALIDAÇÃO PARA SOLICITAÇÃO (apenas básica)
      console.log(`[TEMP-LOG-ORCHESTRATOR] 🔍 CHAMANDO VALIDADOR PARA SOLICITAÇÃO...`);
      const resultadoValidacao = await this.validador.validar(
        membroId, 
        operacaoId,
        ContextoValidacao.SOLICITACAO  // ✅ CORREÇÃO: Contexto correto
      );
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] 📊 RESULTADO VALIDAÇÃO SOLICITAÇÃO: ${resultadoValidacao.podeParticipar} | Motivos: ${resultadoValidacao.motivos.join(', ') || 'Nenhum'}`);
      
      if (!resultadoValidacao.podeParticipar) {
        console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ VALIDAÇÃO SOLICITAÇÃO FALHOU - Rejeitando`);
        return {
          sucesso: false,
          mensagem: resultadoValidacao.motivos.join(', ')
        };
      }
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ VALIDAÇÃO SOLICITAÇÃO PASSOU - Prosseguindo com operação`);

      // 🎯 CORREÇÃO ESTRUTURAL: ValidadorParticipacao é autoridade única para validações
      console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ CORREÇÃO ESTRUTURAL APLICADA!`);
      console.log(`[TEMP-LOG-ORCHESTRATOR] 🎯 ValidadorParticipacao É A AUTORIDADE ÚNICA - removida validação redundante`);
      console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ Ana Santos e TODOS os usuários podem usar AGUARDANDO_SOLICITACOES agora!`);
      
      // ✅ BUSCAR OPERAÇÃO: Apenas para dados necessários (limite, diárias, etc.)
      const operacao = await this.operacaoRepository.buscarPorId(operacaoId);
      if (!operacao) {
        console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ Operação não encontrada`);
        return {
          sucesso: false,
          mensagem: 'Operação não encontrada'
        };
      }
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] 📋 Operação encontrada: ${operacao.tipo} | Status: ${operacao.status}`);

      // 3. ✅ CALCULAR DIÁRIAS
      console.log(`[TEMP-LOG-ORCHESTRATOR] 💰 Calculando diárias...`);
      const diarias = await this.calculadora.simularCalculoOperacao(operacaoId, 'DIARIA_COMPLETA');

      // 4. ✅ VERIFICAR DISPONIBILIDADE DE VAGAS
      console.log(`[TEMP-LOG-ORCHESTRATOR] 🎯 Verificando disponibilidade de vagas...`);
      const participacoesAtivas = await this.operacaoRepository.contarParticipantesConfirmados(operacaoId);
      const temVagas = participacoesAtivas < operacao.limite_participantes;
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] 📊 Vagas: ${participacoesAtivas}/${operacao.limite_participantes} - Tem vagas: ${temVagas}`);

      if (temVagas) {
        // ✅ TEM VAGAS: Confirmar participação diretamente
        console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ VAGA DISPONÍVEL - Confirmando participação diretamente`);
        const resultadoConfirmacao = await this.confirmarParticipacao(membroId, operacaoId, diarias);
        
        if (resultadoConfirmacao.sucesso) {
          console.log(`[TEMP-LOG-ORCHESTRATOR] 🎉 PARTICIPAÇÃO CONFIRMADA COM SUCESSO`);
          return {
            sucesso: true,
            mensagem: 'Participação confirmada!',
            dados: resultadoConfirmacao.dados
          };
        } else {
          console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ FALHA NA CONFIRMAÇÃO: ${resultadoConfirmacao.mensagem}`);
          return resultadoConfirmacao;
        }
      } else {
        // ✅ SEM VAGAS: Adicionar à fila de espera
        console.log(`[TEMP-LOG-ORCHESTRATOR] 📋 SEM VAGAS - Adicionando à fila de espera`);
        const resultadoFila = await this.adicionarNaFila(membroId, operacaoId, diarias);
        
        if (resultadoFila.sucesso) {
          console.log(`[TEMP-LOG-ORCHESTRATOR] 🎉 ADICIONADO À FILA COM SUCESSO`);
          return {
            sucesso: true,
            mensagem: 'Adicionado à fila de espera!',
            dados: resultadoFila.dados
          };
        } else {
          console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ FALHA AO ADICIONAR À FILA: ${resultadoFila.mensagem}`);
          return resultadoFila;
        }
      }

    } catch (error) {
      console.error(`[TEMP-LOG-ORCHESTRATOR] 💥 ERRO GERAL no Orchestrator:`, error);
      return {
        sucesso: false,
        mensagem: 'Erro interno ao processar solicitação'
      };
    }
  }

  // 🎯 CONFIRMAR PARTICIPAÇÃO: Usar validação completa
  async confirmarParticipacao(membroId: number, operacaoId: number, diarias?: any): Promise<any> {
    console.log(`[TEMP-LOG-ORCHESTRATOR] 🚀 INÍCIO CONFIRMAÇÃO - Membro ${membroId} → Op ${operacaoId}`);
    
    try {
      // 1. ✅ VALIDAÇÃO PARA CONFIRMAÇÃO (completa)
      console.log(`[TEMP-LOG-ORCHESTRATOR] 🔍 CHAMANDO VALIDADOR PARA CONFIRMAÇÃO...`);
      const resultadoValidacao = await this.validador.validar(
        membroId, 
        operacaoId,
        ContextoValidacao.CONFIRMACAO  // ✅ CORREÇÃO: Contexto correto para confirmação
      );
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] 📊 RESULTADO VALIDAÇÃO CONFIRMAÇÃO: ${resultadoValidacao.podeParticipar} | Motivos: ${resultadoValidacao.motivos.join(', ') || 'Nenhum'}`);
      
      if (!resultadoValidacao.podeParticipar) {
        console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ VALIDAÇÃO CONFIRMAÇÃO FALHOU - Rejeitando`);
        return {
          sucesso: false,
          mensagem: resultadoValidacao.motivos.join(', ')
        };
      }
      
      console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ VALIDAÇÃO CONFIRMAÇÃO PASSOU - Prosseguindo com confirmação`);

      // 2. ✅ CALCULAR DIÁRIAS SE NÃO FORNECIDAS
      if (!diarias) {
        console.log(`[TEMP-LOG-ORCHESTRATOR] 💰 Calculando diárias para confirmação...`);
        diarias = await this.calculadora.simularCalculoOperacao(operacaoId, 'DIARIA_COMPLETA');
      }

      // 3. ✅ EXECUTAR CONFIRMAÇÃO NO BANCO (usar Supabase direto)
      console.log(`[TEMP-LOG-ORCHESTRATOR] 💾 Executando confirmação no banco...`);
      const { data: resultado, error } = await supabase
        .from('participacao')
        .insert({
          membro_id: membroId,
          operacao_id: operacaoId,
          status_interno: 'CONFIRMADO',
          estado_visual: 'CONFIRMADO',
          diarias: diarias.diaria_completa,
          ativa: true
        })
        .select()
        .single();

      if (resultado && resultado.id) {
        console.log(`[TEMP-LOG-ORCHESTRATOR] ✅ CONFIRMAÇÃO EXECUTADA COM SUCESSO - ID: ${resultado.id}`);
        return {
          sucesso: true,
          mensagem: 'Participação confirmada com sucesso!',
          dados: {
            participacaoId: resultado.id,
            diarias: diarias.valor,
            status: 'CONFIRMADO'
          }
        };
      } else {
        console.log(`[TEMP-LOG-ORCHESTRATOR] ❌ FALHA NA EXECUÇÃO DA CONFIRMAÇÃO`);
        throw new Error('Falha ao confirmar participação');
      }

    } catch (error) {
      console.error(`[TEMP-LOG-ORCHESTRATOR] 💥 ERRO ao confirmar:`, error);
      return {
        sucesso: false,
        mensagem: 'Erro ao confirmar participação'
      };
    }
  }

  // 🚨 MÉTODO CRÍTICO: Verificar se operação permite participação
  private async verificarStatusOperacao(operacaoId: number): Promise<{bloqueado: boolean, motivos: string[]}> {
    try {
      const { data: operacao, error } = await supabase
        .from('operacao')
        .select(`
          id,
          status,
          encaminhado_diretoria_em,
          retorno_diretoria_em,
          decisao_diretoria,
          ativa,
          excluida_temporariamente,
          data_exclusao,
          motivo_exclusao,
          participacao(
            id,
            bloqueado_diretoria,
            ativa
          )
        `)
        .eq('id', operacaoId)
        .single();

      if (error || !operacao) {
        return {
          bloqueado: true,
          motivos: ['Operação não encontrada']
        };
      }

      const motivos: string[] = [];

      // ❌ BLOQUEAR: Operação excluída temporariamente
      if (operacao.excluida_temporariamente) {
        motivos.push('Operação foi excluída temporariamente pelo supervisor');
        if (operacao.motivo_exclusao) {
          motivos.push(`Motivo: ${operacao.motivo_exclusao}`);
        }
      }

      // ❌ BLOQUEAR: Operação inativa
      if (!operacao.ativa) {
        motivos.push('Operação foi cancelada ou desativada');
      }

      // ❌ BLOQUEAR: Status críticos da diretoria
      if (operacao.status === 'AGUARDANDO_DIRETORIA') {
        motivos.push('Operação está em análise pela diretoria');
      }

      if (operacao.encaminhado_diretoria_em && !operacao.retorno_diretoria_em) {
        motivos.push('Operação aguardando aprovação da diretoria');
      }

      if (operacao.decisao_diretoria === 'REJEITADA') {
        motivos.push('Operação foi rejeitada pela diretoria');
      }

      // ❌ BLOQUEAR: Membros com bloqueio da diretoria
      const participacoesBloqueadas = operacao.participacao?.filter(
        (p: any) => p.ativa && p.bloqueado_diretoria
      ) || [];

      if (participacoesBloqueadas.length > 0) {
        motivos.push('Operação possui restrições da diretoria');
      }

      return {
        bloqueado: motivos.length > 0,
        motivos
      };

    } catch (error) {
      console.error('Erro ao verificar status da operação:', error);
      return {
        bloqueado: true,
        motivos: ['Erro interno ao verificar operação']
      };
    }
  }

  // 🔄 MÉTODO PARA RECALCULAR VALIDAÇÕES APÓS EXCLUSÃO/REATIVAÇÃO
  async recalcularValidacoesServidor(servidorId: number): Promise<{
    podeParticiparMais: boolean;
    limitesAtuais: {
      diariasNoMes: number;
      limiteMensal: number;
      operacoesNoPeriodo: number;
      limitePeriodo: number;
    };
    proximasOportunidades: string[];
  }> {
    try {
      // Usar função do banco para recálculo preciso
      const { data: resultado, error } = await supabase
        .rpc('recalcular_validacoes_servidor', {
          p_servidor_id: servidorId
        });

      if (error) {
        console.error('Erro ao recalcular validações:', error);
        throw error;
      }

      const proximasOportunidades: string[] = [];

      // Analisar oportunidades baseado nos limites
      if (resultado.pode_mais_diarias) {
        const diariasRestantes = resultado.limite_mensal - resultado.diarias_mes;
        proximasOportunidades.push(`Pode receber mais ${diariasRestantes} diárias este mês`);
      } else {
        proximasOportunidades.push('Limite mensal de diárias atingido (15)');
      }

      if (resultado.pode_mais_operacoes) {
        const operacoesRestantes = resultado.limite_periodo - resultado.operacoes_periodo;
        proximasOportunidades.push(`Pode participar de mais ${operacoesRestantes} operações no período`);
      } else {
        proximasOportunidades.push('Limite de operações no período atingido');
      }

      return {
        podeParticiparMais: resultado.pode_mais_diarias && resultado.pode_mais_operacoes,
        limitesAtuais: {
          diariasNoMes: resultado.diarias_mes,
          limiteMensal: resultado.limite_mensal,
          operacoesNoPeriodo: resultado.operacoes_periodo,
          limitePeriodo: resultado.limite_periodo
        },
        proximasOportunidades
      };

    } catch (error) {
      console.error('Erro no recálculo de validações:', error);
      return {
        podeParticiparMais: false,
        limitesAtuais: {
          diariasNoMes: 0,
          limiteMensal: 15,
          operacoesNoPeriodo: 0,
          limitePeriodo: 15
        },
        proximasOportunidades: ['Erro ao calcular limites - consulte o supervisor']
      };
    }
  }

  private async calcularPosicaoFila(operacaoId: number): Promise<number> {
    try {
      // ✅ CORREÇÃO: Usar apenas estado_visual (eliminar status_interno)
      const { data, error } = await supabase
        .from('participacao')
        .select('id')
        .eq('operacao_id', operacaoId)
        .eq('estado_visual', 'NA_FILA')
        .eq('ativa', true)
        .order('data_participacao', { ascending: true });

      if (error) {
        console.error('Erro ao calcular posição na fila:', error);
        return 1;
      }

      return (data?.length || 0) + 1;
    } catch (error) {
      console.error('Erro ao calcular posição na fila:', error);
      return 1;
    }
  }

  // Adicionar na fila (ou como pendente)
  private async adicionarNaFila(membroId: number, operacaoId: number, diarias?: any): Promise<any> {
    try {
      // ✅ NOVA LÓGICA: SEMPRE criar como PENDENTE aguardando supervisor
      // Sistema automático determina se é vaga direta ou fila baseado na ordem cronológica
      console.log(`[ORCHESTRATOR-DB-WRITE] Inserindo participação para Membro ${membroId} na Op ${operacaoId}`, 'background: #fef2f2; color: #991b1b; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
      const { data, error } = await supabase
        .from('participacao')
        .insert({
          membro_id: membroId,
          operacao_id: operacaoId,
          status_interno: 'AGUARDANDO_SUPERVISOR',
          estado_visual: 'PENDENTE',  // ✅ SEMPRE PENDENTE inicialmente
          data_participacao: new Date().toISOString(),
          posicao_fila: null,         // ✅ Sem posição até supervisor decidir
          ativa: true
        })
        .select('id')
        .single();

      if (error) {
        console.error('Erro ao adicionar solicitação:', error);
        throw new Error('Falha ao processar solicitação');
      }

      console.log(`[ORCHESTRATOR-DB-SUCCESS] Participação ID ${data.id} inserida. O realtime DEVE ser disparado agora.`, 'background: #ecfdf5; color: #065f46; font-weight: bold; padding: 2px 4px; border-radius: 3px;');
      return { sucesso: true, mensagem: 'Adicionado à fila com sucesso', dados: { participacaoId: data.id } };
    } catch (error) {
      console.error('Erro ao processar solicitação:', error);
      throw error;
    }
  }

  // ✅ MÉTODO PÚBLICO: Para uso nas APIs
  async executarComandoEuVou(membroId: number, operacaoId: number): Promise<ResultadoEuVou> {
    const comando: ComandoEuVou = {
      membroId,
      operacaoId,
      tipoParticipacao: 'DIARIA_COMPLETA'
    };
    
    return this.executar(comando.membroId, comando.operacaoId);
  }

  async verificarDisponibilidade(membroId: number, operacaoId: number): Promise<boolean> {
    const validacao = await this.validador.validar(membroId, operacaoId, ContextoValidacao.SOLICITACAO);
    return validacao.podeParticipar;
  }

  async processarLote(membroId: number, operacoesIds: number[]): Promise<Map<number, boolean>> {
    const resultados = new Map<number, boolean>();
    
    for (const operacaoId of operacoesIds) {
      try {
        const disponivel = await this.verificarDisponibilidade(membroId, operacaoId);
        resultados.set(operacaoId, disponivel);
      } catch (error) {
        console.error(`Erro ao verificar operação ${operacaoId}:`, error);
        resultados.set(operacaoId, false);
      }
    }
    
    return resultados;
  }

  async buscarParticipacoesMembro(membroId: number): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('participacao')
        .select(`
          *,
          operacao:operacao_planejada(*)
        `)
        .eq('membro_id', membroId)
        .eq('ativa', true)
        .order('data_participacao', { ascending: false });

      if (error) {
        console.error('Erro ao buscar participações:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar participações:', error);
      return [];
    }
  }

  // ✅ CORREÇÃO: Método de cancelamento com valores válidos + BLOQUEIO DIRETORIA
  async cancelarParticipacao(membroId: number, operacaoId: number): Promise<boolean> {
    try {
      // 🔒 NOVA VERIFICAÇÃO: Checar se operação está na diretoria
      const { data: operacao, error: opError } = await supabase
        .from('operacao')
        .select('status, encaminhado_diretoria_em')
        .eq('id', operacaoId)
        .single();

      if (opError) {
        console.error('Erro ao verificar operação:', opError);
        return false;
      }

      // ❌ BLOQUEAR: Se operação está na diretoria, não permitir cancelamento
      if (operacao?.status === 'AGUARDANDO_DIRETORIA' || operacao?.encaminhado_diretoria_em) {
        // Directory block logging removed for performance
        throw new Error('BLOQUEADO_DIRETORIA: Não é possível cancelar participação. Operação está sendo analisada pela diretoria.');
      }

      // 🔒 NOVA VERIFICAÇÃO: Checar se a participação específica está bloqueada
      const { data: participacao, error: partError } = await supabase
        .from('participacao')
        .select('id, bloqueado_diretoria')
        .eq('membro_id', membroId)
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .single();

      if (partError) {
        console.error('Erro ao verificar participação:', partError);
        return false;
      }

      // ❌ BLOQUEAR: Se participação está explicitamente bloqueada
      if (participacao?.bloqueado_diretoria) {
        // Participation block logging removed for performance
        throw new Error('BLOQUEADO_DIRETORIA: Sua participação está temporariamente bloqueada devido à análise da diretoria.');
      }

      // 🎯 SOLUÇÃO DEFINITIVA: SOFT DELETE ao invés de DELETE físico
      // Soft delete execution logging removed for performance
      
      // 🎯 SOFT DELETE: UPDATE ativa = false (dados completos chegam no realtime!)
      const { error, count } = await supabase
        .from('participacao')
        .update({ 
          ativa: false,
          updated_at: new Date().toISOString()
        }, { count: 'exact' })
        .eq('membro_id', membroId)
        .eq('operacao_id', operacaoId)
        .eq('ativa', true);
      
      console.log(`📊 SOFT DELETE executado - linhas afetadas: ${count}`);
      console.log(`⏰ Timestamp após UPDATE: ${new Date().toISOString()}`);

      if (error) {
        console.error('❌ ERRO NO SOFT DELETE SUPABASE:', error);
        return false;
      }

      if (count === 0) {
        // 🔍 CORREÇÃO RACE CONDITION: Verificar se participação já estava cancelada
        console.log(`🔍 [RACE CONDITION] count=0 detectado - investigando se já foi cancelada`);
        
        const { data: jaInativa, error: checkError } = await supabase
          .from('participacao')
          .select('id, ativa')
          .eq('membro_id', membroId)
          .eq('operacao_id', operacaoId)
          .single();

        if (checkError) {
          return false;
        }

        if (jaInativa && !jaInativa.ativa) {
          return true; // ✅ Sucesso - já estava cancelada
        }

        return false;
      }

      console.log(`🎉 SOFT DELETE EXECUTADO COM SUCESSO! ${count} linha(s) desativada(s)`);
      console.log(`🔥 EVENTO UPDATE DEVE TER operacao_id=${operacaoId} NO PAYLOAD REALTIME AGORA!`);
      console.log(`🚀 [CORREÇÃO CONFIRMADA] EuVouOrchestrator usa SOFT DELETE - realtime deve funcionar`);

      // Promover próximo da fila se houver
      await this.promoverProximoDaFila(operacaoId);

      // 🎯 LOG CLICK: Registrar cancelamento bem-sucedido
      try {
        const { data: operacao } = await supabase
          .from('operacao')
          .select('data_operacao')
          .eq('id', operacaoId)
          .single();
        
        const { data: membro } = await supabase
          .from('servidor')
          .select('nome')
          .eq('id', membroId)
          .single();
        
        if (operacao && membro) {
          clickInspector.logClick(
            membro.nome, 
            operacao.data_operacao.split('T')[0], 
            operacaoId, 
            'CANCELAR'
          );
        }
      } catch (error) {
        // Click log error logging removed for performance
      }

      // Cancellation complete logging removed for performance
      return true;
    } catch (error) {
      console.error('Erro ao cancelar participação:', error);
      
      // Re-throw errors específicos de bloqueio para serem tratados na API
      if (error instanceof Error && error.message.startsWith('BLOQUEADO_DIRETORIA:')) {
        throw error;
      }
      
      return false;
    }
  }

  private async promoverProximoDaFila(operacaoId: number): Promise<void> {
    try {
      // ✅ CORREÇÃO: Buscar próximo usando apenas estado_visual
      const { data: proximoFila, error } = await supabase
        .from('participacao')
        .select('*')
        .eq('operacao_id', operacaoId)
        .eq('estado_visual', 'NA_FILA')
        .eq('ativa', true)
        .order('posicao_fila', { ascending: true })
        .limit(1)
        .single();

      if (error || !proximoFila) {
        // No queue to promote logging removed for performance
        return;
      }

      // Queue promotion logging removed for performance

      // Promover para aguardando aprovação supervisor
      await supabase
        .from('participacao')
        .update({
          status_interno: 'AGUARDANDO_SUPERVISOR',
          estado_visual: 'PENDENTE',
          posicao_fila: null,
          data_participacao: new Date().toISOString()
        })
        .eq('id', proximoFila.id);

      // Atualizar posições na fila (reorganizar)
      await this.atualizarPosicoesNaFila(operacaoId);

    } catch (error) {
      console.error('❌ Erro ao promover próximo da fila:', error);
    }
  }

  private async atualizarPosicoesNaFila(operacaoId: number): Promise<void> {
    try {
      // ✅ CORREÇÃO: Usar apenas participacao
      const { data: filaAtual, error } = await supabase
        .from('participacao')
        .select('id, membro_id, posicao_fila')
        .eq('operacao_id', operacaoId)
        .eq('estado_visual', 'NA_FILA')
        .eq('ativa', true)
        .order('posicao_fila', { ascending: true });

      if (error || !filaAtual || filaAtual.length === 0) {
        // No queue to reorganize logging removed for performance
        return;
      }

      // Queue reorganization logging removed for performance

      // Atualizar posições sequencialmente (1, 2, 3, ...)
      for (let i = 0; i < filaAtual.length; i++) {
        const novaPosicao = i + 1;
        
        await supabase
          .from('participacao')
          .update({ posicao_fila: novaPosicao })
          .eq('id', filaAtual[i].id);
      }

      // Queue reorganization success logging removed for performance
    } catch (error) {
      console.error('❌ Erro ao atualizar posições na fila:', error);
    }
  }
} 
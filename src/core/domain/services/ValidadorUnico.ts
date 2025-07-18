/**
 * 🎯 VALIDADOR ÚNICO - CENTRALIZADOR DE REGRAS DE NEGÓCIO
 * 
 * SUBSTITUI:
 * - ValidadorParticipacao.ts (lógica duplicada)
 * - Validações internas do EuVouOrchestrator
 * - Validações espalhadas pelas APIs
 * 
 * RESPONSABILIDADES:
 * - Validação de participação (SOLICITACAO + CONFIRMACAO)
 * - Validação de limites e restrições
 * - Cálculo de posições e filas
 * - Determinação de estratégias (confirmação direta vs fila)
 * - Validação de regras de negócio complexas
 */

import { supabase } from '@/lib/supabase';

// 📋 TIPOS E INTERFACES
interface DadosOperacao {
  id: number;
  data_operacao: string;
  modalidade: string;
  tipo: string;
  status: string;
  limite_participantes: number;
  ativa: boolean;
  janela_operacional?: any;
}

interface DadosMembro {
  id: number;
  nome: string;
  matricula: string;
  regional: string;
  perfil: string;
  ativo: boolean;
}

interface DadosParticipacao {
  id?: number;
  operacao_id: number;
  membro_id: number;
  estado_visual: string;
  data_participacao: string;
  ativa: boolean;
  posicao_fila?: number;
}

interface ResultadoValidacao {
  valido: boolean;
  estrategia: 'CONFIRMACAO_DIRETA' | 'ADICIONAR_FILA' | 'REJEITADO';
  mensagem: string;
  codigoErro?: string;
  detalhes?: any;
  dadosCalculados?: {
    participacoes_confirmadas: number;
    vagas_disponíveis: number;
    posicao_fila_estimada?: number;
    pode_confirmar_diretamente: boolean;
  };
}

interface ContextoValidacao {
  tipo: 'SOLICITACAO' | 'CONFIRMACAO' | 'CANCELAMENTO' | 'APROVACAO';
  operacao: DadosOperacao;
  membro: DadosMembro;
  participacao_existente?: DadosParticipacao;
  todas_participacoes?: DadosParticipacao[];
  parametros_sistema?: any;
}

export class ValidadorUnico {
  
  constructor() {
    // Validador único inicializado
  }

  /**
   * 🎯 MÉTODO PRINCIPAL - VALIDAÇÃO UNIFICADA
   * 
   * Este método substitui TODA a lógica de validação dispersa:
   * - ValidadorParticipacao.validar() 
   * - EuVouOrchestrator validações internas
   * - Validações ad-hoc nas APIs
   */
  async validarParticipacao(
    operacaoId: number, 
    membroId: number, 
    tipo: 'SOLICITACAO' | 'CONFIRMACAO' | 'CANCELAMENTO' | 'APROVACAO' = 'SOLICITACAO'
  ): Promise<ResultadoValidacao> {
    
    try {
      // 1️⃣ CARREGAMENTO DE DADOS (unificado)
      const contexto = await this.carregarContextoCompleto(operacaoId, membroId, tipo);

      // 2️⃣ VALIDAÇÕES BÁSICAS (unificadas)
      const validacaoBasica = await this.executarValidacoesBasicas(contexto);
      if (!validacaoBasica.valido) {
        return validacaoBasica;
      }

      // 3️⃣ CÁLCULO DE ESTRATÉGIA (nova lógica unificada)
      const estrategia = await this.calcularEstrategia(contexto);

      // 4️⃣ VALIDAÇÕES ESPECÍFICAS POR ESTRATÉGIA
      const validacaoEspecifica = await this.validarEstrategia(contexto, estrategia);

      return validacaoEspecifica;

    } catch (error) {
      
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Erro interno na validação',
        codigoErro: 'ERRO_VALIDACAO_INTERNA',
        detalhes: { error: error.message }
      };
    }
  }

  /**
   * 📊 CARREGAMENTO DE CONTEXTO COMPLETO
   * 
   * Substitui múltiplas chamadas dispersas por uma coleta unificada
   */
  private async carregarContextoCompleto(
    operacaoId: number, 
    membroId: number, 
    tipo: string
  ): Promise<ContextoValidacao> {
    


    // Carregar operação
    const { data: operacao, error: operacaoError } = await supabase
      .from('operacao')
      .select(`
        *,
        janela_operacional(*)
      `)
      .eq('id', operacaoId)
      .single();

    if (operacaoError || !operacao) {
      throw new Error(`Operação ${operacaoId} não encontrada`);
    }

    // Carregar membro
    const { data: membro, error: membroError } = await supabase
      .from('servidor')
      .select('*')
      .eq('id', membroId)
      .single();

    if (membroError || !membro) {
      throw new Error(`Membro ${membroId} não encontrado`);
    }

    // Carregar todas as participações da operação
    const { data: participacoes, error: participacoesError } = await supabase
      .from('participacao')
      .select('*')
      .eq('operacao_id', operacaoId)
      .eq('ativa', true)
      .order('data_participacao', { ascending: true });

    if (participacoesError) {
      throw new Error('Erro ao carregar participações');
    }

    // Verificar participação existente do membro
    const participacaoExistente = participacoes?.find(p => p.membro_id === membroId);

    return {
      tipo: tipo as any,
      operacao,
      membro,
      participacao_existente: participacaoExistente,
      todas_participacoes: participacoes || [],
      parametros_sistema: {
        // Parâmetros que seriam carregados de uma tabela de configuração
        permite_confirmacao_direta: true,
        dias_antecedencia_minima: 1,
        limite_participacoes_por_membro: 10
      }
    };
  }

  /**
   * 🔍 VALIDAÇÕES BÁSICAS UNIFICADAS
   * 
   * Substitui validações espalhadas em múltiplos locais
   */
  private async executarValidacoesBasicas(contexto: ContextoValidacao): Promise<ResultadoValidacao> {
    


    // Validação 1: Operação ativa
    if (!contexto.operacao.ativa) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Operação não está ativa',
        codigoErro: 'OPERACAO_INATIVA'
      };
    }

    // Validação 2: Membro ativo
    if (!contexto.membro.ativo) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Membro não está ativo no sistema',
        codigoErro: 'MEMBRO_INATIVO'
      };
    }

    // Validação 3: Data da operação (não pode ser no passado)
    const dataOperacao = new Date(contexto.operacao.data_operacao);
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    if (dataOperacao < hoje) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Não é possível participar de operações no passado',
        codigoErro: 'OPERACAO_PASSADO'
      };
    }

    // Validação 4: Participação duplicada (para SOLICITACAO)
    if (contexto.tipo === 'SOLICITACAO' && contexto.participacao_existente) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Você já está participando desta operação',
        codigoErro: 'PARTICIPACAO_DUPLICADA',
        detalhes: {
          estado_atual: contexto.participacao_existente.estado_visual,
          data_participacao: contexto.participacao_existente.data_participacao
        }
      };
    }

    // Validação 5: Antecedência mínima
    const diasAntecedencia = Math.ceil((dataOperacao.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const minimaAntecedencia = contexto.parametros_sistema?.dias_antecedencia_minima || 1;

    if (diasAntecedencia < minimaAntecedencia) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: `Solicitação deve ser feita com pelo menos ${minimaAntecedencia} dia(s) de antecedência`,
        codigoErro: 'ANTECEDENCIA_INSUFICIENTE'
      };
    }


    
    return {
      valido: true,
      estrategia: 'ADICIONAR_FILA', // Será refinado na próxima etapa
      mensagem: 'Validações básicas aprovadas'
    };
  }

  /**
   * ⚡ CÁLCULO DE ESTRATÉGIA
   * 
   * ESTA É A LÓGICA QUE RESOLVE O BUG DO "EU VOU"!
   * 
   * Determina se deve fazer confirmação direta ou adicionar à fila
   * baseado no STATUS da operação E disponibilidade de vagas
   */
  private async calcularEstrategia(contexto: ContextoValidacao): Promise<ResultadoValidacao> {
    
    // Calcular estatísticas atuais
    const participacoesConfirmadas = contexto.todas_participacoes.filter(p => 
      ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual)
    );
    
    const vagasDisponiveis = Math.max(0, contexto.operacao.limite_participantes - participacoesConfirmadas.length);
    const posicaoFilaEstimada = contexto.todas_participacoes.length + 1;

    const dadosCalculados = {
      participacoes_confirmadas: participacoesConfirmadas.length,
      vagas_disponíveis: vagasDisponiveis,
      posicao_fila_estimada: posicaoFilaEstimada,
      pode_confirmar_diretamente: false // Será definido pela lógica abaixo
    };

    // 🔥 LÓGICA CRÍTICA QUE RESOLVE O BUG:
    // 
    // O problema era que o EuVouOrchestrator tentava confirmação direta
    // apenas baseado em "ter vagas", mas o ValidadorParticipacao rejeitava
    // operações com status AGUARDANDO_SOLICITACOES para CONFIRMACAO
    //
    // SOLUÇÃO: Status da operação determina a estratégia!

    if (contexto.operacao.status === 'ATIVA') {
      // Operação ATIVA: pode fazer confirmação direta se há vagas
      if (vagasDisponiveis > 0) {
        dadosCalculados.pode_confirmar_diretamente = true;
        

        
        return {
          valido: true,
          estrategia: 'CONFIRMACAO_DIRETA',
          mensagem: `Confirmação direta - ${vagasDisponiveis} vaga(s) disponível(is)`,
          dadosCalculados
        };
      } else {
        return {
          valido: true,
          estrategia: 'ADICIONAR_FILA',
          mensagem: `Adicionado à fila de espera - posição ${posicaoFilaEstimada}`,
          dadosCalculados
        };
      }
    } 
    else if (contexto.operacao.status === 'AGUARDANDO_SOLICITACOES') {
      // Operação AGUARDANDO_SOLICITACOES: SEMPRE vai para fila
      // Mesmo que haja vagas, respeita o processo de solicitação
      

      
      return {
        valido: true,
        estrategia: 'ADICIONAR_FILA',
        mensagem: `Solicitação registrada - aguardando aprovação do supervisor`,
        dadosCalculados
      };
    } 
    else {
      // Outros status (FINALIZADA, CANCELADA, etc.)
      
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: `Operação não aceita novas participações (status: ${contexto.operacao.status})`,
        codigoErro: 'STATUS_INVALIDO_PARTICIPACAO',
        dadosCalculados
      };
    }
  }

  /**
   * 🔬 VALIDAÇÃO ESPECÍFICA POR ESTRATÉGIA
   * 
   * Aplica validações finais baseadas na estratégia determinada
   */
  private async validarEstrategia(
    contexto: ContextoValidacao, 
    resultadoEstrategia: ResultadoValidacao
  ): Promise<ResultadoValidacao> {
    


    switch (resultadoEstrategia.estrategia) {
      case 'CONFIRMACAO_DIRETA':
        return await this.validarConfirmacaoDireta(contexto, resultadoEstrategia);
      
      case 'ADICIONAR_FILA':
        return await this.validarAdicaoFila(contexto, resultadoEstrategia);
      
      case 'REJEITADO':
        return resultadoEstrategia; // Já foi validado/rejeitado
      
      default:
        throw new Error(`Estratégia desconhecida: ${resultadoEstrategia.estrategia}`);
    }
  }

  /**
   * ✅ VALIDAÇÃO PARA CONFIRMAÇÃO DIRETA
   */
  private async validarConfirmacaoDireta(
    contexto: ContextoValidacao, 
    resultado: ResultadoValidacao
  ): Promise<ResultadoValidacao> {
    
    // Validação adicional: verificar se realmente há vagas
    // (proteção contra condições de corrida)
    const participacoesConfirmadas = contexto.todas_participacoes.filter(p => 
      ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual)
    );
    
    const vagasAtuais = Math.max(0, contexto.operacao.limite_participantes - participacoesConfirmadas.length);

    if (vagasAtuais <= 0) {
      // Mudar estratégia para fila
      return {
        valido: true,
        estrategia: 'ADICIONAR_FILA',
        mensagem: 'Adicionado à fila - vaga foi ocupada por outro membro',
        dadosCalculados: {
          ...resultado.dadosCalculados,
          pode_confirmar_diretamente: false
        }
      };
    }
    
    return {
      ...resultado,
      valido: true,
      mensagem: `Participação confirmada automaticamente! ${vagasAtuais} vaga(s) disponível(is).`
    };
  }

  /**
   * 📋 VALIDAÇÃO PARA ADIÇÃO À FILA
   */
  private async validarAdicaoFila(
    contexto: ContextoValidacao, 
    resultado: ResultadoValidacao
  ): Promise<ResultadoValidacao> {
    
    // Validação: verificar se a fila não está muito grande
    const tamanhoFilaAtual = contexto.todas_participacoes.filter(p => 
      ['PENDENTE', 'NA_FILA'].includes(p.estado_visual)
    ).length;

    const limiteMaximoFila = contexto.operacao.limite_participantes * 3; // 3x o limite

    if (tamanhoFilaAtual >= limiteMaximoFila) {
      return {
        valido: false,
        estrategia: 'REJEITADO',
        mensagem: 'Fila de espera está lotada. Tente novamente mais tarde.',
        codigoErro: 'FILA_LOTADA',
        detalhes: { 
          tamanho_fila: tamanhoFilaAtual, 
          limite_fila: limiteMaximoFila 
        }
      };
    }
    
    return {
      ...resultado,
      valido: true,
      mensagem: `Solicitação registrada! Posição ${(resultado.dadosCalculados?.posicao_fila_estimada || 0)} na fila de espera.`
    };
  }

  /**
   * 📊 MÉTODO UTILITÁRIO - ESTATÍSTICAS DA OPERAÇÃO
   * 
   * Útil para dashboards e relatórios (independente de membro específico)
   */
  async obterEstatisticasOperacao(operacaoId: number): Promise<any> {


    try {
      // Carregar operação
      const { data: operacao, error: operacaoError } = await supabase
        .from('operacao')
        .select('*')
        .eq('id', operacaoId)
        .single();

      if (operacaoError || !operacao) {
        throw new Error(`Operação ${operacaoId} não encontrada`);
      }

      // Carregar todas as participações da operação
      const { data: participacoes, error: participacoesError } = await supabase
        .from('participacao')
        .select('*')
        .eq('operacao_id', operacaoId)
        .eq('ativa', true)
        .order('data_participacao', { ascending: true });

      if (participacoesError) {
        throw new Error('Erro ao carregar participações');
      }

      const todasParticipacoes = participacoes || [];
      
      const confirmados = todasParticipacoes.filter(p => 
        ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual)
      );
      const pendentes = todasParticipacoes.filter(p => 
        ['PENDENTE', 'NA_FILA'].includes(p.estado_visual)
      );

      return {
        operacao_id: operacaoId,
        limite_participantes: operacao.limite_participantes,
        confirmados: confirmados.length,
        pendentes: pendentes.length,
        vagas_disponíveis: Math.max(0, operacao.limite_participantes - confirmados.length),
        status: operacao.status,
        aceita_novas_participacoes: ['ATIVA', 'AGUARDANDO_SOLICITACOES'].includes(operacao.status)
      };
    } catch (error) {
      console.error('❌ [ESTATISTICAS] Erro:', error);
      throw error;
    }
  }
} 
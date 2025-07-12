'use client';

import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';
import { OperacaoDialog } from './OperacaoDialog';
import { supabase } from '@/lib/supabase';
// @ts-ignore - react-hot-toast será instalado
import { toast } from 'react-hot-toast';
import styles from './Calendario.module.css';

interface Operacao {
  id: number;
  dataOperacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limiteParticipantes: number;
  participantesAtuais?: number;
  janelaId: number;
  status: string;
  total_solicitacoes?: number;
  janela?: {
    id: number;
    dataInicio: string;
    dataFim: string;
    modalidades: string;
  };
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'PENDENTE' | 'NA_FILA' | 'DISPONIVEL';
    posicao_fila?: number;
  };
}

export const CalendarioMembro: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [membros, setMembros] = useState<Array<{id: number, nome: string, matricula: string}>>([]);
  const [membroAtual, setMembroAtual] = useState<string>('1');
  const [loading, setLoading] = useState<number | null>(null);
  
  // ✅ NOVO: Estados próprios para fetch (padrão da nova arquitetura)
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [loadingOperacoes, setLoadingOperacoes] = useState(true);

  // ✅ NOVO: Estado para controlar exibição da área de desenvolvimento
  const [mostrarAreaDesenvolvimento, setMostrarAreaDesenvolvimento] = useState(false);

  // ✅ FUNÇÃO DE FETCH UNIFICADA (substitui useOperacoes)
  const fetchOperacoes = React.useCallback(async () => {
    console.log(`[CalendarioMembro] 📡 Iniciando fetch operações...`);
    
    const startDate = startOfMonth(currentDate);
    const endDate = endOfMonth(currentDate);
    const membroId = localStorage.getItem('membroId') || '1';
    
    setLoadingOperacoes(true);
    
    try {
      const params = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        membroId,
        _t: Date.now().toString()
      });

      const response = await fetch(`/api/unified/operacoes?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        console.log(`[CalendarioMembro] ✅ Operações carregadas: ${data.data?.length || 0}`);
        setOperacoes(data.data || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar operações');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao conectar com o servidor';
      console.error(`[CalendarioMembro] ❌ Erro no fetch:`, errorMessage);
      toast.error('Erro ao carregar operações');
      setOperacoes([]);
    } finally {
      setLoadingOperacoes(false);
    }
  }, [currentDate]);

  // ✅ FUNÇÃO REFETCH (compatibilidade com código existente)
  const refetch = React.useCallback(() => {
    console.log(`[CalendarioMembro] 🔄 Refetch solicitado`);
    fetchOperacoes();
  }, [fetchOperacoes]);

  // ✅ NOVO: Hook unificado para realtime (substitui useRealtimeCentralized)
  const { isConnected, debugInfo } = useRealtime({
    channelId: `calendario-membro-${membroAtual}`,
    tables: ['operacao', 'participacao'],
    enabled: true,
         onDatabaseChange: (event) => {
       const recordId = (event.payload.new as any)?.id || (event.payload.old as any)?.id;
       
       console.log(`[CalendarioMembro] 📨 Realtime evento:`, {
         table: event.table,
         type: event.eventType,
         recordId
       });
       
       // Re-fetch para qualquer mudança no banco (INSERT, UPDATE, DELETE)
       refetch();
     },
    onConnectionChange: (status, error) => {
      console.log(`[CalendarioMembro] 🔌 Conexão: ${status}${error ? ` (${error})` : ''}`);
    },
    debug: false
  });

  // ✅ NOVA FUNÇÃO: Verificar se deve mostrar área de desenvolvimento
  const verificarAreaDesenvolvimento = React.useCallback(async () => {
    try {
      const response = await fetch('/api/configuracoes/area-desenvolvimento');
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMostrarAreaDesenvolvimento(data.mostrar);
        } else {
          setMostrarAreaDesenvolvimento(false);
        }
      } else {
        setMostrarAreaDesenvolvimento(false);
      }
    } catch (error) {
      console.error('Erro ao verificar área de desenvolvimento:', error);
      setMostrarAreaDesenvolvimento(false);
    }
  }, []);

  // ✅ FETCH INICIAL: Carregar operações quando componente monta ou mês muda
  React.useEffect(() => {
    fetchOperacoes();
  }, [fetchOperacoes]);

  // ✅ VERIFICAR ÁREA DE DESENVOLVIMENTO: Quando componente monta ou usuário muda
  React.useEffect(() => {
    verificarAreaDesenvolvimento();
  }, [verificarAreaDesenvolvimento]);

  // ✅ ATUALIZAR CANAL REALTIME quando membro muda
  React.useEffect(() => {
    console.log(`[CalendarioMembro] 👤 Membro alterado para: ${membroAtual}`);
    // O hook useRealtime já reconecta automaticamente com novo channelId
  }, [membroAtual]);

  // ✅ FUNÇÕES: Ações rápidas nos quadradinhos
  const handleQuickEuVou = async (operacaoId: number, event: React.MouseEvent) => {
    event.stopPropagation(); // Impede que abra o modal
    const membroId = localStorage.getItem('membroId') || '1';

    console.log(`[TEMP-LOG-QUICK-EU-VOU] 🚨 ======= QUICK EU VOU INICIADO =======`);
    console.log(`[TEMP-LOG-QUICK-EU-VOU] 🎯 Membro: ${membroId}, Operação: ${operacaoId}`);
    console.log(`[TEMP-LOG-QUICK-EU-VOU] ⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`[TEMP-LOG-QUICK-EU-VOU] 🔥 handleQuickEuVou foi chamada! (CALENDÁRIO RÁPIDO)`);

    setLoading(operacaoId);
    
    try {
      console.log(`[TEMP-LOG-QUICK-EU-VOU] 📡 Fazendo requisição para: /api/participations (UNIFICADA)`);
      console.log(`[TEMP-LOG-QUICK-EU-VOU] 📋 Payload:`, { action: 'join', operationId: operacaoId.toString(), membroId });
      
      const response = await fetch(`/api/participations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: operacaoId.toString(),
          membroId: membroId
        })
      });

      console.log(`[TEMP-LOG-QUICK-EU-VOU] 📡 Response status: ${response.status}`);
      const data = await response.json();
      console.log(`[TEMP-LOG-QUICK-EU-VOU] 📊 Response data:`, data);

      if (data.success) {
        console.log(`[TEMP-LOG-QUICK-EU-VOU] ✅ SUCESSO! Quick EU VOU realizado.`);
        toast.success(data.data.mensagem || 'Participação confirmada!');
        refetch();
      } else {
        console.log(`[TEMP-LOG-QUICK-EU-VOU] ❌ FALHA! Erro:`, data.error);
        toast.error(data.error || 'Erro ao confirmar participação');
      }
    } catch (error) {
      console.log(`[TEMP-LOG-QUICK-EU-VOU] 💥 EXCEÇÃO! Erro:`, error);
      toast.error('Erro ao processar solicitação');
      console.error('Erro EU VOU:', error);
    } finally {
      setLoading(null);
      console.log(`[TEMP-LOG-QUICK-EU-VOU] 🏁 Finalizando Quick EU VOU`);
    }
  };

  const handleQuickCancelar = async (operacaoId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const membroId = localStorage.getItem('membroId') || '1';

    setLoading(operacaoId);
    
    try {
      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          membroId: localStorage.getItem('membroId') || '1',
          operacaoId: operacaoId
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.data.mensagem || 'Participação cancelada!');
        refetch();
      } else {
        toast.error(data.error || 'Erro ao cancelar participação');
      }
    } catch (error) {
      toast.error('Erro ao processar cancelamento');
      console.error('Erro CANCELAR:', error);
    } finally {
      setLoading(null);
    }
  };

  // ✅ FUNÇÃO: Determinar ação rápida para operação única
  // 🎯 LÓGICA DO BOTÃO DINÂMICO:
  // 1. "EU VOU" (verde) - quando há vagas diretas disponíveis
  // 2. "ENTRAR NA FILA" (amarelo) - quando vagas estão ocupadas mas há espaço na fila
  // 3. "LOTADO" (vermelho) - quando não há espaço nem na fila (mas mantém clicável para transparência)
  const getQuickActionInfo = (operacao: any) => {
    const estado = operacao.minha_participacao?.estado_visual;
    
    // ✅ CORREÇÃO: Se tem participação, verificar estado
    if (estado === 'CONFIRMADO' || estado === 'ADICIONADO_SUP') {
      return {
        text: 'CANCELAR',
        action: 'cancelar',
        className: styles.quickCancel,
        available: true
      };
    }
    
    if (estado === 'PENDENTE' || estado === 'NA_FILA') {
      return {
        text: 'CANCELAR',
        action: 'cancelar',
        className: styles.quickCancel,
        available: true
      };
    }
    
    // ✅ CORREÇÃO CRÍTICA: Se não tem participação (deletada pelo supervisor), recalcular baseado na operação
    // Não importa se havia participação antes - o que importa é o estado atual da operação
    const confirmados = operacao.participantes_confirmados || 0;
    const pendentes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0; // ✅ CORREÇÃO: usar total_solicitacoes (inclui PENDENTE)
    const limite = operacao.limite_participantes;
    
    // Total de pessoas na operação = confirmados + pendentes
    const totalPessoas = confirmados + pendentes;
    
    // ✅ NOVA LÓGICA: Baseada apenas no estado atual da operação
    if (totalPessoas < limite) {
      // Há vagas diretas disponíveis -> "EU VOU" (verde)
      return {
        text: 'EU VOU',
        action: 'participar',
        className: styles.quickParticipate,
        available: true
      };
    } else if (totalPessoas < (limite * 2)) {
      // Operação cheia mas há espaço na fila de espera -> "ENTRAR NA FILA" (amarelo)
      return {
        text: 'ENTRAR NA FILA',
        action: 'participar',
        className: styles.quickQueue,
        available: true
      };
    } else {
      // Operação + fila completamente lotadas -> "LOTADO" (vermelho)
      return {
        text: 'LOTADO',
        action: 'lotado',
        className: styles.quickLotado,
        available: true // Visível mas não funcional
      };
    }
  };

  // Carregar lista de membros
  useEffect(() => {
    const carregarMembros = async () => {
      try {
        const response = await fetch('/api/supervisor/membros');
        if (response.ok) {
          const data = await response.json();
          setMembros(data.data || []);
        }
      } catch (error) {
        console.error('Erro ao carregar membros:', error);
        // Membros de fallback para desenvolvimento
        setMembros([
          { id: 1, nome: 'Douglas Santos', matricula: 'SUP001' },
          { id: 2, nome: 'Ana Santos', matricula: 'SUP002' },
          { id: 3, nome: 'João Oliveira', matricula: 'SUP003' },
          { id: 4, nome: 'Carlos Silva', matricula: 'MEM001' },
          { id: 5, nome: 'Maria Ferreira', matricula: 'MEM002' },
          { id: 6, nome: 'José Almeida', matricula: 'MEM003' }
        ]);
      }
    };
    carregarMembros();
  }, []);

  // Inicializar membro atual
  useEffect(() => {
    // Recuperar membro atual do localStorage
    const savedMembro = localStorage.getItem('membroId') || '1';
    setMembroAtual(savedMembro);
  }, []);

  // Trocar membro para teste
  const handleMembroChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const novoMembroId = e.target.value;
    
    setMembroAtual(novoMembroId);
    localStorage.setItem('membroId', novoMembroId);
    refetch();
  };

  // Gerar dias do calendário
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Segunda-feira
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const dias = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Agrupar operações por dia - usando SOMENTE campos do banco real
  const operacoesPorDia = operacoes?.reduce((acc, op: any) => {
    // SOMENTE usar campo do banco: data_operacao
    const dataOp = op.data_operacao;
    if (!dataOp) {
      console.warn('Operação sem data_operacao:', op);
      return acc;
    }
    // Garantir que não há problemas de timezone
    const key = dataOp.includes('T') ? dataOp.split('T')[0] : dataOp;
    if (!acc[key]) acc[key] = [];
    acc[key].push(op);
    return acc;
  }, {} as Record<string, any[]>) || {};

  // Navegação limpa
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  // Função para voltar ao mês atual
  const handleGoToToday = () => {
    setCurrentDate(new Date());
    // Não seleciona o dia atual para evitar abrir o modal
  };

  // ✅ FUNCIONALIDADE TECLADO: ESC para fechar modal, ESPAÇO para refresh
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // ESC: Fechar modal se estiver aberto
      if (event.key === 'Escape' && selectedDate) {
        setSelectedDate(null);
      }
      
      // ESPAÇO: Refresh das operações (mesmo efeito do botão refresh)
      if (event.key === ' ' || event.code === 'Space') {
        // Prevenir scroll da página
        event.preventDefault();
        
        // Só executar se não estiver em um input ou textarea
        const activeElement = document.activeElement;
        const isInputField = activeElement && (
          activeElement.tagName === 'INPUT' || 
          activeElement.tagName === 'TEXTAREA' || 
          activeElement.tagName === 'SELECT' ||
          activeElement.getAttribute('contenteditable') === 'true'
        );
        
        if (!isInputField) {
          // Chamar a mesma função do botão refresh
          refetch();
          // Feedback visual discreto
          toast.success('Calendário atualizado!', {
            duration: 1500,
            style: {
              fontSize: '0.875rem',
              padding: '0.5rem 0.75rem'
            }
          });
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDate, refetch]);

  // ✅ FUNÇÃO: Lidar com clique no dia (sempre abre modal, exceto quando clica no botão)
  const handleDayClick = (dia: Date, operacoesDia: any[]) => {
    // Sempre abre o modal quando clica no dia (botão rápido é só conveniência)
    setSelectedDate(dia);
  };

  // ✅ FUNÇÃO: Obter dados do usuário logado
  const getUserData = () => {
    try {
      const membroAuth = localStorage.getItem('membroAuth');
      if (membroAuth) {
        const userData = JSON.parse(membroAuth);
        return {
          nome: userData.nome,
          matricula: userData.matricula,
          regionalId: userData.regionalId
        };
      }
    } catch (error) {
      console.error('Erro ao obter dados do usuário:', error);
    }
    return null;
  };

  const userData = getUserData();

  // ✅ FUNÇÃO: Logout
  const handleLogout = () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      localStorage.removeItem('membroAuth');
      localStorage.removeItem('membroId');
      window.location.href = '/';
    }
  };

  return (
    <div className={styles.mainLayout}>
      {/* Header Discreto do Usuário */}
      {userData && (
        <header className={styles.userHeader}>
          <div className={styles.userHeaderContent}>
            <div className={styles.userInfo}>
              <div className={styles.userAvatar}>
                {userData.nome.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </div>
              <div className={styles.userDetails}>
                <span className={styles.userName}>{userData.nome}</span>
                <span className={styles.userMatricula}>Mat. {userData.matricula}</span>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className={styles.logoutButton}
              title="Sair do sistema"
            >
              Sair
            </button>
          </div>
        </header>
      )}

      {/* Container Principal com Sidebar e Calendário */}
      <div className={styles.mainContent}>
        {/* ✅ Sidebar Esquerda - Área de Desenvolvimento (condicional) */}
        {mostrarAreaDesenvolvimento && (
          <aside className={styles.sidebarLeft}>
            <div className={styles.sidebarPlaceholder}>
              <div className={styles.icon}>⚙️</div>
              <div>
                <h3>Área de Desenvolvimento</h3>
                <p>Esta seção será utilizada para futuras funcionalidades.</p>
                
                {/* Seletor de Membro para Teste */}
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '8px', border: '1px dashed #ccc' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: '#666' }}>
                    🧪 Teste - Trocar Membro:
                  </label>
                  <select 
                    value={membroAtual} 
                    onChange={handleMembroChange}
                    style={{ 
                      width: '100%', 
                      padding: '0.5rem', 
                      borderRadius: '4px', 
                      border: '1px solid #ccc',
                      fontSize: '0.875rem',
                      backgroundColor: 'var(--bg-card)'
                    }}
                  >
                    {membros.map(membro => (
                      <option key={membro.id} value={membro.id.toString()}>
                        {membro.nome} ({membro.matricula})
                      </option>
                    ))}
                  </select>
                  <small style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.75rem', color: '#666' }}>
                    Membro atual: ID {membroAtual}
                  </small>
                </div>
                
                <ul>
                  <li>📅 Filtros avançados</li>
                  <li>📝 Minhas operações</li>
                  <li>🔍 Busca por data</li>
                  <li>📊 Estatísticas pessoais</li>
                </ul>
              </div>
            </div>
          </aside>
        )}

      {/* Área Principal do Calendário */}
      <main className={styles.calendarArea}>
        <div className={styles.calendarContainer}>
          {/* Header do Calendário */}
          <header className={styles.calendarHeader}>
            <div className={styles.leftButtons}>
              <button 
                className={styles.navButton} 
                onClick={handlePrevMonth}
                aria-label="Mês anterior"
              >
                <ChevronLeft size={20} />
                Anterior
              </button>
              
              <button 
                className={styles.todayButton}
                onClick={handleGoToToday}
                aria-label="Ir para hoje"
              >
                HOJE
              </button>
            </div>
            
            <h1 className={styles.monthYear}>
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h1>
            
            <button 
              className={styles.navButton}
              onClick={handleNextMonth}
              aria-label="Próximo mês"
            >
              Próximo
              <ChevronRight size={20} />
            </button>
          </header>

          {/* Grid do Calendário */}
          <div className={styles.calendarContent}>
            <div className={styles.calendarGridWrapper}>
              <div className={styles.calendarGrid}>
                {/* Dias da semana */}
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(dia => (
                  <div key={dia} className={styles.dayName}>
                    {dia}
                  </div>
                ))}

                {/* Dias do mês */}
                {dias.map(dia => {
                  const key = format(dia, 'yyyy-MM-dd');
                  const operacoesDia = operacoesPorDia[key] || [];
                  const isCurrentMonth = isSameMonth(dia, currentDate);
                  const isHoje = isToday(dia);
                  const isSelected = selectedDate && format(selectedDate, 'yyyy-MM-dd') === key;

                  // ✅ NOVA LÓGICA: Determinar se tem operação única
                  const hasUniqueOperation = operacoesDia.length === 1;
                  const uniqueOperation = hasUniqueOperation ? operacoesDia[0] : null;
                  const quickActionInfo = uniqueOperation ? getQuickActionInfo(uniqueOperation) : null;

                  // Determinar tipo de operações no dia para cores leves
                  const temBLITZ = operacoesDia.some((op: any) => op.modalidade === 'BLITZ');
                  const temBALANCA = operacoesDia.some((op: any) => op.modalidade === 'BALANCA');
                  const temMultiplas = temBLITZ && temBALANCA;

                  return (
                    <div
                      key={key}
                      className={`
                        ${styles.dayCell} 
                        ${!isCurrentMonth ? styles.otherMonth : ''}
                        ${isHoje ? styles.currentDay : ''}
                        ${isSelected ? styles.selected : ''}
                        ${operacoesDia.length > 0 ? styles.hasOperacoes : ''}
                        ${hasUniqueOperation ? styles.singleOperationCell : ''}
                        ${temMultiplas ? styles.lightMultiple : ''}
                        ${!temMultiplas && temBLITZ ? styles.lightBLITZ : ''}
                        ${!temMultiplas && temBALANCA ? styles.lightBALANCA : ''}
                      `}
                      onClick={() => handleDayClick(dia, operacoesDia)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${format(dia, 'd')} de ${format(dia, 'MMMM', { locale: ptBR })}`}
                    >
                      <div className={styles.dayNumber}>
                        {format(dia, 'd')}
                      </div>
                      
                      {operacoesDia.length > 0 && (
                        <div className={styles.operacaoInfo}>
                          {hasUniqueOperation ? (
                            // ✅ OPERAÇÃO ÚNICA: Mostrar com botão rápido
                            <div className={styles.singleOperationInfo}>
                              <div className={styles.operationTitle}>
                                <span className={styles.operationIcon}>
                                  {uniqueOperation.modalidade === 'BLITZ' ? '🚨' : '⚖️'}
                                </span>
                                <span className={styles.operationName}>
                                  {uniqueOperation.modalidade}
                                  {uniqueOperation.horario && (
                                    <span className={styles.operationTime}>
                                      {' '}{uniqueOperation.horario}
                                    </span>
                                  )}
                                </span>
                              </div>
                              
                              <div className={styles.operationStats}>
                                <span className={styles.participantCount}>
                                  {uniqueOperation.participantes_confirmados || 0}/{uniqueOperation.limite_participantes}
                                </span>
                                {(uniqueOperation.total_solicitacoes || uniqueOperation.pessoas_na_fila || 0) > 0 && (
                                  <span className={styles.queueCount}>
                                    +{uniqueOperation.total_solicitacoes || uniqueOperation.pessoas_na_fila} fila
                                  </span>
                                )}
                              </div>

                              {/* ✅ BOTÃO RÁPIDO */}
                              {quickActionInfo && quickActionInfo.available && (
                                <button
                                  className={`${styles.quickActionButton} ${quickActionInfo.className}`}
                                  onClick={(e) => {
                                    console.log(`[TEMP-LOG-CALENDAR-CLICK] 🔥 CLIQUE DETECTADO no calendário! Operação: ${uniqueOperation.id}`);
                                    console.log(`[TEMP-LOG-CALENDAR-CLICK] 🎯 Ação: ${quickActionInfo.action}, Texto: ${quickActionInfo.text}`);
                                    
                                    if (quickActionInfo.action === 'cancelar') {
                                      console.log(`[TEMP-LOG-CALENDAR-CLICK] ➡️ Chamando handleQuickCancelar(${uniqueOperation.id})`);
                                      handleQuickCancelar(uniqueOperation.id, e);
                                    } else if (quickActionInfo.action === 'participar') {
                                      console.log(`[TEMP-LOG-CALENDAR-CLICK] ➡️ Chamando handleQuickEuVou(${uniqueOperation.id})`);
                                      handleQuickEuVou(uniqueOperation.id, e);
                                    } else if (quickActionInfo.action === 'lotado') {
                                      console.log(`[TEMP-LOG-CALENDAR-CLICK] 🚫 Operação lotada - apenas visual`);
                                      // ✅ CORREÇÃO: Não executa nada - apenas visual
                                      e.stopPropagation();
                                      return;
                                    }
                                  }}
                                  disabled={loading === uniqueOperation.id}
                                  title={
                                    quickActionInfo.action === 'cancelar' ? 'Cancelar participação' : 
                                    quickActionInfo.action === 'participar' ? 'Confirmar participação' :
                                    quickActionInfo.action === 'lotado' ? 'Operação lotada - apenas informativo' :
                                    ''
                                  }
                                >
                                  {loading === uniqueOperation.id ? '...' : quickActionInfo.text}
                                </button>
                              )}
                            </div>
                          ) : (
                            // ✅ MÚLTIPLAS OPERAÇÕES: Mostrar resumo (comportamento original)
                            <>
                              {operacoesDia.slice(0, 2).map((op: any, idx) => {
                                // Calcular status da operação
                                const confirmados = op.participantes_confirmados || 0;
                                const pendentes = op.total_solicitacoes || op.pessoas_na_fila || 0; // ✅ CORREÇÃO: usar total_solicitacoes
                                const limite = op.limite_participantes;
                                
                                const vagasDisponiveis = Math.max(0, limite - confirmados);
                                const espacoNaFila = Math.max(0, limite - pendentes);
                                
                                let statusClass = '';
                                let statusIcon = '';
                                
                                if (vagasDisponiveis > 0) {
                                  statusClass = styles.statusDisponivel;
                                  statusIcon = '🟢';
                                } else if (espacoNaFila > 0) {
                                  statusClass = styles.statusFila;
                                  statusIcon = '🟡';
                                } else {
                                  statusClass = styles.statusLotado;
                                  statusIcon = '🔴';
                                }
                                
                                return (
                                  <div
                                    key={idx}
                                    className={`${styles.operacaoItem} ${styles[op.modalidade.toLowerCase()]}`}
                                  >
                                    <div className={styles.operacaoHeader}>
                                      <span className={styles.operacaoIcon}>
                                        {op.modalidade === 'BLITZ' ? '🚨' : '⚖️'}
                                      </span>
                                      <span className={styles.operacaoName}>
                                        {op.modalidade} - {op.turno}
                                        {op.horario && (
                                          <span className={styles.operationTime}>
                                            {' '}{op.horario}
                                          </span>
                                        )}
                                      </span>
                                      <span className={`${styles.statusIndicator} ${statusClass}`}>
                                        {statusIcon}
                                      </span>
                                    </div>
                                    <div className={styles.operacaoStats}>
                                      <span className={styles.participantesCount}>
                                        👥 {confirmados}/{limite}
                                      </span>
                                      {pendentes > 0 && (
                                        <span className={styles.filaIndicator}>
                                          ⏳ {pendentes}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                              {operacoesDia.length > 2 && (
                                <span className={styles.moreOperacoes}>
                                  +{operacoesDia.length - 2} mais
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Info da data atual */}
            <div className={styles.currentDateInfo}>
              <strong>Hoje:</strong> {format(new Date(), 'dd/MM/yyyy', { locale: ptBR })} | 
              <strong> Selecionado:</strong> {
                selectedDate 
                  ? format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })
                  : 'Nenhum dia selecionado'
              }
            </div>
          </div>
        </div>
      </main>
      </div> {/* Fecha mainContent */}

      {/* Dialog de Operações */}
      {selectedDate && (
        <OperacaoDialog
          date={selectedDate}
          operacoes={operacoesPorDia[format(selectedDate, 'yyyy-MM-dd')] || []}
          onClose={() => setSelectedDate(null)}
          onOperacaoUpdate={refetch}
        />
      )}
    </div>
  );
}; 
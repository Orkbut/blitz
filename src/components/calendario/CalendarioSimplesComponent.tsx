'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, startOfWeek, endOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar, Loader2, MessageCircle } from 'lucide-react';
import { useRealtime } from '@/hooks/useRealtime';
import { OperacaoDialog } from './OperacaoDialog';
import { LimitesBarras } from './LimitesBarras';

// @ts-ignore - react-hot-toast será instalado
import { toast } from 'react-hot-toast';
import styles from './CalendarioSimples.module.css';

interface Operacao {
  id: number;
  dataOperacao: string;
  data_operacao: string;
  modalidade: 'BLITZ' | 'BALANCA';
  tipo: 'PLANEJADA' | 'VOLUNTARIA';
  turno: string;
  horario?: string;
  limiteParticipantes: number;
  limite_participantes: number;
  participantesAtuais?: number;
  participantes_confirmados?: number;
  pessoas_na_fila?: number;
  janelaId: number;
  status: string;
  total_solicitacoes?: number;
  ativa?: boolean;
  excluida_temporariamente?: boolean;
  updated_at?: string;
  // Campos para inativação de operações
  inativa_pelo_supervisor?: boolean;
  data_inativacao?: string;
  motivo_inativacao?: string;
  supervisor_inativacao_id?: number;
  // ✅ NOVO: Indicador de fotos
  tem_fotos?: boolean;
  coordenadores_ids?: number[];
  janela?: {
    id: number;
    dataInicio: string;
    dataFim: string;
    modalidades: string;
  };
  minha_participacao?: {
    estado_visual: 'CONFIRMADO' | 'PENDENTE' | 'NA_FILA' | 'DISPONIVEL' | 'ADICIONADO_SUP';
    posicao_fila?: number;
  };
  participacoes?: { id: number; servidor_id: number; estado_visual: string }[];
}

type Props = { servidorDestacadoId?: number; onMonthChange?: (date: Date) => void };
export const CalendarioSimplesComponent: React.FC<Props> = ({ servidorDestacadoId, onMonthChange }) => {
  // Log para debug de re-renderizações

  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [tipoDestaque, setTipoDestaque] = useState<'anterior' | 'corrente' | 'diarias' | null>(null);

  const [membroAtual, setMembroAtual] = useState<string>(() => {
    // Inicializar com ID do membro logado
    if (typeof window !== 'undefined') {
      const membroAuth = localStorage.getItem('membroAuth');
      if (membroAuth) {
        try {
          const userData = JSON.parse(membroAuth);
          return userData.id?.toString() || '1';
        } catch {
          // Fallback para localStorage antigo
        }
      }
      return localStorage.getItem('membroId') || '1';
    }
    return '1';
  });
  const [loadingButtons, setLoadingButtons] = useState<Set<number>>(new Set());
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [operacoesComFotos, setOperacoesComFotos] = useState<Set<number>>(new Set());

  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('calendar-theme') === 'dark';
    }
    return false;
  });

  const [loadingRelatorio, setLoadingRelatorio] = useState(false);

  // Estados para janelas e seleção de janela do relatório
  const [janelasDisponiveis, setJanelasDisponiveis] = useState<Array<{ id: number; dataInicio: string; dataFim: string }>>([]);
  const [janelaSelecionada, setJanelaSelecionada] = useState<number | null>(null);

  useEffect(() => {
    if (onMonthChange) onMonthChange(currentDate);
  }, [currentDate, onMonthChange]);

  // Carregar janelas operacionais ativas (ordem: mais recentes primeiro) e pré-selecionar a última criada
  useEffect(() => {
    let isMounted = true;
    const carregarJanelas = async () => {
      try {
        const resp = await fetch('/api/supervisor/janelas-operacionais');
        if (!resp.ok) return;
        const json = await resp.json();
        if (!isMounted) return;
        if (json?.data && Array.isArray(json.data)) {
          setJanelasDisponiveis(json.data as Array<{ id: number; dataInicio: string; dataFim: string }>);
          // Não pré-selecionar automaticamente; manter desabilitado até o usuário escolher
          setJanelaSelecionada((prev) => (prev && json.data.some((j: any) => j.id === prev) ? prev : null));
        }
      } catch (e) {
        console.error('Erro ao carregar janelas operacionais:', e);
      }
    };
    carregarJanelas();
    return () => {
      isMounted = false;
    };
  }, []);
  // Estados para o modal
  const [operacoesPorDia, setOperacoesPorDia] = useState<Record<string, Operacao[]>>({});

  // Parser seguro para datas no formato 'YYYY-MM-DD' (tratar como horário local para evitar deslocamento de fuso)
  const parseLocalDate = (dateStr: string): Date => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return new Date(`${dateStr}T12:00:00`);
    }
    return new Date(dateStr);
  };

  // Função auxiliar para calcular sequências consecutivas
  const calcularSequenciasConsecutivas = (datas: string[]): string[][] => {
    if (datas.length === 0) return [];
    
    const sequencias: string[][] = [];
    let sequenciaAtual: string[] = [datas[0]];
    
    for (let i = 1; i < datas.length; i++) {
      const dataAtual = parseLocalDate(datas[i]);
      const dataAnterior = parseLocalDate(datas[i - 1]);
      const diffDias = (dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24);
      
      if (diffDias === 1) {
        // Dia consecutivo
        sequenciaAtual.push(datas[i]);
      } else {
        // Nova sequência
        sequencias.push([...sequenciaAtual]);
        sequenciaAtual = [datas[i]];
      }
    }
    
    // Adicionar última sequência
    sequencias.push(sequenciaAtual);
    return sequencias;
  };

  // Função auxiliar para calcular períodos consecutivos (igual à API do supervisor)
  const calcularPeriodosConsecutivos = (datas: Date[]): any[] => {
    if (datas.length === 0) return [];

    const periodos = [];
    let inicioAtual = datas[0];
    let fimAtual = datas[0];

    for (let i = 1; i < datas.length; i++) {
      const dataAtual = datas[i];
      const dataAnterior = datas[i - 1];
      
      // Verificar se é consecutiva (diferença de 1 dia)
      const diferencaDias = Math.round((dataAtual.getTime() - dataAnterior.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diferencaDias === 1) {
        fimAtual = dataAtual;
      } else {
        // Finalizar período atual
        const dias = Math.round((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        periodos.push({
          inicio: inicioAtual,
          fim: fimAtual,
          dias
        });
        
        // Iniciar novo período
        inicioAtual = dataAtual;
        fimAtual = dataAtual;
      }
    }

    // Adicionar último período
    const dias = Math.round((fimAtual.getTime() - inicioAtual.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    periodos.push({
      inicio: inicioAtual,
      fim: fimAtual,
      dias
    });

    return periodos;
  };

  // Função para gerar relatório no formato da diretoria (igual à API do supervisor)
  const gerarRelatorioMembro = async (janelaIdForReport?: number): Promise<string> => {
    const mesAtual = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    
    // Sempre gerar relatório pelo calendário do membro, sem exigir confirmação do supervisor

    try {

      
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      // Buscar janela operacional
      // Se o usuário selecionou explicitamente uma janela, buscar por ID.
      // Caso contrário, buscar a janela ativa que contenha a data atual do calendário.
      let janela: any = null;
      let errorJanela: any = null;

      if (janelaIdForReport) {
        const { data, error } = await supabase
          .from('janela_operacional')
          .select('id, data_inicio, data_fim, modalidades')
          .eq('id', janelaIdForReport)
          .single();
        janela = data;
        errorJanela = error;
      } else {
        // Buscar janela operacional ativa que contém a data atual do calendário
        const dataAtual = currentDate.toISOString().split('T')[0];
        const { data, error } = await supabase
          .from('janela_operacional')
          .select('id, data_inicio, data_fim, modalidades')
          .lte('data_inicio', dataAtual)
          .gte('data_fim', dataAtual)
          .eq('ativa', true)
          .single();
        janela = data;
        errorJanela = error;
      }
      
      if (errorJanela && errorJanela.code !== 'PGRST116') {
        throw new Error(`Erro ao buscar janela operacional: ${errorJanela.message}`);
      }
      
      // Buscar operações PLANEJADAS da janela (igual à API do supervisor)
      let queryOperacoes = supabase
        .from('operacao')
        .select('id, data_operacao, turno, modalidade, tipo, limite_participantes, status, janela_id')
        .eq('ativa', true)
        .eq('tipo', 'PLANEJADA')
        .order('data_operacao', { ascending: true });
      
      // Se encontrou janela, filtrar por ela
      if (janela) {
        queryOperacoes = queryOperacoes.eq('janela_id', janela.id);
      } else {
        // Fallback: buscar operações do mês atual do calendário
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        queryOperacoes = queryOperacoes
          .gte('data_operacao', startDate.toISOString().split('T')[0])
          .lte('data_operacao', endDate.toISOString().split('T')[0]);
      }
      
      const { data: operacoesPeriodo, error: errorOperacoes } = await queryOperacoes;
      
      if (errorOperacoes) {
        throw new Error(`Erro ao buscar operações: ${errorOperacoes.message}`);
      }
      
      if (!operacoesPeriodo || operacoesPeriodo.length === 0) {
        return `Nenhuma operação encontrada para ${mesAtual}.`;
      }
      
      // Buscar participações incluindo confirmados e pendentes (não exige aprovação do supervisor)
      const operacaoIds = operacoesPeriodo.map(op => op.id);
      const { data: participacoes, error: errorParticipacoes } = await supabase
        .from('participacao')
        .select(`
          id,
          membro_id,
          operacao_id,
          data_participacao,
          estado_visual,
          ativa,
          servidor:membro_id(
            id,
            nome,
            matricula
          )
        `)
        .eq('ativa', true)
        .in('estado_visual', ['CONFIRMADO', 'ADICIONADO_SUP', 'PENDENTE', 'SOLICITADO', 'NA_FILA', 'APROVADO'])
        .in('operacao_id', operacaoIds);
      
      if (errorParticipacoes) {
        throw new Error(`Erro ao buscar participações: ${errorParticipacoes.message}`);
      }
      
      
      
      if (!participacoes || participacoes.length === 0) {
        return `Nenhuma participação encontrada para ${mesAtual}.`;
      }
      
      // Buscar informações da janela operacional para título e período (igual à API do supervisor)
      let tituloOperacao = 'OPERAÇÃO RADAR E PESAGEM';
      let periodoOperacao = '';
      
      if (janela) {
        // Gerar título baseado nas modalidades da janela
        const modalidades = janela.modalidades?.split(',') || ['RADAR', 'PESAGEM'];
        if (modalidades.includes('BLITZ') && modalidades.includes('BALANCA')) {
          tituloOperacao = 'OPERAÇÃO RADAR E PESAGEM';
        } else if (modalidades.includes('BLITZ')) {
          tituloOperacao = 'OPERAÇÃO RADAR';
        } else if (modalidades.includes('BALANCA')) {
          tituloOperacao = 'OPERAÇÃO PESAGEM';
        }
        
        // Gerar período baseado nas datas da janela
        const dataInicio = new Date(`${janela.data_inicio}T12:00:00`);
        const dataFim = new Date(`${janela.data_fim}T12:00:00`);
        
        // Se o período abrange múltiplos meses, mostrar o período completo
        if (dataInicio.getMonth() !== dataFim.getMonth() || dataInicio.getFullYear() !== dataFim.getFullYear()) {
          const mesInicioAbrev = dataInicio.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
          const mesFimAbrev = dataFim.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase().replace('.', '');
          const diaInicio = dataInicio.toLocaleDateString('pt-BR', { day: '2-digit' });
          const diaFim = dataFim.toLocaleDateString('pt-BR', { day: '2-digit' });
          const anoInicio = dataInicio.getFullYear();
          const anoFim = dataFim.getFullYear();
          periodoOperacao = `${mesInicioAbrev} ${diaInicio}-${String(dataInicio.getMonth() + 1).padStart(2, '0')}-${anoInicio} A ${mesFimAbrev} ${diaFim}-${String(dataFim.getMonth() + 1).padStart(2, '0')}-${anoFim}`;
        } else {
          // Se é do mesmo mês, mostrar apenas o mês/ano
          periodoOperacao = dataInicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
        }
      } else {
        // Fallback para o comportamento anterior quando não há janela
        const primeiraData = new Date(Math.min(...operacoesPeriodo.map(op => parseLocalDate(op.data_operacao).getTime())));
        periodoOperacao = primeiraData.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase();
      }
      
      // Agrupar participações por servidor (igual à API do supervisor)
      const servidoresPorId = participacoes.reduce((acc, participacao) => {
        const servidorData = Array.isArray(participacao.servidor) ? participacao.servidor[0] : participacao.servidor;
        const servidorId = participacao.membro_id;
        const nome = servidorData?.nome || 'Servidor';
        const matricula = servidorData?.matricula || '';
        
        if (!acc[servidorId]) {
          acc[servidorId] = {
            nome,
            matricula,
            participacoes: []
          };
        }
        
        // Encontrar dados da operação
        const operacao = operacoesPeriodo.find(op => op.id === participacao.operacao_id);
        if (operacao) {
          acc[servidorId].participacoes.push({
            data: operacao.data_operacao,
            operacao_id: operacao.id,
            estado_visual: participacao.estado_visual
          });
        }
        
        return acc;
      }, {} as Record<number, any>);
      
      // Calcular períodos consecutivos para cada servidor (igual à API do supervisor)
      const servidoresComPeriodos = Object.values(servidoresPorId).map((servidor: any) => {
        const ESTADOS_CONFIRMADOS = ['CONFIRMADO', 'ADICIONADO_SUP'];
        const ESTADOS_VALIDOS = ['CONFIRMADO', 'ADICIONADO_SUP', 'PENDENTE', 'NA_FILA'];

        // Primeiro, tentar com confirmados (mantém compatibilidade com a lógica original)
        const datasConfirmadasOrdenadas = servidor.participacoes
          .filter((p: any) => ESTADOS_CONFIRMADOS.includes(p.estado_visual))
          .map((p: any) => p.data)
          .sort()
          .map((data: string) => parseLocalDate(data));

        // Se não houver confirmados, usar qualquer participação válida (pendentes/na fila)
        const datasParaPeriodos = datasConfirmadasOrdenadas.length > 0
          ? datasConfirmadasOrdenadas
          : servidor.participacoes
              .filter((p: any) => ESTADOS_VALIDOS.includes(p.estado_visual))
              .map((p: any) => p.data)
              .sort()
              .map((data: string) => parseLocalDate(data));

        const periodos = calcularPeriodosConsecutivos(datasParaPeriodos);
        
        // Alinhar regra de contagem com o supervisor: diárias equivalentes consideram dias (inclusive)
        const totalDias = periodos.reduce((sum: number, periodo: any) => sum + periodo.dias, 0);
        const totalParticipacoes = servidor.participacoes.length;

        return {
          ...servidor,
          periodos,
          totalDias,
          totalParticipacoes
        };
      });
      
      // Agrupar servidores por períodos únicos (igual à API do supervisor)
      const periodosPorChave = new Map<string, any>();
      
      servidoresComPeriodos.forEach(servidor => {
        servidor.periodos.forEach((periodo: any) => {
          const dataInicio = periodo.inicio.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          // Ajuste de meia diária: acrescentar 1 dia ao fim para a exibição e chave
          const fimExtendido = new Date(periodo.fim.getTime());
          fimExtendido.setDate(fimExtendido.getDate() + 1);
          const dataFim = fimExtendido.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          
          // Criar chave única para o período (com fim estendido)
          const chave = `${dataInicio}-${dataFim}`;
          const chaveTempo = periodo.inicio.getTime(); // Para ordenação
          
          if (!periodosPorChave.has(chave)) {
            periodosPorChave.set(chave, {
              dataInicio,
              dataFim,
              chaveTempo,
              servidores: []
            });
          }

          // Calcular contagens por status dentro deste período para este servidor
          const ESTADOS_CONFIRMADOS = ['CONFIRMADO', 'ADICIONADO_SUP'];
          const ESTADOS_PENDENTES = ['PENDENTE', 'SOLICITADO', 'NA_FILA', 'APROVADO'];
          const participacoesNoPeriodo = servidor.participacoes.filter((p: any) => {
            const d = parseLocalDate(p.data);
            return d >= periodo.inicio && d <= periodo.fim;
          });
          const confirmadosCount = participacoesNoPeriodo.filter((p: any) => ESTADOS_CONFIRMADOS.includes(p.estado_visual)).length;
          const pendentesCount = participacoesNoPeriodo.filter((p: any) => ESTADOS_PENDENTES.includes(p.estado_visual)).length;
          
          periodosPorChave.get(chave)!.servidores.push({
            nome: servidor.nome,
            matricula: servidor.matricula,
            confirmadosCount,
            pendentesCount
          });
        });
      });
      
      // Converter para array e ordenar por data de início (igual à API do supervisor)
      const periodosOrdenados = Array.from(periodosPorChave.values())
        .sort((a, b) => a.chaveTempo - b.chaveTempo);
      
      // Ordenar servidores dentro de cada período por nome (igual à API do supervisor)
      periodosOrdenados.forEach(periodo => {
        periodo.servidores.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
      });
      
      // Gerar relatório no formato WhatsApp (igual à API do supervisor)
      let relatorio = '==================================';
      relatorio += `\n _Compartilhado pelo Sistema Radar_ \n`;
      relatorio += `           ${tituloOperacao}\n`;
      relatorio += `                ${periodoOperacao}\n`;
      relatorio += '==================================\n\n';
      
      periodosOrdenados.forEach(periodo => {
        // Formatar período
        let periodoTexto = '';
        if (periodo.dataInicio === periodo.dataFim) {
          periodoTexto = periodo.dataInicio;
        } else {
          periodoTexto = `${periodo.dataInicio} a ${periodo.dataFim}`;
        }
        
        relatorio += `DIAS: ${periodoTexto}\n`;
        
        // Listar servidores (formato original, sem sufixos/ícones de pendência)
        periodo.servidores.forEach((servidor: any, index: number) => {
          relatorio += `${index + 1}. ✓ ${servidor.nome.toUpperCase()}\n`;
          relatorio += `   Mat.: ${servidor.matricula}\n`;
        });
        
        relatorio += '\n';
      });
      
      return relatorio;

     } catch (error) {
        console.error('❌ Erro ao gerar relatório:', error);
        return `Erro ao gerar relatório para ${mesAtual}: ${(error as Error).message}`;
      }
  };
  // Função para detectar se é dispositivo móvel
  const isMobileDevice = () => {
    // Preferir User-Agent Client Hints quando disponível
    const uaData = (navigator as any).userAgentData;
    if (typeof uaData?.mobile === 'boolean') return uaData.mobile;
    // Fallback robusto para userAgent
    const ua = navigator.userAgent || (navigator as any).vendor || (window as any).opera || '';
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    return mobileRegex.test(ua);
  };
  
  // Função para compartilhar relatório no WhatsApp
  const compartilharRelatorio = async () => {
    try {
      if (!janelaSelecionada) {
        toast.error('Selecione uma janela operacional para compartilhar.');
        return;
      }
      setLoadingRelatorio(true);
      
      const texto = await gerarRelatorioMembro(janelaSelecionada);
      
      // Copiar para área de transferência (sempre tentamos copiar como apoio)
      try {
        await navigator.clipboard.writeText(texto);
      } catch (e) {
        console.warn('Não foi possível copiar para a área de transferência automaticamente.', e);
      }

      // Se disponível, usar o Web Share API (melhor experiência nos dispositivos móveis)
      if ((navigator as any).share) {
        try {
          await (navigator as any).share({ text: texto });
          toast.success('Relatório compartilhado pelo menu nativo do dispositivo!');
          return;
        } catch (e) {
          // Usuário pode cancelar o compartilhamento; seguimos para o fallback do WhatsApp
          console.warn('Compartilhamento nativo não concluído, usando fallback do WhatsApp.', e);
        }
      }
      
      // Fallback via link do WhatsApp (compatível com mobile e desktop)
      const textoEncoded = encodeURIComponent(texto);
      const whatsappUrl = isMobileDevice()
        ? `https://wa.me/?text=${textoEncoded}`
        : `https://web.whatsapp.com/send?text=${textoEncoded}`;
      
      const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
      if (!win) {
        toast('Abrimos o link do WhatsApp. Caso não tenha aberto automaticamente, cole o texto (já copiado) na conversa desejada.');
      }
      
      const mensagem = isMobileDevice() 
        ? 'Relatório copiado e WhatsApp aberto!' 
        : 'Relatório copiado e WhatsApp Web aberto!';
      toast.success(mensagem);
    } catch (error) {
      console.error('❌ Erro ao compartilhar relatório:', error);
      toast.error('Erro ao gerar relatório para compartilhamento');
    } finally {
      setLoadingRelatorio(false);
    }
  };

  // Funções para lidar com cliques nos círculos de progresso
  const handleCircleClick = useCallback((tipo: 'anterior' | 'corrente' | 'diarias') => {
    setTipoDestaque(prevTipo => prevTipo === tipo ? null : tipo);
  }, []);

  // Função para determinar se um dia deve ser destacado baseado no tipo selecionado
  const shouldHighlightDay = (day: Date): boolean => {
    if (!tipoDestaque) return false;

    const dayStr = format(day, 'yyyy-MM-dd');
    const operacoesDia = getOperacoesDia(day);
    
    // Se não há operações no dia, não destacar
    if (operacoesDia.length === 0) return false;

    const anoAtual = currentDate.getFullYear();
    const mesAtual = currentDate.getMonth(); // 0-based

    // Estados que contam para os limites (mesma lógica do useLimitesCalendario)
    const ESTADOS_INCLUIDOS = [
      'CONFIRMADO',
      'ADICIONADO_SUP',
      'PENDENTE',
      'SOLICITADO',
      'NA_FILA',
      'APROVADO'
    ];

    // Função para verificar se uma operação tem participação válida do usuário
    const temParticipacaoValida = (operacao: any): boolean => {
      if (!operacao.minha_participacao) return false;
      
      // Verificar se o estado da participação está incluído nos estados válidos
      return ESTADOS_INCLUIDOS.includes(operacao.minha_participacao.estado_visual);
    };

    if (tipoDestaque === 'anterior') {
      // Período anterior: 10 do mês anterior até 09 do mês atual
      const cicloAnteriorInicio = new Date(anoAtual, mesAtual - 1, 10);
      const cicloAnteriorFim = new Date(anoAtual, mesAtual, 9, 23, 59, 59);
      
      const inicioStr = format(cicloAnteriorInicio, 'yyyy-MM-dd');
      const fimStr = format(cicloAnteriorFim, 'yyyy-MM-dd');
      
      // Verificar se está no período E tem operações com participação válida
      const isInPeriod = dayStr >= inicioStr && dayStr <= fimStr;
      const hasValidParticipation = operacoesDia.some(op => temParticipacaoValida(op));
      
      return isInPeriod && hasValidParticipation;
    }

    if (tipoDestaque === 'corrente') {
      // Período corrente: 10 do mês atual até 09 do próximo mês
      const cicloCorrenteInicio = new Date(anoAtual, mesAtual, 10);
      const cicloCorrenteFim = new Date(anoAtual, mesAtual + 1, 9, 23, 59, 59);
      
      const inicioStr = format(cicloCorrenteInicio, 'yyyy-MM-dd');
      const fimStr = format(cicloCorrenteFim, 'yyyy-MM-dd');
      
      // Verificar se está no período E tem operações com participação válida
      const isInPeriod = dayStr >= inicioStr && dayStr <= fimStr;
      const hasValidParticipation = operacoesDia.some(op => temParticipacaoValida(op));
      
      return isInPeriod && hasValidParticipation;
    }

    if (tipoDestaque === 'diarias') {
      // Diárias do mês: apenas operações PLANEJADA no mês civil atual com participação válida
      const mesCivilInicio = startOfMonth(currentDate);
      const mesCivilFim = endOfMonth(currentDate);
      
      const inicioStr = format(mesCivilInicio, 'yyyy-MM-dd');
      const fimStr = format(mesCivilFim, 'yyyy-MM-dd');
      
      // Verificar se está no mês civil E tem operações PLANEJADA com participação válida
      const isInMonth = dayStr >= inicioStr && dayStr <= fimStr;
      const hasValidPlannedOps = operacoesDia.some(op => 
        op.tipo === 'PLANEJADA' && temParticipacaoValida(op)
      );
      
      return isInMonth && hasValidPlannedOps;
    }

    return false;
  };

  // Fetch das operações
  const fetchOperacoes = useCallback(async () => {

    // Expandir período para incluir dias visíveis de meses adjacentes
    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));
    const membroId = membroAtual;



    try {
      const paramsFull = new URLSearchParams({
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        membroId,
        portal: 'membro',
        includeParticipantes: 'true',
        includeInactive: 'true',
        fields: 'full',
        _t: Date.now().toString(),
        _realtime: 'true'
      });
      const keyFull = `/api/unified/operacoes?${paramsFull}`;

      const respFull = await fetch(keyFull, { cache: 'no-store' });
      const jsonFull = await respFull.json();
      if (jsonFull?.success && Array.isArray(jsonFull.data)) {
        const ops = jsonFull.data as Operacao[];
        setOperacoes(ops);
        const map: Record<string, Operacao[]> = {};
        ops.forEach((op: any) => {
          const d = (op.data_operacao || op.dataOperacao).substring(0, 10);
          if (!map[d]) map[d] = [];
          map[d].push(op);
        });
        setOperacoesPorDia(map);
      }
    } catch (error) {
      console.error('[CalendarioSimples] ❌ Erro no fetch:', error);
      setOperacoes([]);
      if (process.env.NODE_ENV === 'development') {
        toast.error('Erro ao carregar operações: ' + (error as Error).message);
      }
    } finally {
    }
  }, [currentDate, membroAtual]);

  // Carregar operações quando mudar mês ou membro
  useEffect(() => {
    fetchOperacoesRef.current();
  }, [currentDate, membroAtual]);

  // Ref para manter uma referência estável da função de recarregamento
  const fetchOperacoesRef = useRef(fetchOperacoes);
  fetchOperacoesRef.current = fetchOperacoes;

  // Callback estável para recarregamento
  const lastManualReloadRef = useRef(0);
  const reloadOperacoes = useCallback(() => {
    lastManualReloadRef.current = Date.now();
    fetchOperacoesRef.current();
  }, []);

  // Função de reload para compatibilidade
  const reloadDados = useCallback(() => {
    reloadOperacoes();
  }, [reloadOperacoes]);

  // 🚀 REALTIME SIMPLES E DIRETO: Mudou no banco = atualiza na tela
  useRealtime({
    channelId: 'calendario-simples-global',
    tables: ['operacao', 'participacao'],
    onDatabaseChange: useCallback((event: any) => {
      const { table, eventType } = event;
      const now = Date.now();
      // Evitar reload duplicado quando já fizemos um reload manual há poucos ms
      if (now - lastManualReloadRef.current < 800) {
        return;
      }
      reloadOperacoes();
    }, [reloadOperacoes])
  });

  // Tratamento de teclado para fechar modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedDate) {
        setSelectedDate(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedDate]);

  // Inicializar membro atual pela autenticação
  useEffect(() => {
    const membroAuth = localStorage.getItem('membroAuth');

    if (!membroAuth) {
      console.error('[CalendarioSimples] ❌ Sem autenticação');
      return;
    }

    try {
      const userData = JSON.parse(membroAuth);

      if (!userData.id || !userData.autenticado) {
        console.error('[CalendarioSimples] ❌ Dados de autenticação inválidos');
        return;
      }

      const novoMembroId = userData.id.toString();
      setMembroAtual(novoMembroId);
      localStorage.setItem('membroId', novoMembroId);
    } catch (error) {
      console.error('[CalendarioSimples] ❌ Erro ao processar autenticação:', error);
    }
  }, []);

  // Navegação do calendário
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentDate(now);
  };

  const swipeRef = useRef<HTMLDivElement | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeStartRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    if (Math.abs(dx) <= Math.abs(dy)) {
      setSwipeOffset(0);
      return;
    }
    e.preventDefault();
    const limited = Math.max(Math.min(dx, 60), -60);
    setSwipeOffset(limited);
  };
  const handleTouchEnd = () => {
    if (!swipeStartRef.current) {
      setSwipeOffset(0);
      return;
    }
    const dx = swipeOffset;
    const threshold = 40;
    if (Math.abs(dx) >= threshold) {
      if (dx > 0) navigateMonth('prev'); else navigateMonth('next');
    }
    setSwipeOffset(0);
    swipeStartRef.current = null;
  };

  // Função para alternar tema
  const toggleTheme = () => {
    const newTheme = !isDarkTheme;
    setIsDarkTheme(newTheme);
    localStorage.setItem('calendar-theme', newTheme ? 'dark' : 'light');
  };

  // Função para lidar com clique no dia (abre modal)
  const handleDayClick = (dia: Date) => {
    setSelectedDate(dia);
  };

  // Funções auxiliares para gerenciar loading de múltiplos botões
  const setButtonLoading = (operacaoId: number, isLoading: boolean) => {
    setLoadingButtons(prev => {
      const newSet = new Set(prev);
      if (isLoading) {
        newSet.add(operacaoId);
      } else {
        newSet.delete(operacaoId);
      }
      return newSet;
    });
  };

  const isButtonLoading = (operacaoId: number) => {
    return loadingButtons.has(operacaoId);
  };

  // Ações rápidas
  const handleQuickAction = async (operacaoId: number, action: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (isButtonLoading(operacaoId)) return;

    // Verificar se a operação está inativa
    const operacao = operacoes.find(op => op.id === operacaoId);
    if (operacao?.inativa_pelo_supervisor) {
      toast.error('Esta operação está arquivada e não aceita mais solicitações');
      return;
    }

    // Não permitir ações em operações históricas
    if (action === 'historico') {
      return;
    }

    setButtonLoading(operacaoId, true);

    try {
      if (action === 'participar') {
        await handleEuVou(operacaoId);
      } else if (action === 'cancelar') {
        await handleCancelar(operacaoId);
      }
    } catch (error) {
      console.error('Erro na ação rápida:', error);
      toast.error('Erro ao processar solicitação');
    } finally {
      setButtonLoading(operacaoId, false);
    }
  };

  const handleEuVou = async (operacaoId: number) => {
    // Verificar se a operação está inativa
    const operacao = operacoes.find(op => op.id === operacaoId);
    if (operacao?.inativa_pelo_supervisor) {
      toast.error('Esta operação está arquivada e não aceita mais solicitações');
      return;
    }

    try {
      const response = await fetch('/api/participations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          operationId: operacaoId.toString(),
          membroId: membroAtual
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação confirmada!');
        reloadOperacoes();
      } else {
        toast.error(data.error || 'Erro ao confirmar participação');
      }
    } catch (error) {
      console.error('Erro ao confirmar participação:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

  const handleCancelar = async (operacaoId: number) => {
    // Verificar se a operação está inativa
    const operacao = operacoes.find(op => op.id === operacaoId);
    if (operacao?.inativa_pelo_supervisor) {
      toast.error('Esta operação está arquivada e não aceita mais solicitações');
      return;
    }

    try {
      const response = await fetch('/api/agendamento/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operacaoId, membroId: membroAtual })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Participação cancelada!');
        reloadOperacoes();
      } else {
        toast.error(data.error || 'Erro ao cancelar participação');
      }
    } catch (error) {
      console.error('Erro ao cancelar participação:', error);
      toast.error('Erro ao processar solicitação');
    }
  };

  // Gerar dias do calendário
  const generateCalendarDays = () => {
    const startDate = startOfWeek(startOfMonth(currentDate));
    const endDate = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  // Obter operações de um dia específico
  const getOperacoesDia = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    

    
    const operacoesDia = operacoes.filter(op => {
      const opDate = op.data_operacao.substring(0, 10); // ✅ CORREÇÃO TIMEZONE
      return opDate === dateStr;
    });



    return operacoesDia;
  };

  // Função para obter estado visual (mesma lógica do OperacaoDialog)
  const getEstadoVisualInfo = (operacao: Operacao) => {
    // Verificar se a operação está inativa
    if (operacao.inativa_pelo_supervisor) {
      return {
        buttonText: '📁 Arquivo',
        buttonClass: 'historico',
        buttonAction: 'historico',
        isInactive: true
      };
    }

    const estado = operacao.minha_participacao?.estado_visual;

    if (estado === 'CONFIRMADO' || estado === 'ADICIONADO_SUP') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar',
        isInactive: false
      };
    }

    if (estado === 'PENDENTE') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar',
        isInactive: false
      };
    }

    if (estado === 'NA_FILA') {
      return {
        buttonText: 'CANCELAR',
        buttonClass: 'cancel',
        buttonAction: 'cancelar',
        isInactive: false
      };
    }

    // Se não tem participação, calcular disponibilidade
    const confirmados = operacao.participantes_confirmados || 0;
    const totalSolicitacoes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0;
    const limite = operacao.limite_participantes;

    const totalOcupado = confirmados + totalSolicitacoes;
    const limiteTotal = limite * 2; // Vagas + fila (mesmo tamanho)

    if (totalOcupado < limiteTotal) {
      if (confirmados < limite) {
        return {
          buttonText: 'EU VOU',
          buttonClass: 'participate',
          buttonAction: 'participar',
          isInactive: false
        };
      } else {
        return {
          buttonText: 'ENTRAR NA FILA',
          buttonClass: 'queue',
          buttonAction: 'participar',
          isInactive: false
        };
      }
    } else {
      return {
        buttonText: 'LOTADO',
        buttonClass: 'full',
        buttonAction: 'lotado',
        isInactive: false
      };
    }
  };

  // Formatação compacta de horário (ex.: 13hs ou 08h30)
  function formatHorario(h?: string) {
    if (!h) return '';
    const match = h.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return h; // Caso venha em formato inesperado
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    const ss = match[3] || '00';
    if (mm === '00' && ss === '00') return `${hh}hs`;
    return `${hh}h${mm}`;
  }

  // Renderizar operação única
  const renderSingleOperation = (operacao: Operacao) => {

    const confirmados = operacao.participantes_confirmados || 0;
    const limite = operacao.limite_participantes;
    const pendentes = operacao.total_solicitacoes || operacao.pessoas_na_fila || 0;

    const estadoInfo = getEstadoVisualInfo(operacao);
    const isInativa = operacao.inativa_pelo_supervisor;

    // Debug removido para performance

    const estadosValidos = new Set(['CONFIRMADO', 'ADICIONADO_SUP']);
    const isHighlighted = !!servidorDestacadoId && (operacao.participacoes || []).some(p => p.servidor_id === servidorDestacadoId && estadosValidos.has(p.estado_visual));
    return (
      <div className={`${styles.singleOperationInfo} ${styles.responsive} ${isInativa ? styles.operacaoInativa : ''} ${isInativa && operacao.tem_fotos ? styles.comFotos : ''} ${isHighlighted ? styles.opHighlightGold : ''}`}>
        <div className={`${styles.operationHeader} ${styles[operacao.modalidade.toLowerCase()]}`}>
          <div className={`${styles.modalidadeName} ${styles[operacao.modalidade.toLowerCase()]}`}>
            {operacao.modalidade === 'BLITZ' ? 'RADAR' : operacao.modalidade}
          </div>
          {/* Ícone piscante movido para área do relógio; removido aqui */}
          <div className={styles.participantStats}>
            {isInativa ? (
              // Badge de pessoas para operações arquivadas
              <div className={styles.peopleBadge}>
                 <svg className={styles.peopleBadgeIcon} viewBox="0 0 24 24" aria-hidden="true">
                   <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.93 1.97 3.45V19c0 .35-.06.68-.17 1H23a1 1 0 0 0 1-1v-2.5c0-2.33-4.67-3.5-8-3.5z"></path>
                 </svg>
                 <span className={styles.peopleBadgeCount}>{confirmados}</span>
               </div>
            ) : (
              // Formato tradicional para operações ativas
              <>
                {confirmados}/{limite}
                {pendentes > 0 && (
                  <span className={styles.queueIndicator}>+{pendentes}</span>
                )}
              </>
            )}
          </div>
        </div>

        {!isInativa ? (
          <button
            className={`${styles.quickActionButton} ${styles[estadoInfo.buttonClass]} ${styles.responsive}`}
            onClick={(e) => handleQuickAction(operacao.id, estadoInfo.buttonAction, e)}
            disabled={isButtonLoading(operacao.id) || estadoInfo.buttonAction === 'lotado'}
          >
            {isButtonLoading(operacao.id) ? (
              <span className={styles.spinning}>
                <Loader2 size={16} />
              </span>
            ) : (
              estadoInfo.buttonText
            )}
          </button>
        ) : null}
      </div>
    );
  };

  // Renderizar múltiplas operações - VERSÃO OTIMIZADA PARA LEGIBILIDADE
  const renderMultipleOperations = (operacoes: Operacao[]) => {
    const maxShow = 2;
    const remaining = operacoes.length - maxShow;

    // ✅ Verificar se todas as operações são inativas e se alguma tem fotos
    const todasInativas = operacoes.every(op => op.inativa_pelo_supervisor);
    const algumTemFotos = operacoes.some(op => op.inativa_pelo_supervisor && op.tem_fotos);
    const todasTemFotos = operacoes.length === 2 && operacoes.every(op => op.inativa_pelo_supervisor && op.tem_fotos);
    
    let classeFotos = '';
    if (todasInativas && todasTemFotos) {
      classeFotos = `${styles.comFotos} ${styles.ambasComFotos}`;
    } else if (todasInativas && algumTemFotos) {
      classeFotos = styles.comFotos;
    }

    return (
      <div className={`${styles.multipleOperations} ${classeFotos}`}>
        {operacoes.slice(0, maxShow).map((op, idx) => {
          const confirmados = op.participantes_confirmados || 0;
          const limite = op.limite_participantes;
          const pendentes = op.total_solicitacoes || op.pessoas_na_fila || 0;
          const isInativa = op.inativa_pelo_supervisor;
          
          // Informação compacta mas clara
          const modalidadeAbrev = op.modalidade === 'BLITZ' ? 'RDR' : 'BAL';
          const infoParticipantes = `${confirmados}/${limite}`;
          const infoFila = pendentes > 0 ? `+${pendentes}` : '';
          
          const estadosValidos = new Set(['CONFIRMADO', 'ADICIONADO_SUP']);
          const isHighlighted = !!servidorDestacadoId && (op.participacoes || []).some(p => p.servidor_id === servidorDestacadoId && estadosValidos.has(p.estado_visual));
          return (
            <div key={idx} className={`${styles.operationItem} ${styles[op.modalidade.toLowerCase()]} ${isInativa ? styles.operacaoInativa : ''} ${isHighlighted ? styles.operationItemHighlighted : ''}`}>
              <span className={styles.modalidadeCompact}>
                {modalidadeAbrev}
              </span>
              {/* Ícone piscante movido para área do relógio; removido aqui */}
              {isInativa ? (
                <div className={styles.participantesCompactBadge}>
                  <span className={styles.participantesCompactCount}>
                    {confirmados}
                  </span>
                  <svg className={styles.participantesCompactIcon} viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M16 11c1.66 0 3-1.57 3-3.5S17.66 4 16 4s-3 1.57-3 3.5S14.34 11 16 11zM8 11c1.66 0 3-1.57 3-3.5S9.66 4 8 4 5 5.57 5 7.5 6.34 11 8 11zm0 2c-2.33 0-7 1.17-7 3.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5C15 14.17 10.33 13 8 13zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.93 1.97 3.45V19c0 .35-.06.68-.17 1H23a1 1 0 0 0 1-1v-2.5c0-2.33-4.67-3.5-8-3.5z"></path>
                  </svg>
                </div>
              ) : (
                <span className={styles.participantesCompact}>
                  {infoParticipantes}
                  {infoFila && <span className={styles.filaCompact}>{infoFila}</span>}
                </span>
              )}
            </div>
          );
        })}
        {remaining > 0 && (
          <div className={styles.moreOperations}>
            +{remaining} op{remaining > 1 ? 's' : ''}
          </div>
        )}
      </div>
    );
  };

  const calendarDays = generateCalendarDays();

  return (
    <div className={`${styles.calendarContainer} ${isDarkTheme ? styles.darkTheme : ''}`}>
      {/* NOVO: Barra superior com seletor de janela e botão de compartilhar (independente do mês visualizado) */}
      <div className={styles.rightButtons} style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <img src="/icons/janela.png" alt="Janela Operacional" style={{ width: 'clamp(16px, 3.2vw, 24px)', height: 'clamp(16px, 3.2vw, 24px)', objectFit: 'contain' }} />
        <select
          value={janelaSelecionada || ''}
          onChange={(e) => setJanelaSelecionada(e.target.value ? Number(e.target.value) : null)}
          aria-label="Janela Operacional"
        >
          <option value="">Janela Operacional</option>
          {janelasDisponiveis.map((j) => {
            // Evitar deslocamento de fuso ao interpretar 'YYYY-MM-DD' (tratar como data local)
            const di = new Date(`${j.dataInicio}T12:00:00`);
            const df = new Date(`${j.dataFim}T12:00:00`);
            const periodo = `${di.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${df.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`;
            return (
              <option key={j.id} value={j.id}>
                Janela #{j.id}: {periodo}
              </option>
            );
          })}
        </select>
        <button 
          className={styles.whatsappButton}
          onClick={compartilharRelatorio}
          disabled={loadingRelatorio || !janelaSelecionada}
          title="Compartilhar relatório no WhatsApp"
        >
          {loadingRelatorio ? (
            <div className={styles.loadingSpinner}></div>
          ) : (
            <MessageCircle size={16} />
          )}
        </button>
      </div>

      {/* Header com Navegação Integrada */}
      <div className={styles.calendarHeader}>
        <button
          className={styles.navButton}
          onClick={() => navigateMonth('prev')}
          aria-label="Mês anterior"
        >
          <ChevronLeft size={24} />
        </button>

        <div className={styles.monthYear}>
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </div>

        <button
          className={styles.navButton}
          onClick={() => navigateMonth('next')}
          aria-label="Próximo mês"
        >
          <ChevronRight size={24} />
        </button>

        <div className={styles.rightButtons}>
          {/* Botão de compartilhar foi movido para a barra superior */}
          <button className={styles.todayButton} onClick={goToToday}>
            <Calendar size={16} />
            <span>Hoje</span>
          </button>
        </div>
      </div>

      {/* Barras de Limites Informativos */}
      <LimitesBarras 
        membroId={membroAtual}
        currentDate={currentDate}
        compact={false}
        debug={true}
        onCircleClick={handleCircleClick}
      />

      {/* Dias da Semana */}
      <div className={styles.weekdays}>
        <div>DOM</div>
        <div>SEG</div>
        <div>TER</div>
        <div>QUA</div>
        <div>QUI</div>
        <div>SEX</div>
        <div>SÁB</div>
      </div>

      {/* Grid do Calendário */}
      <div
        className={styles.calendarGrid}
        ref={swipeRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined, transition: swipeOffset === 0 ? 'transform 160ms ease' : 'none' }}
      >
        {calendarDays.map((day, index) => {
          const operacoesDia = getOperacoesDia(day);
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const hasUniqueOperation = operacoesDia.length === 1;
          const shouldHighlight = shouldHighlightDay(day);

          const estadosValidos = new Set(['CONFIRMADO', 'ADICIONADO_SUP']);
          const dayHighlightedByServidor = !!servidorDestacadoId && operacoesDia.some(op => (op.participacoes || []).some(p => p.servidor_id === servidorDestacadoId && estadosValidos.has(p.estado_visual)));
          return (
            <div
              key={index}
              className={`
                ${styles.dayCell}
                ${!isCurrentMonth ? styles.otherMonth : ''}
                ${isCurrentDay ? styles.currentDay : ''}
                ${shouldHighlight ? styles.highlightedDay : ''}
                ${dayHighlightedByServidor ? styles.dayHighlightGold : ''}
                ${shouldHighlight && dayHighlightedByServidor ? styles.conflictHighlight : ''}
              `}
              onClick={() => handleDayClick(day)}
            >
              <div className={styles.dayNumber}>
                {format(day, 'd')}
              </div>
              {(() => {
                const hasCoord = !!servidorDestacadoId && operacoesDia.some(op => (op.coordenadores_ids || []).includes(servidorDestacadoId));
                return hasCoord ? (
                  <img src="/icons/coordenador.png" className={styles.coordenadorDayBadgeInline} alt="" />
                ) : null;
              })()}

              {hasUniqueOperation && operacoesDia[0]?.horario && (
                <span className={styles.dayTimeBadge}>
                  {formatHorario(operacoesDia[0].horario)}
                </span>
              )}
              {(() => {
                const hasCoord = !!servidorDestacadoId && operacoesDia.some(op => (op.coordenadores_ids || []).includes(servidorDestacadoId));
                return hasCoord && hasUniqueOperation && operacoesDia[0]?.horario ? (
                  <img src="/icons/coordenador.png" className={styles.coordenadorTimeBadgeInline} alt="" />
                ) : null;
              })()}

              {operacoesDia.length > 0 && (
                <div className={styles.operacaoInfo}>
                  {hasUniqueOperation
                    ? renderSingleOperation(operacoesDia[0])
                    : renderMultipleOperations(operacoesDia)
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Operações */}
      {selectedDate && (
        <OperacaoDialog
          date={selectedDate}
          operacoes={operacoesPorDia[format(selectedDate, 'yyyy-MM-dd')] || []}
          onClose={() => setSelectedDate(null)}
          onOperacaoUpdate={reloadDados}
        />
      )}
    </div>
  );
};

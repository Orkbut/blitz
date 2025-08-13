/**
 * Constantes utilizadas no módulo GerenciarMembrosModal
 */

export const constants = {
  // Breakpoints para responsividade
  BREAKPOINTS: {
    MOBILE_MAX: 767,
    TABLET_MIN: 768,
    TABLET_MAX: 1023,
    DESKTOP_MIN: 1024,
  },

  // Configurações de performance
  PERFORMANCE: {
    MODAL_LOAD_TIMEOUT: 500, // ms
    SEARCH_DEBOUNCE: 300, // ms
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutos
  },

  // Estados visuais de participação
  PARTICIPATION_STATES: {
    CONFIRMADO: 'CONFIRMADO',
    ADICIONADO_SUP: 'ADICIONADO_SUP',
    PENDENTE: 'PENDENTE',
    NA_FILA: 'NA_FILA',
  },

  // Prioridades de ordenação
  PRIORITY_GROUPS: {
    CONFIRMADO: 1,
    AGUARDANDO: 2,
    DISPONIVEL: 3,
  },

  // Configurações de UI
  UI: {
    MIN_TOUCH_TARGET: 44, // px
    MODAL_Z_INDEX: 1000,
    SKELETON_ITEMS: 5,
  },

  // Mensagens padrão
  MESSAGES: {
    LOADING: 'Carregando informações...',
    NO_MEMBERS: 'Nenhum membro encontrado',
    NO_OPERATIONS: 'Nenhuma operação disponível',
    CONNECTION_ERROR: 'Erro de conexão com o servidor',
  },
} as const;
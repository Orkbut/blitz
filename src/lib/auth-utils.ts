/**
 * Utilitários para autenticação e contexto do supervisor
 */

export interface SupervisorData {
  id: number;
  matricula: string;
  nome: string;
  email?: string;
  regionalId: number;
  regional: {
    id: number;
    nome: string;
    codigo?: string;
  };
  perfil: string;
  autenticado: boolean;
  dataLogin: string;
}

/**
 * Obtém os dados do supervisor logado do localStorage
 */
export function getSupervisorData(): SupervisorData | null {
  try {
    const supervisorAuth = localStorage.getItem('supervisorAuth');
    if (!supervisorAuth) {
      return null;
    }
    
    const userData = JSON.parse(supervisorAuth);
    
    // Validar se tem os campos obrigatórios
    if (!userData.id || !userData.regionalId || userData.perfil !== 'Supervisor') {
      return null;
    }
    
    return userData;
  } catch (error) {
    return null;
  }
}

/**
 * Obtém apenas o ID do supervisor logado
 */
export function getSupervisorId(): number | null {
  const supervisorData = getSupervisorData();
  return supervisorData?.id || null;
}

/**
 * Obtém apenas o ID da regional do supervisor logado
 */
export function getSupervisorRegionalId(): number | null {
  const supervisorData = getSupervisorData();
  return supervisorData?.regionalId || null;
}

/**
 * Verifica se o supervisor está autenticado
 */
export function isSupervisorAuthenticated(): boolean {
  const supervisorData = getSupervisorData();
  return supervisorData?.autenticado === true;
}

/**
 * Cria headers com contexto do supervisor para requisições
 */
export function getSupervisorHeaders(): HeadersInit {
  const supervisorData = getSupervisorData();
  
  if (!supervisorData) {
    return {};
  }
  
  return {
    'X-Supervisor-Id': supervisorData.id.toString(),
    'X-Regional-Id': supervisorData.regionalId.toString(),
    'X-Supervisor-Context': 'true'
  };
}

/**
 * Cria payload com contexto do supervisor para requisições POST/PUT
 */
export function getSupervisorContext() {
  const supervisorData = getSupervisorData();
  
  if (!supervisorData) {
    return {
      supervisorId: null,
      regionalId: null
    };
  }
  
  return {
    supervisorId: supervisorData.id,
    regionalId: supervisorData.regionalId
  };
}

/**
 * ✅ FORMATAÇÃO DE DATAS CENTRALIZADAS
 * Timezone: America/Fortaleza (Iguatu-CE, Brasil)
 * Garante consistência em todo o projeto
 */

/**
 * Formatar data no padrão brasileiro (dd/MM/yyyy) com timezone correto
 * CORRIGIDO: Trata datas sem horário (YYYY-MM-DD) para evitar problemas de timezone
 */
export const formatarDataBR = (dataISO: string): string => {
  if (!dataISO) return '';
  try {
    // Se a data vem apenas como YYYY-MM-DD (sem horário), adicionar horário local
    // para evitar que seja interpretada como UTC e cause mudança de dia
    let dataParaProcessar = dataISO;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
      // Adiciona horário meio-dia para evitar problemas de timezone
      dataParaProcessar = `${dataISO}T12:00:00`;
    }
    
    const data = new Date(dataParaProcessar);
    return data.toLocaleDateString('pt-BR', {
      timeZone: 'America/Fortaleza',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (error) {
    return dataISO;
  }
};

/**
 * Formatar data e hora completa com timezone correto
 */
export const formatarDataHoraCompleta = (dataISO: string): string => {
  if (!dataISO) return '';
  try {
    const data = new Date(dataISO);
    return data.toLocaleString('pt-BR', {
      timeZone: 'America/Fortaleza',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return dataISO;
  }
};

/**
 * Obter data atual no timezone de Iguatu-CE
 */
export const obterDataAtualIguatu = (): Date => {
  const agora = new Date();
  // Converter para timezone de Fortaleza (mesmo de Iguatu)
  const dataLocal = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Fortaleza' }));
  return dataLocal;
}; 

/**
 * Formatar período de janela operacional
 */
export const formatarPeriodoJanela = (dataInicio: string, dataFim: string): string => {
  try {
    return `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`;
  } catch (error) {
    return `${dataInicio} - ${dataFim}`;
  }
};
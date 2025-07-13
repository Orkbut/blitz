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
    console.error('Erro ao obter dados do supervisor:', error);
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
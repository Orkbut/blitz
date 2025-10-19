import { Servidor } from '../../../domain/entities/Servidor';

export interface IServidorRepository {
  // Buscar servidores
  buscarPorId(id: number): Promise<Servidor | null>;
  buscarPorEmail(email: string): Promise<Servidor | null>;
  buscarPorMatricula(matricula: string): Promise<Servidor | null>;
  buscarPorRegional(regionalId: number): Promise<Servidor[]>;
  buscarAtivos(): Promise<Servidor[]>;
  buscarPorPerfil(perfil: 'Membro' | 'Supervisor' | 'Administrador'): Promise<Servidor[]>;
  
  // Operações CRUD
  salvar(servidor: Servidor): Promise<Servidor>;
  atualizar(servidor: Servidor): Promise<void>;
  deletar(id: number): Promise<void>;
  
  // Consultas específicas do domínio
  contarMembrosPorRegional(regionalId: number): Promise<number>;
  verificarDisponibilidade(membroId: number, dataOperacao: Date): Promise<boolean>;
  buscarMembrosDisponiveis(
    regionalId: number, 
    dataOperacao: Date
  ): Promise<Servidor[]>;
  
  // Validações de negócio
  verificarLimiteCicloFuncional(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<boolean>;
  
  verificarLimiteMensal(
    membroId: number, 
    mes: number, 
    ano: number
  ): Promise<boolean>;
  
  // Relatórios
  obterEstatisticasParticipacao(
    membroId: number, 
    mes: number, 
    ano: number
  ): Promise<{
    totalParticipacoes: number;
    totalDiarias: number;
    valorTotal: number;
  }>;
} 
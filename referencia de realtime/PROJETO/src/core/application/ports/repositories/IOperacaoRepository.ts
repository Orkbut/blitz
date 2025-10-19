import { Operacao } from '../../../domain/entities/Operacao';

export interface IOperacaoRepository {
  // Buscar operações
  buscarPorId(id: number): Promise<Operacao | null>;
  buscarPorRegional(regionalId: number): Promise<Operacao[]>;
  buscarPorData(dataOperacao: Date): Promise<Operacao[]>;
  buscarPorPeriodo(dataInicio: Date, dataFim: Date): Promise<Operacao[]>;
  buscarAtivas(): Promise<Operacao[]>;
  
  // Operações CRUD
  salvar(operacao: Operacao): Promise<Operacao>;
  atualizar(operacao: Operacao): Promise<void>;
  deletar(id: number): Promise<void>;
  
  // Consultas específicas do domínio
  contarParticipacoes(operacaoId: number): Promise<number>;
  verificarVagasDisponiveis(operacaoId: number): Promise<boolean>;
  buscarOperacoesDisponiveisParaMembro(
    membroId: number, 
    dataInicio: Date, 
    dataFim: Date
  ): Promise<Operacao[]>;
  
  // Relatórios e estatísticas
  obterEstatisticasPorRegional(
    regionalId: number, 
    mes: number, 
    ano: number
  ): Promise<{
    totalOperacoes: number;
    totalParticipacoes: number;
    taxaOcupacao: number;
  }>;
} 
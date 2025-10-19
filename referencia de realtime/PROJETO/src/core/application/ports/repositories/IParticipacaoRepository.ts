import { Participacao } from '../../../infrastructure/database/supabase';

export interface IParticipacaoRepository {
  // Buscar participações por membro
  buscarPorMembro(membroId: number): Promise<Participacao[]>;
  
  // Buscar participações por operação
  buscarPorOperacao(operacaoId: number): Promise<Participacao[]>;
  
  // Verificar se membro já participa da operação
  existeParticipacao(membroId: number, operacaoId: number): Promise<boolean>;
  
  // Salvar nova participação
  salvar(participacao: Omit<Participacao, 'id'>): Promise<Participacao>;
  
  // Atualizar participação existente
  atualizar(id: number, dados: Partial<Participacao>): Promise<void>;
  
  // Buscar participação específica
  buscarPorId(id: number): Promise<Participacao | null>;
  
  // Contar participações por membro em período
  contarParticipacoesPorPeriodo(membroId: number, dataInicio: Date, dataFim: Date): Promise<number>;
  
  // Verificar ciclo funcional do membro
  verificarCicloFuncional(membroId: number, dataOperacao: Date): Promise<boolean>;
} 
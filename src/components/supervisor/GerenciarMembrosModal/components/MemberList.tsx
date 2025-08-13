/**
 * Componente MemberList
 * 
 * Componente memoizado que renderiza a lista de membros
 * com renderização otimizada e estados de loading/empty.
 */

import React, { memo, useMemo } from 'react';
import { Users } from 'lucide-react';
import { MembroCard } from './MembroCard';
import { LoadingStates } from './LoadingStates';
import type { Membro } from '../types';
import styles from '../GerenciarMembrosModal.module.css';
import { constants } from '../utils/constants';

interface MemberListProps {
  members: Membro[];
  searchTerm: string;
  operacaoSelecionada: any;
  loading: boolean;
  isMobile: boolean;
  getStatusParticipacao: (participacao: any) => any;
  onAdicionarMembro: (membroId: number) => void;
  onAprovarSolicitacao: (participacaoId: number) => void;
  onRejeitarSolicitacao: (participacaoId: number) => void;
  onRemoverMembro: (participacaoId: number) => void;
}

export const MemberList = memo<MemberListProps>(({
  members,
  searchTerm,
  operacaoSelecionada,
  loading,
  isMobile,
  getStatusParticipacao,
  onAdicionarMembro,
  onAprovarSolicitacao,
  onRejeitarSolicitacao,
  onRemoverMembro
}) => {
  // ✅ MEMOIZAÇÃO: Lista filtrada de membros
  const filteredMembers = useMemo(() => {
    if (!members.length) return [];

    // Filtrar por termo de busca + ocultar administrador principal
    let filtered = members;
    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase().trim();
      filtered = members.filter(m => 
        // 🚫 OCULTAR ADMINISTRADOR PRINCIPAL: Filtrar por matrícula 'unmistk'
        m.matricula !== 'unmistk' &&
        (m.nome.toLowerCase().includes(termo) || 
        m.matricula.includes(termo))
      );
    } else {
      // 🚫 OCULTAR ADMINISTRADOR PRINCIPAL: Mesmo sem busca, filtrar 'unmistk'
      filtered = members.filter(m => m.matricula !== 'unmistk');
    }

    // Ordenação inteligente se há operação selecionada
    if (operacaoSelecionada?.participantes) {
      const participacaoMap = new Map();
      operacaoSelecionada.participantes.forEach((p: any) => 
        participacaoMap.set(p.membro_id, p)
      );

      const obterPrioridadeGrupo = (participacao: any) => {
        if (!participacao) return constants.PRIORITY_GROUPS.DISPONIVEL;
        
        switch (participacao.estado_visual) {
          case constants.PARTICIPATION_STATES.CONFIRMADO:
          case constants.PARTICIPATION_STATES.ADICIONADO_SUP:
            return constants.PRIORITY_GROUPS.CONFIRMADO;
          case constants.PARTICIPATION_STATES.NA_FILA:
          case constants.PARTICIPATION_STATES.PENDENTE:
            return constants.PRIORITY_GROUPS.AGUARDANDO;
          default: 
            return constants.PRIORITY_GROUPS.DISPONIVEL;
        }
      };

      return [...filtered].sort((membroA, membroB) => {
        const participacaoA = participacaoMap.get(membroA.id);
        const participacaoB = participacaoMap.get(membroB.id);

        const prioridadeA = obterPrioridadeGrupo(participacaoA);
        const prioridadeB = obterPrioridadeGrupo(participacaoB);

        // 1º: Ordenar por grupo (prioridade)
        if (prioridadeA !== prioridadeB) {
          return prioridadeA - prioridadeB;
        }

        // 2º: Dentro do mesmo grupo, ordenar cronologicamente
        if (participacaoA && participacaoB) {
          const dataA = new Date(participacaoA.data_participacao || 0).getTime();
          const dataB = new Date(participacaoB.data_participacao || 0).getTime();
          if (dataA !== dataB) return dataA - dataB;
        }

        // 3º: Fallback alfabético
        return membroA.nome.localeCompare(membroB.nome);
      });
    }

    // Sem operação: ordem alfabética
    return [...filtered].sort((a, b) => a.nome.localeCompare(b.nome));
  }, [members, searchTerm, operacaoSelecionada]);

  // ✅ RENDERIZAÇÃO OTIMIZADA: Callback memoizado para cada membro
  const renderMember = useMemo(() => {
    return filteredMembers.map(membro => {
      const participacao = operacaoSelecionada?.participantes?.find(
        (p: any) => p.membro_id === membro.id
      );
      const statusInfo = getStatusParticipacao(participacao);

      return (
        <MembroCard
          key={membro.id}
          membro={membro}
          participacao={participacao}
          statusInfo={statusInfo}
          loading={loading}
          onAdicionarMembro={onAdicionarMembro}
          onAprovarSolicitacao={onAprovarSolicitacao}
          onRejeitarSolicitacao={onRejeitarSolicitacao}
          onRemoverMembro={onRemoverMembro}
        />
      );
    });
  }, [
    filteredMembers,
    operacaoSelecionada,
    loading,
    getStatusParticipacao,
    onAdicionarMembro,
    onAprovarSolicitacao,
    onRejeitarSolicitacao,
    onRemoverMembro
  ]);

  // ✅ ESTADOS DE LOADING E EMPTY
  if (loading) {
    return <LoadingStates.MemberList />;
  }

  if (filteredMembers.length === 0) {
    const message = searchTerm.trim() 
      ? `Nenhum membro encontrado para "${searchTerm}"`
      : constants.MESSAGES.NO_MEMBERS;
    
    return (
      <div className={styles.semResultados}>
        <Users size={48} />
        <p>{message}</p>
        {searchTerm.trim() && (
          <p>Tente buscar por nome ou matrícula</p>
        )}
      </div>
    );
  }

  // ✅ RENDERIZAÇÃO PRINCIPAL
  return (
    <div className={`${styles.membrosList} ${isMobile ? styles.mobile : styles.desktop}`}>
      {renderMember}
    </div>
  );
});

MemberList.displayName = 'MemberList';
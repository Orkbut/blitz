/**
 * Hook useMemberActions
 * 
 * Hook customizado para ações de membros (CRUD)
 * com loading states e feedback visual.
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import type { MemberActionsHookReturn, CreateMemberData } from '../types';
import { constants } from '../utils/constants';

export const useMemberActions = (serverId?: string): MemberActionsHookReturn => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const addMember = useCallback(async (memberData: CreateMemberData) => {
    if (!serverId) {
      throw new Error('Server ID é obrigatório');
    }

    setActionLoading('add');
    
    try {
      const response = await fetch('/api/supervisor/membros', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...memberData,
          serverId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Membro adicionado com sucesso!');
        return result.data;
      } else {
        throw new Error(result.error || 'Erro ao adicionar membro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : constants.MESSAGES.CONNECTION_ERROR;
      toast.error(`Erro ao adicionar membro: ${errorMessage}`);
      throw error;
    } finally {
      setActionLoading(null);
    }
  }, [serverId]);

  const removeMember = useCallback(async (memberId: string) => {
    setActionLoading('remove');
    
    try {
      const response = await fetch(`/api/supervisor/membros/${memberId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success) {
        toast.success('Membro removido com sucesso!');
      } else {
        throw new Error(result.error || 'Erro ao remover membro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : constants.MESSAGES.CONNECTION_ERROR;
      toast.error(`Erro ao remover membro: ${errorMessage}`);
      throw error;
    } finally {
      setActionLoading(null);
    }
  }, []);

  return {
    addMember,
    removeMember,
    actionLoading
  };
};
/**
 * Hook useMemberData
 * 
 * Hook simples para gerenciar dados de membros.
 * SEM CACHE - dados sempre atualizados do servidor.
 */

import { useState, useEffect, useCallback } from 'react';
import { getSupervisorHeaders } from '@/lib/auth-utils';
import type { MemberDataHookReturn, Membro } from '../types';

export const useMemberData = (serverId?: string): MemberDataHookReturn => {
  const [members, setMembers] = useState<Membro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!serverId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/supervisor/membros', {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          ...getSupervisorHeaders()
        }
      });

      if (!response.ok) {
        throw new Error(`Erro ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setMembers(data.data || []);
      } else {
        throw new Error(data.error || 'Erro ao buscar membros');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro de conexão';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [serverId]);

  const refreshMembers = useCallback(async () => {
    await fetchMembers();
  }, [fetchMembers]);

  useEffect(() => {
    if (serverId) {
      fetchMembers();
    }
  }, [serverId, fetchMembers]);

  return {
    members,
    loading,
    error,
    refreshMembers
  };
};
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarioMembro } from '@/components/calendario/CalendarioMembro';
import { ElegantPageLoader } from '@/shared/components/ui/LoadingSpinner';
import { UserBar } from '@/shared/components/business';

export default function MembroPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // ✅ VERIFICAÇÃO DE AUTENTICAÇÃO IMEDIATA (SEM DELAY)
  useEffect(() => {
    const checkAuth = () => {
      const membroAuth = localStorage.getItem('membroAuth');
      
      if (!membroAuth) {
        router.push('/membro/auth');
        return;
      }

      try {
        const userData = JSON.parse(membroAuth);
        // ✅ CORREÇÃO: Permitir acesso tanto para Membros quanto para Supervisores
        if ((userData.perfil === 'Membro' || userData.perfil === 'Supervisor') && userData.regionalId) {
          setIsAuthenticated(true);
          setInitialLoading(false);
        } else {
          router.push('/membro/auth');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/membro/auth');
        return;
      }
    };

    // ✅ EXECUÇÃO IMEDIATA - Remove o setTimeout que causava o problema
    checkAuth();
  }, [router]);

  // ✅ LOADING INICIAL ELEGANTE
  if (initialLoading || !isAuthenticated) {
    return <ElegantPageLoader title="Portal do Membro" subtitle="Verificando acesso..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <UserBar />
      <CalendarioMembro />
    </div>
  );
}
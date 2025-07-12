'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarioMembro } from '@/components/calendario/CalendarioMembro';
import { ElegantPageLoader } from '@/shared/components/ui/LoadingSpinner';

export default function MembroPage() {
  const [initialLoading, setInitialLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();

  // ✅ CONTROLE DE LOADING INICIAL E AUTENTICAÇÃO
  useEffect(() => {
    const checkAuth = () => {
      const membroAuth = localStorage.getItem('membroAuth');
      
      if (!membroAuth) {
        // Redirecionar para página de autenticação
        router.push('/membro/auth');
        return;
      }

      try {
        const userData = JSON.parse(membroAuth);
        // ✅ CORREÇÃO: Permitir acesso tanto para Membros quanto para Supervisores
        // Um supervisor também pode acessar o portal do membro
        if ((userData.perfil === 'Membro' || userData.perfil === 'Supervisor') && userData.regionalId) {
          setIsAuthenticated(true);
        } else {
          router.push('/membro/auth');
          return;
        }
      } catch (error) {
        console.error('Erro ao verificar autenticação:', error);
        router.push('/membro/auth');
        return;
      }

      setInitialLoading(false);
    };

    const timer = setTimeout(checkAuth, 1000); // 1 segundo para verificação
    return () => clearTimeout(timer);
  }, [router]);

  // ✅ LOADING INICIAL ELEGANTE
  if (initialLoading || !isAuthenticated) {
    return <ElegantPageLoader title="Portal do Membro" subtitle="Verificando acesso..." />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <CalendarioMembro />
    </div>
  );
} 
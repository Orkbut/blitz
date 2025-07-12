
'use client';

import { useState, useEffect } from 'react';
import { Calendar, Target, TrendingUp, Users, Shield, Activity } from 'lucide-react';
// import SkipLinks from '@/components/SkipLinks';

// Componentes organizados preservando design moderno
import { ModernHeader, DashboardCard, ResponsiveGrid, Section } from '@/shared/components/business';
import { Card, Button } from '@/shared/components/ui';

interface Operacao {
  id: number;
  dataOperacao: string;
  modalidade: string;
  tipo: string;
  limiteDiarias: number;
  status: string;
  regional: string;
}

interface StatusData {
  totalOperacoes: number;
  operacoesDisponiveis: number;
  operacoesLotadas: number;
  servidoresOnline: number;
}

export default function HomePageRefactored() {
  const [operacoes, setOperacoes] = useState<Operacao[]>([]);
  const [statusData, setStatusData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function carregarDados() {
      try {
        // ✅ DADOS REAIS: Carregar operações ativas (UNIFIED API)
        const respOperacoes = await fetch('/api/unified/operacoes?portal=admin');
        if (respOperacoes.ok) {
          const dataOperacoes = await respOperacoes.json();
          setOperacoes(dataOperacoes.success ? dataOperacoes.data : []);
        }

        // ✅ DADOS REAIS: Métricas do dashboard vindas do banco
        const respStats = await fetch('/api/dashboard/stats');
        if (respStats.ok) {
          const dataStats = await respStats.json();
          if (dataStats.success) {
            setStatusData(dataStats.data);
            console.log('✅ Dashboard carregado com dados REAIS:', dataStats.data);
          }
        } else {
          throw new Error('Falha ao carregar métricas do sistema');
        }

      } catch (err) {
        setError('Erro ao carregar dados do sistema');
        console.error('❌ Erro:', err);
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
    
    // ✅ TEMPO REAL: Atualizar a cada 30 segundos
    const interval = setInterval(carregarDados, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <Card className="text-center fade-in">
          <div className="loading-spinner mx-auto mb-4" aria-hidden="true"></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Carregando Sistema RADAR...</h2>
          <p className="text-gray-600">Consultando dados em tempo real...</p>
          <span className="sr-only">Carregando dados do sistema, aguarde...</span>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* <SkipLinks /> */}
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        
        {/* Header Moderno Componentizado */}
        <ModernHeader
          title="Sistema RADAR - DETRAN/CE"
          subtitle="Registro de Agendamento de Diárias Antecipadas e Recursos"
        />

        <main className="container py-8 fade-in" id="main-content" role="main">
          
          {/* ✅ DASHBOARD COM DADOS REAIS */}
          {statusData && (
            <Section 
              title="Métricas em Tempo Real" 
              icon={<TrendingUp />}
            >
              <ResponsiveGrid cols={{ default: 1, md: 2, lg: 4 }}>
                <DashboardCard
                  title="Total de Operações"
                  value={statusData.totalOperacoes}
                  icon={<Calendar className="text-blue-600" />}
                  iconBgColor="bg-blue-100"
                  progressValue={75}
                  progressColor="bg-primary-500"
                />

                <DashboardCard
                  title="Operações Disponíveis"
                  value={statusData.operacoesDisponiveis}
                  icon={<Target className="text-green-600" />}
                  iconBgColor="bg-green-100"
                  progressValue={80}
                  progressColor="bg-green-500"
                />

                <DashboardCard
                  title="Servidores Online"
                  value={statusData.servidoresOnline}
                  icon={<Activity className="text-purple-600" />}
                  iconBgColor="bg-purple-100"
                  progressValue={65}
                  progressColor="bg-purple-500"
                />

                <DashboardCard
                  title="Operações Lotadas"
                  value={statusData.operacoesLotadas}
                  icon={<Shield className="text-orange-600" />}
                  iconBgColor="bg-orange-100"
                  progressValue={85}
                  progressColor="bg-orange-500"
                />
              </ResponsiveGrid>
            </Section>
          )}

          {/* Portais de Acesso Componentizados */}
          <Section
            title="Portais de Acesso"
            subtitle="Escolha seu portal baseado no seu nível de acesso"
            icon={<Users />}
          >
            <ResponsiveGrid cols={{ default: 1, md: 2, lg: 3 }}>
              
              {/* Portal do Membro */}
              <Card variant="nav" className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Users className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Portal do Membro
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Consulte operações disponíveis, gerencie participações e acompanhe o status das suas diárias
                </p>
                <Button 
                  variant="primary" 
                  className="w-full"
                  onClick={() => window.location.href = '/membro'}
                >
                  Acessar Portal
                </Button>
              </Card>

              {/* Portal do Supervisor */}
              <Card variant="nav" className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Shield className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Portal do Supervisor
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Crie janelas operacionais, gerencie operações e aprove participações dos membros
                </p>
                <Button 
                  variant="success" 
                  className="w-full"
                  onClick={() => window.location.href = '/supervisor'}
                >
                  Acessar Portal
                </Button>
              </Card>

              {/* Portal do Admin */}
              <Card variant="nav" className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <TrendingUp className="w-8 h-8 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">
                  Portal do Administrador
                </h3>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Administre o sistema, configure parâmetros e monitore todas as operações
                </p>
                <Button 
                  variant="primary" 
                  className="w-full"
                  onClick={() => window.location.href = '/admin'}
                >
                  Acessar Portal
                </Button>
              </Card>

            </ResponsiveGrid>
          </Section>

          {/* Seção de Status (se houver erro) */}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}

        </main>
      </div>
    </>
  );
} 
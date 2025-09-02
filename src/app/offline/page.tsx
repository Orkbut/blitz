'use client';

import { useEffect, useState } from 'react';
import { usePWA } from '@/hooks/usePWA';
import { getSupervisorData } from '@/lib/auth-utils';

export default function OfflinePage() {
  const { isOnline, isAuthenticated } = usePWA();
  const [userData, setUserData] = useState<any>(null);

  useEffect(() => {
    // Carregar dados do usuário se estiver logado
    const supervisor = getSupervisorData();
    const membroAuth = localStorage.getItem('membroAuth');
    
    if (supervisor) {
      setUserData(supervisor);
    } else if (membroAuth) {
      try {
        setUserData(JSON.parse(membroAuth));
      } catch (error) {
        console.error('Erro ao carregar dados do membro:', error);
      }
    }
  }, []);

  if (isOnline) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Conectado!</h1>
          <p className="text-gray-600 mb-6">Você está online novamente.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ir para o Sistema
          </button>
        </div>
      </div>
    );
  }

  const userIsAuthenticated = isAuthenticated();

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header Offline */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-red-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Sistema Offline</h1>
              <p className="text-gray-600">Conexão com a internet necessária</p>
            </div>
          </div>
        </div>

        {/* Aviso principal */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-12.728 12.728m0-12.728l12.728 12.728" />
              </svg>
            </div>
            
            {userIsAuthenticated ? (
              <div>
                <h2 className="text-xl font-bold text-red-600 mb-3">Sistema de Agendamento Requer Internet</h2>
                <p className="text-gray-700 mb-4">
                  Este sistema gerencia agendamentos em tempo real e precisa estar sempre conectado 
                  para garantir a sincronização dos dados.
                </p>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-red-800">
                    <strong>Importante:</strong> Operações de agendamento não podem ser realizadas offline 
                    para evitar conflitos e garantir a integridade dos dados.
                  </p>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-3">Conecte-se para Acessar</h2>
                <p className="text-gray-700 mb-4">
                  Você precisa estar online para fazer login e acessar o sistema.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Informações do usuário se logado */}
        {userIsAuthenticated && userData && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Usuário Logado</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-500">Nome:</span>
                <p className="font-medium">{userData.nome}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Matrícula:</span>
                <p className="font-medium">{userData.matricula}</p>
              </div>
              {userData.regional && (
                <div>
                  <span className="text-sm text-gray-500">Regional:</span>
                  <p className="font-medium">{userData.regional.nome}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-gray-500">Perfil:</span>
                <p className="font-medium">{userData.perfil}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botão de reconexão */}
        <div className="text-center">
          <button
            onClick={() => window.location.reload()}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto text-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Tentar Reconectar
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            Verifique sua conexão com a internet e tente novamente
          </p>
        </div>
      </div>
    </div>
  );
}
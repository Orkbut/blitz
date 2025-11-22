'use client';

import React, { useState, useEffect } from 'react';
import { User, LogOut, Settings, ChevronDown } from 'lucide-react';

interface UserData {
  id: number;
  nome: string;
  matricula: string;
  perfil: string;
  regionalId: number;
  regional?: {
    id: number;
    nome: string;
    codigo: string;
  };
  autenticado: boolean;
}

export const UserBar: React.FC = () => {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const loadUserData = () => {
      const membroAuth = localStorage.getItem('membroAuth');
      if (membroAuth) {
        try {
          const data = JSON.parse(membroAuth);
          setUserData(data);
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
        }
      }
    };

    loadUserData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('membroAuth');
    localStorage.removeItem('membroId');
    window.location.href = '/membro/auth';
  };

  const handleSwitchToSupervisor = () => {
    try {
      const membroAuth = localStorage.getItem('membroAuth');
      if (!membroAuth) {
        window.location.href = '/supervisor/auth';
        return;
      }
      const data = JSON.parse(membroAuth);
      if (data?.perfil === 'Supervisor') {
        const supervisorData = {
          ...data,
          autenticado: true
        };
        localStorage.setItem('supervisorAuth', JSON.stringify(supervisorData));
        window.location.href = '/supervisor';
        return;
      }
      alert('Seu perfil não é de Supervisor.');
    } catch {
      window.location.href = '/supervisor/auth';
    }
  };

  if (!userData) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-slate-50 to-blue-50 border-b border-blue-100 shadow-sm">
      <div className="w-full px-2 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-12 sm:h-14">
          {/* Logo/Título - Responsivo */}
          <div className="flex items-center flex-1 min-w-0">
            <div className="flex-shrink-0">
              <h1 className="text-xs sm:text-sm lg:text-lg font-bold text-slate-800 tracking-wide truncate">
                EU VOU • DETRAN/CE
              </h1>
            </div>
          </div>

          {/* Informações do Usuário - Layout Responsivo */}
          <div className="flex items-center gap-1 sm:gap-3 lg:gap-6 flex-shrink-0">
            {/* Regional info - Oculta em telas muito pequenas */}
            <div className="hidden xs:flex text-xs sm:text-sm text-slate-600 bg-white/60 px-2 sm:px-3 py-1 rounded-full">
              <span className="font-semibold text-slate-700">Regional:</span> 
              <span className="ml-1 font-bold text-blue-600">{userData.regional?.nome || userData.regionalId}</span>
            </div>
            
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1 sm:gap-2 lg:gap-3 text-xs sm:text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 rounded-lg px-2 sm:px-3 py-1 sm:py-2 transition-all duration-200 bg-white/70 hover:bg-white/90 shadow-sm hover:shadow-md max-w-[180px] sm:max-w-none"
              >
                <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-9 lg:h-9 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center shadow-sm flex-shrink-0">
                  <User size={12} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px] text-blue-600" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <div className="font-bold text-slate-800 text-xs sm:text-sm leading-tight truncate">
                    {userData.nome.length > 20 ? userData.nome.substring(0, 20) + '...' : userData.nome}
                  </div>
                  <div className="text-xs sm:text-xs text-slate-500 font-medium truncate">
                    {userData.matricula} • {userData.perfil}
                  </div>
                </div>
                <ChevronDown 
                  size={12} 
                  className="sm:w-4 sm:h-4 transition-transform duration-200 text-slate-400 flex-shrink-0" 
                  style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white rounded-xl shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-[70] border border-slate-100">
                  <div className="py-2">
                    <div className="px-4 py-3 text-sm text-slate-700 border-b border-slate-100 bg-slate-50/50">
                      <div className="font-bold text-slate-800 truncate">{userData.nome}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        <div>Matrícula: <span className="font-semibold">{userData.matricula}</span></div>
                        <div>Perfil: <span className="font-semibold">{userData.perfil}</span></div>
                        <div>Regional: <span className="font-semibold">{userData.regional?.nome || userData.regionalId}</span></div>
                      </div>
                    </div>
                    
                    {userData.perfil === 'Supervisor' && (
                      <button
                        onClick={handleSwitchToSupervisor}
                        className="flex items-center w-full px-4 py-3 text-sm text-blue-700 hover:bg-blue-50 transition-colors"
                      >
                        <img src="/icons/alternarconta.png" alt="Alternar conta" className="mr-3" style={{ width: 16, height: 16 }} />
                        Ir para Supervisor
                      </button>
                    )}
                    
                    <button
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center w-full px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <Settings size={16} className="mr-3 text-slate-400" />
                      Configurações
                    </button>
                    
                    <button
                      onClick={handleLogout}
                      className="flex items-center w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors border-t border-slate-100"
                    >
                      <LogOut size={16} className="mr-3" />
                      Sair do Sistema
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fechar dropdown ao clicar fora */}
      {isDropdownOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsDropdownOpen(false)}
        />
      )}
    </div>
  );
};

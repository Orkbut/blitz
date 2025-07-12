'use client';

import { Users, Calendar, Shield, Settings, ChevronRight } from 'lucide-react';

export default function HomePage() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white animate-pulse"></div>
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                  Eu vou Detran
                </h1>
                <p className="text-gray-600 mt-1 font-medium">
                  Registro de Agendamento de Diárias
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2 bg-gradient-to-r from-green-100 to-emerald-100 px-4 py-2 rounded-full border border-green-200 shadow-sm">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-semibold text-green-800">Sistema Online</span>
                </div>
                <div className="bg-white/60 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">
                      {new Date().toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Portais de Acesso */}
        <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl mb-8 border border-white/20">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <a 
                href="/membro" 
                className="group bg-gradient-to-br from-white to-blue-50/30 border border-blue-200/50 rounded-xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-blue-500/25 transition-all duration-300">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Portal do Membro</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Consulte operações disponíveis, gerencie participações e acompanhe o status das suas diárias
                  </p>
                  <div className="flex items-center justify-center">
                    <span className="text-blue-600 font-semibold mr-2">Acessar Portal</span>
                    <ChevronRight className="w-6 h-6 text-blue-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </a>

              <a 
                href="/supervisor" 
                className="group bg-gradient-to-br from-white to-green-50/30 border border-green-200/50 rounded-xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-green-500/25 transition-all duration-300">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Portal do Supervisor</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Gerencie operações, aprove participações e monitore o cumprimento das diretrizes
                  </p>
                  <div className="flex items-center justify-center">
                    <span className="text-green-600 font-semibold mr-2">Acessar Portal</span>
                    <ChevronRight className="w-6 h-6 text-green-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </a>

              <a 
                href="/admin/login" 
                className="group bg-gradient-to-br from-white to-red-50/30 border border-red-200/50 rounded-xl p-6 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer backdrop-blur-sm"
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg group-hover:shadow-red-500/25 transition-all duration-300">
                    <Settings className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Portal do Administrador</h3>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Configurações avançadas, gestão de usuários e relatórios gerenciais do sistema
                  </p>
                  <div className="flex items-center justify-center">
                    <span className="text-red-600 font-semibold mr-2">Acessar Portal</span>
                    <ChevronRight className="w-6 h-6 text-red-400 group-hover:text-red-600 group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>



      </div>
    </div>
  );
}

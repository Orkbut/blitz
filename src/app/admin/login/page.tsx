'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [credentials, setCredentials] = useState({ login: '', senha: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials)
      });

      const result = await response.json();

      if (result.success) {
        // Salvar token de autenticação
        localStorage.setItem('admin_token', result.token);
        router.push('/admin');
      } else {
        setError(result.error || 'Credenciais inválidas');
      }
    } catch (error) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-4xl">⚙️</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">
            Portal do Administrador
          </h1>
          <p className="text-gray-600 mt-2">Acesso restrito ao sistema RADAR</p>
        </div>

        {/* Formulário de Login */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 border border-gray-100">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                👤 Login de Administrador
              </label>
              <input
                type="text"
                value={credentials.login}
                onChange={(e) => setCredentials({...credentials, login: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Digite seu login"
                required
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                🔒 Senha de Acesso
              </label>
              <input
                type="password"
                value={credentials.senha}
                onChange={(e) => setCredentials({...credentials, senha: e.target.value})}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-gray-50 focus:bg-white"
                placeholder="Digite sua senha"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">❌</span>
                  <span className="text-red-700 font-medium">{error}</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>Verificando...</span>
                </div>
              ) : (
                '🚀 Acessar Portal'
              )}
            </button>
          </form>

          {/* Informações de Segurança */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="bg-blue-50 rounded-xl p-4">
              <div className="flex items-start space-x-3">
                <span className="text-blue-500 text-lg">🔐</span>
                <div>
                  <h3 className="font-semibold text-blue-900 text-sm">Acesso Seguro</h3>
                  <p className="text-blue-700 text-xs mt-1">
                    Este portal possui autenticação avançada com credenciais criptografadas no banco de dados.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <a 
            href="/" 
            className="text-gray-500 hover:text-blue-600 transition-colors font-medium"
          >
            ← Voltar ao Portal Principal
          </a>
        </div>
      </div>
    </div>
  );
} 
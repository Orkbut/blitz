'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, MapPin, Shield, ChevronRight, AlertCircle, UserCheck, UserPlus, Eye, EyeOff } from 'lucide-react';

interface Regional {
  id: number;
  nome: string;
  codigo: string;
}

type ModoAuth = 'selecao' | 'login' | 'cadastro' | 'regional' | 'recuperar';

export default function MembroAuthPage() {
  const [regionais, setRegionais] = useState<Regional[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegional, setSelectedRegional] = useState<number | null>(null);
  const [dadosMembro, setDadosMembro] = useState({
    matricula: '',
    nome: '',
    email: '',
    senha: ''
  });
  const [modo, setModo] = useState<ModoAuth>('selecao');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // ✅ ESTADOS PARA RECUPERAÇÃO DE SENHA
  const [showModalRecuperacao, setShowModalRecuperacao] = useState(false);
  const [dadosRecuperacao, setDadosRecuperacao] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    carregarRegionais();
  }, []);

  // ✅ FUNÇÃO PARA RECUPERAÇÃO DE SENHA
  const handleRecuperarSenha = async (matricula: string) => {
    if (!matricula.trim()) {
      setError('Informe sua matrícula para recuperar a senha');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/recuperar-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: matricula.trim(),
          justificativa: 'Usuário esqueceu a senha'
        })
      });

      const resultado = await response.json();

      if (resultado.success) {
        setDadosRecuperacao({
          nome: resultado.data.nome,
          matricula: resultado.data.matricula,
          regional: resultado.data.regional,
          dataEnvio: new Date().toLocaleString('pt-BR')
        });
        setShowModalRecuperacao(true);
        setError(null);
      } else {
        setError(resultado.error);
      }
    } catch (error) {
      console.error('Erro na recuperação:', error);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleFecharModalRecuperacao = () => {
    setShowModalRecuperacao(false);
    setDadosRecuperacao(null);
    setModo('selecao');
  };

  const carregarRegionais = async () => {
    try {
      const response = await fetch('/api/regionais');
      if (response.ok) {
        const data = await response.json();
        setRegionais(data.data || []);
      }
    } catch (error) {
      console.error('Erro ao carregar regionais:', error);
      setError('Erro ao carregar regionais disponíveis');
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!dadosMembro.matricula.trim() || !dadosMembro.senha.trim()) {
      setError('Matrícula e senha são obrigatórios');
      setLoading(false);
      return;
    }

    try {
      // Para login, só precisamos de matrícula e senha
      const response = await fetch('/api/auth/validar-servidor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: dadosMembro.matricula.trim(),
          nome: 'LOGIN_MODE', // Indicador especial para modo login
          senha: dadosMembro.senha.trim()
        })
      });

      const resultado = await response.json();

      if (!resultado.success) {
        setError(resultado.error);
        setLoading(false);
        return;
      }

      // Login bem-sucedido - dados completos do servidor
      const membroData = {
        id: resultado.data.id,
        matricula: resultado.data.matricula,
        nome: resultado.data.nome,
        email: dadosMembro.email || '',
        regionalId: resultado.data.regionalId,
        regional: resultado.data.regional,
        perfil: resultado.data.perfil,
        autenticado: true,
        dataLogin: new Date().toISOString()
      };
      
      localStorage.setItem('membroAuth', JSON.stringify(membroData));
      
      // Redirecionar direto para o portal (já temos a regional)
      router.push('/membro');
      
    } catch (error) {
      console.error('Erro no login:', error);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCadastroSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!dadosMembro.matricula.trim() || !dadosMembro.nome.trim() || !dadosMembro.senha.trim()) {
      setError('Matrícula, nome e senha são obrigatórios');
      setLoading(false);
      return;
    }

    // Validar senha (mínimo 6 caracteres para segurança)
    const senhaDigitada = dadosMembro.senha.trim();
    
    if (senhaDigitada.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      setLoading(false);
      return;
    }

    try {
      // Salvar dados temporariamente para seleção de regional
      const dadosCadastro = {
        matricula: dadosMembro.matricula.trim(),
        nome: dadosMembro.nome.trim(),
        email: dadosMembro.email.trim(),
        senha: dadosMembro.senha.trim(),
        perfil: 'Membro' // Sempre Membro neste portal
      };
      
      sessionStorage.setItem('dadosCadastro', JSON.stringify(dadosCadastro));
      setModo('regional');
      
    } catch (error) {
      console.error('Erro no cadastro:', error);
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegionalSelect = async (regionalId: number) => {
    setSelectedRegional(regionalId);
    setLoading(true);
    
    try {
      const dadosCadastro = sessionStorage.getItem('dadosCadastro');
      if (!dadosCadastro) {
        setError('Erro: dados de cadastro perdidos. Tente novamente.');
        setModo('cadastro');
        setLoading(false);
        return;
      }

      const dados = JSON.parse(dadosCadastro);
      
      // Criar novo servidor no banco
      const response = await fetch('/api/auth/cadastrar-servidor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          matricula: dados.matricula,
          nome: dados.nome,
          email: dados.email,
          senha: dados.senha,
          regionalId: regionalId,
          perfil: dados.perfil
        })
      });

      const resultado = await response.json();

      if (!resultado.success) {
        setError(resultado.error);
        setLoading(false);
        return;
      }

      // ✅ Cadastro bem-sucedido - fazer login automático
      const membroData = {
        id: resultado.data.id,
        matricula: resultado.data.matricula,
        nome: resultado.data.nome,
        email: dados.email || '',
        regionalId: resultado.data.regionalId,
        regional: resultado.data.regional,
        perfil: resultado.data.perfil,
        autenticado: true,
        dataLogin: new Date().toISOString(),
        primeiroCadastro: true
      };
      
      localStorage.setItem('membroAuth', JSON.stringify(membroData));
      sessionStorage.removeItem('dadosCadastro');
      
      router.push('/membro');
      
    } catch (error) {
      console.error('Erro ao finalizar cadastro:', error);
      setError('Erro ao finalizar cadastro');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-white/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Portal do Membro</h1>
                <p className="text-gray-600">Sistema RADAR - DETRAN/CE</p>
              </div>
            </div>
            <a href="/" className="text-blue-600 hover:text-blue-800 font-medium">
              ← Voltar ao Início
            </a>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Seleção do Modo */}
        {modo === 'selecao' && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Acesso ao Sistema RADAR</h2>
              <p className="text-gray-600">Escolha como deseja acessar o sistema</p>
            </div>

            <div className="space-y-4">
              <button
                onClick={() => setModo('login')}
                className="w-full p-6 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                      <UserCheck className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Fazer Login</h3>
                      <p className="text-sm text-gray-600">Já tenho conta - apenas matrícula e senha</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
              </button>

              <button
                onClick={() => setModo('cadastro')}
                className="w-full p-6 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Criar Conta</h3>
                      <p className="text-sm text-gray-600">Não tenho conta - criar nova conta no sistema</p>
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-green-600 transition-colors" />
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Login */}
        {modo === 'login' && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Login</h2>
              <p className="text-gray-600">Entre com sua matrícula e senha</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matrícula *
                </label>
                <input
                  type="text"
                  value={dadosMembro.matricula}
                  onChange={(e) => setDadosMembro({...dadosMembro, matricula: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite sua matrícula"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <input
                  type="password"
                  value={dadosMembro.senha}
                  onChange={(e) => setDadosMembro({...dadosMembro, senha: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Digite sua senha"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Use: sua matrícula + "123" (ex: MEM001123)
                </p>
              </div>

              {/* ✅ LINK RECUPERAÇÃO DE SENHA */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => {
                    const matricula = prompt('Digite sua matrícula para recuperar a senha:');
                    if (matricula) {
                      handleRecuperarSenha(matricula);
                    }
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  🔑 Esqueci minha senha
                </button>
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setModo('selecao')}
                  className="w-1/3 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Entrando...
                    </>
                  ) : (
                    <>
                      Entrar
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cadastro */}
        {modo === 'cadastro' && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Criar Nova Conta</h2>
              <p className="text-gray-600">Preencha seus dados para criar sua conta no sistema</p>
            </div>

            <form onSubmit={handleCadastroSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matrícula *
                </label>
                <input
                  type="text"
                  value={dadosMembro.matricula}
                  onChange={(e) => setDadosMembro({...dadosMembro, matricula: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Digite sua matrícula"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  value={dadosMembro.nome}
                  onChange={(e) => setDadosMembro({...dadosMembro, nome: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Digite seu nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Senha *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={dadosMembro.senha}
                    onChange={(e) => setDadosMembro({...dadosMembro, senha: e.target.value})}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="Crie uma senha de sua escolha"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Crie uma senha segura com pelo menos 6 caracteres
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-mail (opcional)
                </label>
                <input
                  type="email"
                  value={dadosMembro.email}
                  onChange={(e) => setDadosMembro({...dadosMembro, email: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  placeholder="Digite seu e-mail"
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setModo('selecao')}
                  className="w-1/3 bg-gray-200 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-2/3 bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Validando...
                    </>
                  ) : (
                    <>
                      Criar Conta
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Seleção de Regional */}
        {modo === 'regional' && (
          <div className="bg-white/70 backdrop-blur-sm shadow-xl rounded-2xl border border-white/20 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Selecione sua Regional</h2>
              <p className="text-gray-600">Escolha a regional onde você trabalha</p>
            </div>

            <div className="space-y-4">
              {regionais.map((regional) => (
                <button
                  key={regional.id}
                  onClick={() => handleRegionalSelect(regional.id)}
                  className="w-full p-6 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50/50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{regional.nome}</h3>
                        <p className="text-sm text-gray-600">Código: {regional.codigo}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-gray-400 group-hover:text-green-600 transition-colors" />
                  </div>
                </button>
              ))}

              {regionais.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>Nenhuma regional disponível no momento.</p>
                  <p className="text-sm mt-1">Entre em contato com o administrador.</p>
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200">
              <button
                onClick={() => setModo('cadastro')}
                className="text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Voltar aos dados pessoais
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ✅ MODAL DE RECUPERAÇÃO DE SENHA */}
      {showModalRecuperacao && dadosRecuperacao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden transform transition-all">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 text-center">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">🔑 Recuperação Solicitada</h3>
              <p className="text-orange-100">Solicitação enviada para análise!</p>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-8">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-orange-800 mb-2">📋 Dados da Solicitação</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-orange-700">Nome:</span>
                    <span className="font-medium text-orange-900">{dadosRecuperacao.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700">Matrícula:</span>
                    <span className="font-mono font-medium text-orange-900">{dadosRecuperacao.matricula}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700">Regional:</span>
                    <span className="font-medium text-orange-900">{dadosRecuperacao.regional.nome}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-orange-700">Enviado em:</span>
                    <span className="font-medium text-orange-900">{dadosRecuperacao.dataEnvio}</span>
                  </div>
                </div>
              </div>

              <div className="text-center mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-3">⏳ Aguardando Aprovação</h4>
                <p className="text-gray-600 leading-relaxed">
                  Sua solicitação de recuperação de senha foi enviada para análise do administrador do sistema. 
                  Você será contatado assim que uma nova senha temporária for definida.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h5 className="font-medium text-blue-800 mb-2">📞 Próximos Passos</h5>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• O administrador analisará sua solicitação</li>
                  <li>• Uma senha temporária será definida</li>
                  <li>• Você será informado da nova senha</li>
                  <li>• Faça login e altere para uma senha de sua escolha</li>
                </ul>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleFecharModalRecuperacao}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-8 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-lg flex items-center space-x-2"
                >
                  <span>✅ Entendi</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface EstatisticasServidor {
  servidorId: number;
  nome: string;
  matricula: string;
  totalDiariasCompletas: number;
  totalMeiasDiarias: number;
  totalDiariasEquivalentes: number;
  participacoesConfirmadas: number;
  sequenciasPortaria: SequenciaPortaria[];
}

interface SequenciaPortaria {
  diasOperacao: string[];
  dataInicio: string;
  dataRetorno: string;
  sequencia: string;
  periodo: string;
  valorDiarias: number;
}

interface RelatorioResponse {
  success: boolean;
  data: {
    resumo: {
      total_servidores: number;
      total_operacoes: number;
      total_participacoes: number;
      total_diarias_completas: number;
      total_meias_diarias: number;
      total_diarias_equivalentes: number;
    };
    servidores: EstatisticasServidor[];
  };
}

export default function RelatorioDiariasPage() {
  const [relatorio, setRelatorio] = useState<RelatorioResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // Carregar relatório automaticamente
  useEffect(() => {
    carregarRelatorio();
  }, []);

  const carregarRelatorio = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/relatorio-diarias');
      const data = await response.json();
      
      if (data.success) {
        setRelatorio(data);
        console.log('📊 Relatório carregado:', data);
      } else {
        console.error('❌ Erro no relatório:', data.error);
        alert('Erro ao carregar relatório: ' + data.error);
      }
      
    } catch (error) {
      console.error('❌ Erro ao carregar relatório:', error);
      alert('Erro ao conectar com servidor');
    } finally {
      setLoading(false);
    }
  };

  const baixarRelatorioTexto = async () => {
    try {
      const response = await fetch('/api/relatorio-diarias?formato=texto');
      const texto = await response.text();
      
      const blob = new Blob([texto], { type: 'text/plain; charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `relatorio-diarias-${new Date().toISOString().split('T')[0]}.txt`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Erro ao baixar relatório:', error);
      alert('Erro ao baixar relatório');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                📊 Contabilização de Diárias
              </h1>
              <p className="text-gray-600 mt-2">
                Baseado na mesma lógica da tabela da Diretoria • Apenas participações confirmadas e ativas
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={carregarRelatorio}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
              >
                {loading ? '⏳ Carregando...' : '🔄 Atualizar'}
              </button>
              <button
                onClick={baixarRelatorioTexto}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                📄 Baixar TXT
              </button>
              <Link 
                href="/supervisor"
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors inline-flex items-center"
              >
                ← Voltar
              </Link>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-blue-600 text-6xl mb-4">⏳</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Calculando diárias...
            </h3>
            <p className="text-gray-600">
              Processando participações confirmadas e operações ativas.
            </p>
          </div>
        )}

        {/* Resumo */}
        {relatorio && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📈 Totais Gerais</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {relatorio.data.resumo.total_servidores}
                </div>
                <div className="text-sm text-gray-600">Servidores</div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {relatorio.data.resumo.total_operacoes}
                </div>
                <div className="text-sm text-gray-600">Operações</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {relatorio.data.resumo.total_participacoes}
                </div>
                <div className="text-sm text-gray-600">Participações</div>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {relatorio.data.resumo.total_diarias_completas}
                </div>
                <div className="text-sm text-gray-600">Diárias Completas</div>
              </div>
              
              <div className="text-center p-4 bg-indigo-50 rounded-lg">
                <div className="text-2xl font-bold text-indigo-600">
                  {relatorio.data.resumo.total_meias_diarias}
                </div>
                <div className="text-sm text-gray-600">Meias Diárias</div>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  {relatorio.data.resumo.total_diarias_equivalentes.toFixed(1)}
                </div>
                <div className="text-sm text-gray-600">Total de Diárias</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela Simplificada */}
        {relatorio && !loading && relatorio.data.servidores.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                👥 Contabilização por Servidor ({relatorio.data.servidores.length} servidores)
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Servidor
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Matrícula
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diárias Completas
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Meias Diárias
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <strong>Total de Diárias</strong>
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Participações
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Portarias (D+1)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {relatorio.data.servidores.map((servidor, index) => (
                    <tr key={servidor.servidorId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {servidor.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {servidor.matricula}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {servidor.totalDiariasCompletas}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {servidor.totalMeiasDiarias}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-purple-100 text-purple-800">
                          {servidor.totalDiariasEquivalentes.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600">
                        {servidor.participacoesConfirmadas}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span className="text-sm text-gray-600">
                          {servidor.sequenciasPortaria.length}
                        </span>
                        {servidor.sequenciasPortaria.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {servidor.sequenciasPortaria.map((seq, seqIndex) => (
                              <div key={seqIndex} className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                {seq.sequencia}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {relatorio && !loading && relatorio.data.servidores.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhum servidor encontrado
            </h3>
            <p className="text-gray-600">
              Não há participações confirmadas no sistema para contabilizar.
            </p>
          </div>
        )}

        {/* Rodapé informativo */}
        {relatorio && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
            <h4 className="font-medium text-blue-900 mb-2">ℹ️ Como funciona a contabilização:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Diária Completa:</strong> Vale 1.0 diária</li>
              <li>• <strong>Meia Diária:</strong> Vale 0.5 diária (padrão quando não especificado)</li>
              <li>• <strong>Total de Diárias:</strong> Soma considerando 2 meias = 1 completa</li>
              <li>• <strong>Portarias (D+1):</strong> Sequências consecutivas de operações (D+1, DD+1, DDD+1, etc.)</li>
              <li>• <strong>Filtros:</strong> Apenas participações ATIVAS e CONFIRMADAS/ADICIONADO_SUP</li>
            </ul>
          </div>
        )}

      </div>
    </div>
  );
} 
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getSupervisorHeaders } from '@/lib/auth-utils';
import { MultiDateCalendar } from '@/components/supervisor/MultiDateCalendar';

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
  
  // ✅ NOVO: Estados para filtro de período
  const [filtroAtivo, setFiltroAtivo] = useState(false);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Carregar relatório automaticamente
  useEffect(() => {
    carregarRelatorio();
  }, []);

  const carregarRelatorio = async () => {
    try {
      setLoading(true);
      
      // ✅ NOVO: Construir URL com filtros de período se ativo
      let url = '/api/relatorio-diarias';
      const params = new URLSearchParams();
      
      if (filtroAtivo && dataInicio && dataFim) {
        params.append('data_inicio', dataInicio);
        params.append('data_fim', dataFim);
      }
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await fetch(url, {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
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
      // ✅ NOVO: Aplicar filtros também no download
      let url = '/api/relatorio-diarias?formato=texto';
      
      if (filtroAtivo && dataInicio && dataFim) {
        url += `&data_inicio=${dataInicio}&data_fim=${dataFim}`;
      }
      
      const response = await fetch(url, {
        headers: getSupervisorHeaders() // ✅ ISOLAMENTO POR REGIONAL
      });
      const texto = await response.text();
      
      const blob = new Blob([texto], { type: 'text/plain; charset=utf-8' });
      const urlBlob = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = urlBlob;
      
      // ✅ NOVO: Nome do arquivo com período se filtrado
      let nomeArquivo = `relatorio-diarias-${new Date().toISOString().split('T')[0]}`;
      if (filtroAtivo && dataInicio && dataFim) {
        nomeArquivo += `-periodo-${dataInicio}-a-${dataFim}`;
      }
      link.download = `${nomeArquivo}.txt`;
      
      link.click();
      window.URL.revokeObjectURL(urlBlob);
    } catch (error) {
      console.error('❌ Erro ao baixar relatório:', error);
      alert('Erro ao baixar relatório');
    }
  };

  // ✅ NOVO: Funções para o filtro de período
  const formatarDataBR = (dataISO: string): string => {
    if (!dataISO) return '';
    const [ano, mes, dia] = dataISO.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const formatarPeriodoSelecionado = (): string => {
    if (!dataInicio && !dataFim) return '';
    if (dataInicio && dataFim) {
      return `${formatarDataBR(dataInicio)} - ${formatarDataBR(dataFim)}`;
    }
    if (dataInicio) return `A partir de ${formatarDataBR(dataInicio)}`;
    if (dataFim) return `Até ${formatarDataBR(dataFim)}`;
    return '';
  };

  const aplicarFiltroPeriodo = () => {
    if (selectedDates.length >= 2) {
      // Pegar primeira e última data do intervalo selecionado
      const datesOrdenadas = [...selectedDates].sort();
      setDataInicio(datesOrdenadas[0]);
      setDataFim(datesOrdenadas[datesOrdenadas.length - 1]);
      setFiltroAtivo(true);
    } else if (selectedDates.length === 1) {
      // Se só uma data, usar como início e fim
      setDataInicio(selectedDates[0]);
      setDataFim(selectedDates[0]);
      setFiltroAtivo(true);
    }
    setShowDatePicker(false);
    // Recarregar relatório será automático via useEffect em carregarRelatorio
  };

  const limparFiltro = () => {
    setFiltroAtivo(false);
    setDataInicio('');
    setDataFim('');
    setSelectedDates([]);
  };

  // ✅ NOVO: Recarregar quando filtro mudar
  useEffect(() => {
    if (filtroAtivo || (!filtroAtivo && relatorio)) {
      carregarRelatorio();
    }
  }, [filtroAtivo, dataInicio, dataFim]);

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden w-full">
      <div className="w-full max-w-full px-2 sm:px-4 lg:px-8 mx-auto">
        
        {/* Cabeçalho */}
        <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6 mb-4 sm:mb-6 max-w-full">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                <img src="/icons/relatoriodediarias.png" alt="Relatório de Diárias" style={{ width: 28, height: 28 }} />
                Contabilização de Diárias
              </h1>
              <p className="text-sm sm:text-base text-gray-600 mt-2 break-words">
                Baseado na mesma lógica da tabela da Diretoria • Apenas participações confirmadas e ativas
                {filtroAtivo && (
                  <span className="block sm:inline ml-0 sm:ml-2 text-blue-600 font-medium mt-1 sm:mt-0">
                    • Filtrado: {formatarPeriodoSelecionado()}
                  </span>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={carregarRelatorio}
                disabled={loading}
                className="bg-blue-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                {loading ? '⏳ Carregando...' : '🔄 Atualizar'}
              </button>
              <button
                onClick={baixarRelatorioTexto}
                className="bg-green-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-green-700 transition-colors text-sm sm:text-base whitespace-nowrap"
              >
                📄 Baixar TXT
              </button>
              <Link 
                href="/supervisor"
                className="bg-gray-600 text-white px-3 sm:px-4 py-2 rounded-md hover:bg-gray-700 transition-colors inline-flex items-center text-sm sm:text-base whitespace-nowrap"
              >
                ← Voltar
              </Link>
            </div>
          </div>
        </div>

        {/* ✅ NOVO: Seção de Filtros - Design mais discreto e integrado */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-4 max-w-full overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                  🔍
                </div>
                <h3 className="text-sm font-medium text-gray-900">Filtros</h3>
              </div>
              {filtroAtivo && (
                <button
                  onClick={limparFiltro}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
          
          <div className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <input
                    type="text"
                    value={formatarPeriodoSelecionado()}
                    onClick={() => setShowDatePicker(true)}
                    readOnly
                    placeholder="Selecionar período de análise..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white hover:bg-gray-50 transition-colors"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {!filtroAtivo && (
                <button
                  onClick={() => setShowDatePicker(true)}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap flex-shrink-0"
                >
                  Filtrar
                </button>
              )}
            </div>

            {filtroAtivo && (
              <div className="mt-3 flex items-center gap-2 text-xs">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">
                  Filtro ativo: <strong className="text-blue-600">{formatarPeriodoSelecionado()}</strong>
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ✅ NOVO: Modal do Calendário - Estilo similar aos outros modais */}
        {showDatePicker && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 z-50 backdrop-blur-sm"
              onClick={() => setShowDatePicker(false)}
              style={{
                background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)'
              }}
            />
            
            {/* Modal Container */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div 
                className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-sm w-full"
                style={{
                  background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
                }}
              >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        📅
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        Selecionar Período
                      </h3>
                    </div>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Calendar */}
                <div className="p-6">
                  <MultiDateCalendar
                    selectedDates={selectedDates}
                    onDatesChange={setSelectedDates}
                    rangeMode={true}
                    onApply={aplicarFiltroPeriodo}
                    onCancel={() => {
                      setShowDatePicker(false);
                      setSelectedDates([]);
                    }}
                    className="w-full"
                  />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
                  <p className="text-xs text-gray-600 text-center">
                    💡 <strong>Dica:</strong> Clique numa data para filtrar um dia específico, ou selecione um intervalo (data inicial → data final)
                  </p>
                </div>
              </div>
            </div>
                      </>
          )}

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
          <div className="bg-white rounded-lg shadow-sm p-3 sm:p-6 mb-4 sm:mb-6 max-w-full overflow-hidden">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">📈 Totais Gerais</h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
              <div className="text-center p-2 sm:p-4 bg-blue-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-blue-600">
                  {relatorio.data.resumo.total_servidores}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Servidores</div>
              </div>
              
              <div className="text-center p-2 sm:p-4 bg-green-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-green-600">
                  {relatorio.data.resumo.total_operacoes}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Operações</div>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {relatorio.data.resumo.total_participacoes}
                </div>
                <div className="text-sm text-gray-600">Participações</div>
              </div>
              
              <div className="text-center p-2 sm:p-4 bg-orange-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-orange-600">
                  {relatorio.data.resumo.total_diarias_completas}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Diárias Completas</div>
              </div>
              
              <div className="text-center p-2 sm:p-4 bg-indigo-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-indigo-600">
                  {relatorio.data.resumo.total_meias_diarias}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Meias Diárias</div>
              </div>
              
              <div className="text-center p-2 sm:p-4 bg-red-50 rounded-lg">
                <div className="text-lg sm:text-2xl font-bold text-red-600">
                  {relatorio.data.resumo.total_diarias_equivalentes.toFixed(1)}
                </div>
                <div className="text-xs sm:text-sm text-gray-600">Total de Diárias</div>
              </div>
            </div>
          </div>
        )}

        {/* Tabela Simplificada */}
        {relatorio && !loading && relatorio.data.servidores.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden max-w-full">
            <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                👥 Contabilização por Servidor ({relatorio.data.servidores.length} servidores)
              </h3>
            </div>
            
            {/* Layout Desktop - Tabela */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full min-w-full">
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
                <tbody className="bg-white divide-y divide-gray-200">
                  {relatorio.data.servidores.map((servidor, index) => (
                    <tr key={servidor.servidorId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {servidor.nome}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {servidor.matricula}
                        </div>
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
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="text-sm text-gray-600">
                          {servidor.participacoesConfirmadas}
                        </div>
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
            
            {/* Layout Mobile - Cards Verticais */}
            <div className="lg:hidden space-y-4">
              {relatorio.data.servidores.map((servidor, index) => (
                <div key={servidor.servidorId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                  {/* Cabeçalho do Card */}
                  <div className="border-b border-gray-100 pb-3 mb-3">
                    <h4 className="text-base font-semibold text-gray-900 break-words">
                      {servidor.nome}
                    </h4>
                    <p className="text-sm text-gray-500 mt-1">
                      Matrícula: <span className="font-medium">{servidor.matricula}</span>
                    </p>
                  </div>
                  
                  {/* Grid de Informações */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Diárias Completas */}
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-green-700">
                        {servidor.totalDiariasCompletas}
                      </div>
                      <div className="text-xs text-green-600 font-medium">
                        Diárias Completas
                      </div>
                    </div>
                    
                    {/* Meias Diárias */}
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-blue-700">
                        {servidor.totalMeiasDiarias}
                      </div>
                      <div className="text-xs text-blue-600 font-medium">
                        Meias Diárias
                      </div>
                    </div>
                    
                    {/* Total de Diárias */}
                    <div className="bg-purple-50 rounded-lg p-3 text-center col-span-2">
                      <div className="text-xl font-bold text-purple-700">
                        {servidor.totalDiariasEquivalentes.toFixed(1)}
                      </div>
                      <div className="text-sm text-purple-600 font-medium">
                        Total de Diárias
                      </div>
                    </div>
                    
                    {/* Participações */}
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-gray-700">
                        {servidor.participacoesConfirmadas}
                      </div>
                      <div className="text-xs text-gray-600 font-medium">
                        Participações
                      </div>
                    </div>
                    
                    {/* Portarias */}
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-yellow-700">
                        {servidor.sequenciasPortaria.length}
                      </div>
                      <div className="text-xs text-yellow-600 font-medium">
                        Portarias (D+1)
                      </div>
                    </div>
                  </div>
                  
                  {/* Detalhes das Portarias */}
                  {servidor.sequenciasPortaria.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Sequências de Portaria:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {servidor.sequenciasPortaria.map((seq, seqIndex) => (
                          <span key={seqIndex} className="inline-block text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            {seq.sequencia}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vazio */}
        {relatorio && !loading && relatorio.data.servidores.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-12 text-center max-w-full">
            <div className="text-gray-400 text-4xl sm:text-6xl mb-4">📊</div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">
              Nenhum servidor encontrado
            </h3>
            <p className="text-sm sm:text-base text-gray-600">
              Não há participações confirmadas no sistema para contabilizar.
            </p>
          </div>
        )}

        {/* Rodapé informativo */}
        {relatorio && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mt-4 sm:mt-6 max-w-full overflow-hidden">
            <h4 className="text-sm sm:text-base font-medium text-blue-900 mb-2">ℹ️ Como funciona a contabilização:</h4>
            <ul className="text-xs sm:text-sm text-blue-800 space-y-1 break-words">
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

'use client';

import React, { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getGroupedRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
} from '@tanstack/react-table';

interface ServidorOperacao {
  id: number;
  nome: string;
  matricula: string;
  dataOperacao: string;
  periodo: string;
  local: string;
  nViagem?: string;
  conc?: string;
  rev?: string;
  obs?: string;
  // Novos campos para PORTARIA MOR
  portariaMor?: string;
  sequenciaPortaria?: string;
}

interface TabelaOperacoesDiretoriaProps {
  operacoes: any[];
  participacoes: any[];
}

interface PortariaMor {
  servidorId: number;
  nome: string;
  matricula: string;
  diasOperacao: string[]; // Datas das operações (D)
  dataRetorno: string;    // Data do retorno (+1)
  sequencia: string;      // D+1, DD+1, DDD+1, etc.
  periodo: string;        // Período formatado para exibição
  chaveAgrupamento: string; // Chave única para agrupamento
}

interface ServidorComParticipacoes {
  nome: string;
  matricula: string;
  participacoes: any[];
}

const columnHelper = createColumnHelper<ServidorOperacao>();

export default function TabelaOperacoesDiretoria({ 
  operacoes = [], 
  participacoes = [] 
}: TabelaOperacoesDiretoriaProps) {
  
  // 🎯 NOVA LÓGICA: Calcular PORTARIA MOR baseada nas participações confirmadas
  const portariasMor = useMemo(() => {
    console.log('🔍 Calculando PORTARIA MOR...');
    console.log('📊 Operações recebidas:', operacoes.length);
    console.log('👥 Participações recebidas:', participacoes.length);
    
    if (!operacoes || operacoes.length === 0 || !participacoes || participacoes.length === 0) {
      console.log('❌ Dados insuficientes para calcular PORTARIA MOR');
      return [];
    }

    // 🚨 FILTRAR RIGOROSAMENTE - APENAS participações ATIVAS E CONFIRMADAS
    const participacoesConfirmadas = participacoes.filter(p => {
      const isAtiva = p.ativa === true;
      const isConfirmada = ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual);
      const hasOperacao = p.operacao_id && p.data_operacao;
      
      return isAtiva && isConfirmada && hasOperacao;
    });

    console.log('✅ Total participações recebidas:', participacoes.length);
    console.log('✅ Participações confirmadas ATIVAS:', participacoesConfirmadas.length);
    console.log('🔍 Estados das participações:', participacoes.map(p => ({
      membro_id: p.membro_id,
      operacao_id: p.operacao_id, 
      ativa: p.ativa,
      estado: p.estado_visual,
      data: p.data_operacao
    })));

    if (participacoesConfirmadas.length === 0) {
      console.log('❌ Nenhuma participação confirmada ATIVA encontrada!');
      return [];
    }

    // Agrupar participações por servidor
    const participacoesPorServidor = participacoesConfirmadas.reduce((acc, participacao) => {
      const servidorId = participacao.membro_id || participacao.servidor_id;
      const nome = participacao.servidor_nome || participacao.nome || 'Servidor';
      const matricula = participacao.matricula || '';
      
      if (!acc[servidorId]) {
        acc[servidorId] = {
          nome,
          matricula,
          participacoes: []
        };
      }
      
      acc[servidorId].participacoes.push(participacao);
      return acc;
    }, {} as Record<number, ServidorComParticipacoes>);

    console.log('👤 Servidores com participações:', Object.keys(participacoesPorServidor).length);

    // Calcular PORTARIA MOR para cada servidor
    const portarias: PortariaMor[] = [];

    Object.entries(participacoesPorServidor).forEach(([servidorIdStr, dados]: [string, ServidorComParticipacoes]) => {
      const servidorId = Number(servidorIdStr);
      
      // Log detalhado para Douglas Santos
      if (servidorId === 1) {
        console.log(`🔍 DOUGLAS SANTOS - Participações recebidas:`, dados.participacoes.length);
        console.log(`🔍 DOUGLAS SANTOS - Detalhes:`, dados.participacoes.map(p => ({
          operacao_id: p.operacao_id,
          data_operacao: p.data_operacao,
          estado_visual: p.estado_visual,
          ativa: p.ativa
        })));
      }
      
      // Buscar operações deste servidor
      const operacoesDoServidor = dados.participacoes.map(p => {
        const operacao = operacoes.find(op => op.id === p.operacao_id);
        return {
          ...p,
          data_operacao: operacao?.data_operacao || operacao?.dataOperacao || p.data_operacao,
          operacao
        };
      }).filter(p => p.data_operacao);
      
      // Log para Douglas Santos
      if (servidorId === 1) {
        console.log(`🔍 DOUGLAS SANTOS - Operações processadas:`, operacoesDoServidor.map(op => op.data_operacao));
      }

      // Ordenar por data
      operacoesDoServidor.sort((a, b) => 
        new Date(a.data_operacao).getTime() - new Date(b.data_operacao).getTime()
      );

      // Agrupar em sequências consecutivas para formar PORTARIA MOR
      let sequenciasPortaria: string[][] = [];
      let sequenciaAtual: string[] = [];
      let dataAnterior: Date | null = null;

      operacoesDoServidor.forEach(({ data_operacao }) => {
        const dataAtual = new Date(data_operacao);
      
      if (dataAnterior && dataAtual.getTime() - dataAnterior.getTime() > 24 * 60 * 60 * 1000) {
          // Nova sequência - finalizar a anterior
          if (sequenciaAtual.length > 0) {
            sequenciasPortaria.push([...sequenciaAtual]);
          }
          sequenciaAtual = [data_operacao];
        } else {
          sequenciaAtual.push(data_operacao);
        }
        
        dataAnterior = dataAtual;
      });

      // Finalizar última sequência
      if (sequenciaAtual.length > 0) {
        sequenciasPortaria.push([...sequenciaAtual]);
      }

      // Criar PORTARIA MOR para cada sequência
      sequenciasPortaria.forEach(sequencia => {
        const diasOperacao = sequencia.sort((a, b) => 
          new Date(a).getTime() - new Date(b).getTime()
        );
        
        // 🚨 CORRIGIR: Calcular data do retorno (+1 dia APÓS a última operação)
        const ultimaDataOperacao = new Date(diasOperacao[diasOperacao.length - 1] + 'T00:00:00-03:00');
        const dataRetorno = new Date(ultimaDataOperacao.getTime() + 24 * 60 * 60 * 1000);
        
        // Calcular sequência (D+1, DD+1, DDD+1, etc.)
        const qtdDias = diasOperacao.length;
        const sequenciaStr = 'D'.repeat(qtdDias) + '+1';
        
        // 🚨 CORREÇÃO: Formatear período com timezone correto
        const dataInicioCorreta = new Date(diasOperacao[0] + 'T00:00:00-03:00'); // Força timezone brasileiro
        
        const periodo = `${dataInicioCorreta.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${dataRetorno.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
        
        // 🚨 LOG ESPECÍFICO PARA DOUGLAS SANTOS
        if (servidorId === 1) {
          console.log(`🚨 DOUGLAS SANTOS - PORTARIA MOR:`, {
            diasOperacao,
            periodo,
            sequencia: sequenciaStr,
            dataInicio: dataInicioCorreta.toLocaleDateString('pt-BR'),
            dataRetorno: dataRetorno.toLocaleDateString('pt-BR'),
            dataInicioISO: dataInicioCorreta.toISOString(),
            dataRetornoISO: dataRetorno.toISOString(),
            ultimaDataOperacao: ultimaDataOperacao.toISOString(),
            diasOperacaoDetalhado: diasOperacao.map(d => ({ original: d, parsed: new Date(d).toISOString() }))
          });
        }
        
        // Criar chave de agrupamento baseada na sequência e período
        const chaveAgrupamento = `${sequenciaStr}_${periodo}`;
        
        portarias.push({
          servidorId,
          nome: dados.nome,
          matricula: dados.matricula,
          diasOperacao,
          dataRetorno: dataRetorno.toISOString().split('T')[0],
          sequencia: sequenciaStr,
          periodo,
          chaveAgrupamento
        });
      });
    });

    console.log('🏛️ PORTARIA MOR calculadas:', portarias.length);
    console.log('📋 Exemplo de PORTARIA MOR:', portarias[0]);

    return portarias;
  }, [operacoes, participacoes]);

  // Processar dados para a tabela baseado nas PORTARIA MOR
  const dadosProcessados = useMemo(() => {
    if (portariasMor.length === 0) return [];

    console.log('🔄 Processando dados da tabela...');

    // Agrupar PORTARIA MOR por chave de agrupamento (mesmo período + sequência)
    const grupos = portariasMor.reduce((acc, portaria) => {
      if (!acc[portaria.chaveAgrupamento]) {
        acc[portaria.chaveAgrupamento] = {
          periodo: portaria.periodo,
          sequencia: portaria.sequencia,
          servidores: []
        };
      }
      
      acc[portaria.chaveAgrupamento].servidores.push(portaria);
      return acc;
    }, {} as Record<string, { periodo: string; sequencia: string; servidores: PortariaMor[] }>);

    console.log('📊 Grupos de PORTARIA MOR:', Object.keys(grupos).length);

    // Converter para formato da tabela
    const dadosTabela: ServidorOperacao[] = [];
    
    Object.entries(grupos).forEach(([chave, grupo]) => {
      grupo.servidores.forEach(portaria => {
        dadosTabela.push({
          id: portaria.servidorId,
          nome: portaria.nome,
          matricula: portaria.matricula,
          dataOperacao: portaria.diasOperacao[0], // Primeira data da sequência
          periodo: portaria.periodo,
          local: 'Quixelô', // Local padrão
          nViagem: '',
          conc: '',
          rev: '',
          obs: '',
          portariaMor: chave,
          sequenciaPortaria: portaria.sequencia
          });
        });
    });

    console.log('📈 Dados processados para tabela:', dadosTabela.length);

    return dadosTabela;
  }, [portariasMor]);

  // Definir colunas
  const columns = useMemo<ColumnDef<ServidorOperacao>[]>(() => [
    columnHelper.accessor('nome', {
      id: 'servidor',
      header: 'Servidor',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('matricula', {
      id: 'matricula', 
      header: 'Matrícula',
      cell: info => info.getValue(),
    }),
    columnHelper.accessor('nViagem', {
      id: 'nViagem',
      header: 'Nº Viagem',
      cell: info => info.getValue() || '',
    }),
    columnHelper.accessor('conc', {
      id: 'conc',
      header: 'Conc?',
      cell: info => info.getValue() || '',
    }),
    columnHelper.accessor('rev', {
      id: 'rev',
      header: 'Rev?',
      cell: info => info.getValue() || '',
    }),
    columnHelper.accessor('obs', {
      id: 'obs',
      header: 'Obs.',
      cell: info => info.getValue() || '',
    }),
  ], []);

  // Agrupar dados por PORTARIA MOR
  const dadosAgrupados = useMemo(() => {
    const grupos: { [key: string]: ServidorOperacao[] } = {};
    dadosProcessados.forEach(item => {
      if (!grupos[item.periodo]) {
        grupos[item.periodo] = [];
      }
      grupos[item.periodo].push(item);
    });
    return grupos;
  }, [dadosProcessados]);

  const table = useReactTable({
    data: dadosProcessados,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
  });

  if (Object.keys(dadosAgrupados).length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        <p className="text-lg font-medium">Nenhuma PORTARIA MOR encontrada</p>
        <p className="text-sm mt-2">Não há participações confirmadas para gerar portarias.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {Object.entries(dadosAgrupados).map(([periodo, registros]) => (
        <div key={periodo} className="mb-6 last:mb-0">
            {/* Cabeçalho do Período - PORTARIA MOR */}
            <div className="bg-yellow-400 px-4 py-2 border border-dashed border-gray-600">
              <h3 className="font-bold text-black text-sm">
                Período: {periodo}
              </h3>
              <p className="text-black text-xs font-medium">
                Local: Quixelô
              </p>
              {registros.length > 0 && registros[0].sequenciaPortaria && (
                <p className="text-black text-xs font-medium">
                  Sequência: {registros[0].sequenciaPortaria}
                </p>
              )}
            </div>

            {/* Tabela para este período */}
            <table className="w-full border-collapse border border-dashed border-gray-600">
              {/* Cabeçalho das colunas */}
              <thead>
                <tr className="bg-yellow-400">
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Servidor
                  </th>
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Matrícula
                  </th>
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Nº Viagem
                  </th>
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Conc?
                  </th>
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Rev?
                  </th>
                  <th className="border border-dashed border-gray-600 px-3 py-2 text-left font-bold text-black text-sm">
                    Obs.
                  </th>
                </tr>
              </thead>

              {/* Corpo da tabela */}
              <tbody>
                {registros.map((registro: ServidorOperacao, index: number) => (
                  <tr key={`${periodo}-${index}`} className="hover:bg-gray-50">
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.nome}
                    </td>
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.matricula}
                    </td>
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.nViagem}
                    </td>
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.conc}
                    </td>
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.rev}
                    </td>
                    <td className="border border-dashed border-gray-600 px-3 py-2 text-sm text-left">
                      {registro.obs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
} 
'use client';

import React, { useRef, useEffect, useState } from "react";
import { Spreadsheet, Worksheet } from "@jspreadsheet-ce/react";
import * as ExcelJS from 'exceljs';
import "jspreadsheet-ce/dist/jspreadsheet.css";
import "jsuites/dist/jsuites.css";
import Link from 'next/link';
import { getSupervisorHeaders, isSupervisorAuthenticated, getSupervisorData } from '@/lib/auth-utils';

interface WorksheetData {
  name: string;
  data: any[][];
  style: any;
  originalStyle: any;
  detranStyle: any;
  colWidths: number[];
  rowHeights: number[];
}

interface OperacaoData {
  id: number;
  data_operacao: string;
  modalidade: string;
  status: string;
  servidor_nome: string;
  matricula: string;
  perfil: string;
  estado_visual: string;
}

// Função para calcular larguras automáticas das colunas baseadas no conteúdo
const calculateAutoColumnWidths = (data: any[][]): number[] => {
  if (!data || data.length === 0) return [300, 100, 120, 80, 120, 120];
  
  const numCols = Math.max(...data.map(row => row.length));
  const colWidths: number[] = [];
  
  for (let col = 0; col < numCols; col++) {
    let maxWidth = 80; // Largura mínima
    let hasContent = false;
    
    for (let row = 0; row < data.length; row++) {
      const cellValue = data[row][col] || '';
      const cellText = String(cellValue);
      
      if (cellText.trim() !== '') {
        hasContent = true;
        
        // Calcular largura baseada no comprimento do texto
        // Aproximadamente 8 pixels por caractere + padding
        let cellWidth = cellText.length * 8 + 20;
        
        // Ajustar para conteúdo especial (títulos, cabeçalhos)
        if (cellText.includes('REGIONAL:') || 
            cellText.includes('Planilha para') ||
            cellText.includes('Setor:') ||
            cellText.includes('Período:')) {
          cellWidth *= 1.3; // Títulos precisam de mais espaço
        }
        
        // Ajustes específicos por coluna
        if (col === 0) { // Primeira coluna (Servidor/Período)
          cellWidth = Math.max(cellWidth, 250); // Mínimo para nomes
          cellWidth = Math.min(cellWidth, 400); // Máximo para não ficar muito largo
        } else if (col === 1) { // Segunda coluna (Matrícula/Local)
          cellWidth = Math.max(cellWidth, 100);
          cellWidth = Math.min(cellWidth, 150);
        } else { // Outras colunas
          cellWidth = Math.max(cellWidth, 80);
          cellWidth = Math.min(cellWidth, 120);
        }
        
        maxWidth = Math.max(maxWidth, cellWidth);
      }
    }
    
    if (hasContent) {
      colWidths.push(maxWidth);
    } else {
      // Largura mínima para colunas vazias
      colWidths.push(col === 0 ? 200 : 80);
    }
  }
  
  return colWidths;
};

export default function PlanilhaDiretoriaPage() {
  const spreadsheetRef = useRef<any>(null);
  const [worksheetsData, setWorksheetsData] = useState<WorksheetData[]>([]);
  const [currentWorksheet, setCurrentWorksheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [useDetranStyle, setUseDetranStyle] = useState(true);
  const [operacoesData, setOperacoesData] = useState<OperacaoData[]>([]);
  const fileName = "Pedido de Diária Padrão";

  const loadDiretoriaData = async () => {
    try {
      setLoading(true);
      
      // ✅ VERIFICAÇÃO DE AUTENTICAÇÃO: Validar contexto antes das requisições
      if (!isSupervisorAuthenticated()) {
        throw new Error('Supervisor não autenticado');
      }
      
      const headers = getSupervisorHeaders();
      if (!headers || Object.keys(headers).length === 0) {
        throw new Error('Headers de autenticação inválidos');
      }
      
      // 🎯 BUSCAR DADOS IGUAIS À PÁGINA PRINCIPAL
      // 1. Buscar janelas operacionais disponíveis
      const responseJanelas = await fetch('/api/supervisor/janelas-operacionais', {
        headers
      });
      
      if (!responseJanelas.ok) {
        throw new Error(`Erro na API de janelas: ${responseJanelas.status}`);
      }
      const dataJanelas = await responseJanelas.json();
      
      if (!dataJanelas.success || dataJanelas.data.length === 0) {
        throw new Error('Nenhuma janela operacional encontrada');
      }
      
      // Selecionar a primeira janela ativa
      const janelaAtiva = dataJanelas.data.find((j: any) => j.status === 'ATIVA');
      if (!janelaAtiva) {
        throw new Error('Nenhuma janela operacional ativa encontrada');
      }
      
      // 2. Buscar operações planejadas da janela
      const timestamp = new Date().getTime();
      const responseOp = await fetch(`/api/unified/operacoes?janela_id=${janelaAtiva.id}&tipo=PLANEJADA&_t=${timestamp}`, {
        headers
      });
      
      if (!responseOp.ok) {
        throw new Error(`Erro na API de operações: ${responseOp.status}`);
      }
      const dataOp = await responseOp.json();
      
      if (!dataOp.success) {
        throw new Error('Erro ao carregar operações planejadas');
      }
      
      const operacoesPlanejadas = dataOp.data;
      
      // 3. Buscar participações das operações planejadas
      const todasParticipacoes: any[] = [];
      
      for (const operacao of operacoesPlanejadas) {
        try {
          const responseParticipacoes = await fetch(`/api/agendamento/operacoes/${operacao.id}/participacoes?_t=${timestamp}`, {
            headers
          });
          
          if (!responseParticipacoes.ok) {
            console.warn(`Erro na API de participações da operação ${operacao.id}: ${responseParticipacoes.status}`);
            continue;
          }
          const dataParticipacoes = await responseParticipacoes.json();
          
          if (dataParticipacoes.success && dataParticipacoes.data) {
            const participacoesComOperacao = dataParticipacoes.data.map((p: any) => ({
              ...p,
              operacao_id: operacao.id,
              data_operacao: operacao.data_operacao || operacao.dataOperacao
            }));
            todasParticipacoes.push(...participacoesComOperacao);
          }
        } catch (error) {
          console.error(`Erro ao carregar participações da operação ${operacao.id}:`, error);
        }
      }
      
      // 4. PROCESSAR DADOS IGUAL À TabelaOperacoesDiretoria
      const participacoesConfirmadas = todasParticipacoes.filter(p => {
        const isAtiva = p.ativa === true;
        const isConfirmada = ['CONFIRMADO', 'ADICIONADO_SUP'].includes(p.estado_visual);
        const hasOperacao = p.operacao_id && p.data_operacao;
        return isAtiva && isConfirmada && hasOperacao;
      });
      
      if (participacoesConfirmadas.length === 0) {
        // Sem dados - criar planilha vazia
        // Obter informação da regional do supervisor
        const supervisorData = getSupervisorData();
        const nomeRegional = supervisorData?.regional?.nome || 'Regional não identificada';
        
        const data: any[][] = [
          ['', '', '', '', '', ''], // Linha em branco para o cabeçalho
          ['', '', '', '', '', ''], // Linha em branco
          ['', '', '', '', '', ''], // Linha em branco
          ['', '', '', '', '', ''], // Segunda linha em branco
          [`REGIONAL: ${nomeRegional}`, '', '', '', '', ''], // Regional na coluna A normal
          ['', '', '', '', '', ''],
          ['Nenhuma operação planejada encontrada', '', '', '', '', '']
        ];
        
        // Calcular larguras automáticas das colunas baseadas no conteúdo
        const autoColWidths = calculateAutoColumnWidths(data);
        
        const worksheetData: WorksheetData = {
          name: 'Diretoria',
          data,
          style: { 'A1': 'background-color: #1e40af; color: white; font-weight: bold; text-align: center; font-size: 14px;' },
          originalStyle: {},
          detranStyle: {},
          colWidths: autoColWidths,
          rowHeights: Array(data.length).fill(25)
        };
        
        setWorksheetsData([worksheetData]);
        setLoading(false);
        return;
      }
      
      // 5. Agrupar participações por servidor
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
      }, {} as Record<number, any>);
      
      // 6. Calcular períodos consecutivos (PORTARIA MOR)
      const portarias: any[] = [];
      
      Object.entries(participacoesPorServidor).forEach(([servidorIdStr, dados]: [string, any]) => {
        const servidorId = Number(servidorIdStr);
        
        // Ordenar participações por data
        const datasOperacao = dados.participacoes
          .map((p: any) => p.data_operacao)
          .sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
        
        // Agrupar em sequências consecutivas
        const sequenciasPortaria: string[][] = [];
        let sequenciaAtual: string[] = [];
        let dataAnterior: Date | null = null;
        
        datasOperacao.forEach((data_operacao: string) => {
          const dataAtual = new Date(data_operacao + 'T00:00:00-03:00');
          
          if (dataAnterior === null || (dataAtual.getTime() - dataAnterior.getTime()) === 24 * 60 * 60 * 1000) {
            sequenciaAtual.push(data_operacao);
          } else {
            if (sequenciaAtual.length > 0) {
              sequenciasPortaria.push([...sequenciaAtual]);
            }
            sequenciaAtual = [data_operacao];
          }
          
          dataAnterior = dataAtual;
        });
        
        if (sequenciaAtual.length > 0) {
          sequenciasPortaria.push([...sequenciaAtual]);
        }
        
        // Criar PORTARIA MOR para cada sequência
        sequenciasPortaria.forEach(sequencia => {
          const diasOperacao = sequencia.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
          
          const ultimaDataOperacao = new Date(diasOperacao[diasOperacao.length - 1] + 'T00:00:00-03:00');
          const dataRetorno = new Date(ultimaDataOperacao.getTime() + 24 * 60 * 60 * 1000);
          
          const qtdDias = diasOperacao.length;
          const sequenciaStr = 'D'.repeat(qtdDias) + '+1';
          
          const dataInicioCorreta = new Date(diasOperacao[0] + 'T00:00:00-03:00');
          const periodo = `${dataInicioCorreta.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} a ${dataRetorno.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
          
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
      
      // 7. Agrupar PORTARIA MOR por período
      const grupos = portarias.reduce((acc, portaria) => {
        if (!acc[portaria.chaveAgrupamento]) {
          acc[portaria.chaveAgrupamento] = {
            periodo: portaria.periodo,
            sequencia: portaria.sequencia,
            servidores: []
          };
        }
        
        acc[portaria.chaveAgrupamento].servidores.push(portaria);
        return acc;
      }, {} as Record<string, any>);
      
      // 8. Ordenar períodos cronologicamente
      const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
        const dataA = new Date((a as any).periodo.split(' a ')[0].split('/').reverse().join('-'));
        const dataB = new Date((b as any).periodo.split(' a ')[0].split('/').reverse().join('-'));
        return dataA.getTime() - dataB.getTime();
      });
      
      // 9. Gerar dados da planilha
      // Obter informação da regional do supervisor
      const supervisorData = getSupervisorData();
      const nomeRegional = supervisorData?.regional?.nome || 'Regional não identificada';
      
      const data: any[][] = [
        ['', '', '', '', '', ''], // Linha em branco para o cabeçalho
        ['', '', '', '', '', ''], // Linha em branco
        ['', '', '', '', '', ''], // Linha em branco
        ['', '', '', '', '', ''], // Segunda linha em branco
        [`REGIONAL: ${nomeRegional}`, '', '', '', '', ''], // Regional na coluna A normal
        ['', '', '', '', '', '']
      ];
      
      const detranStyle: Record<string, string> = {
        'A1': 'background-color: white; color: black; font-weight: bold; text-align: center; font-size: 12px;',
        'A2': 'background-color: white; color: black; font-weight: bold; text-align: center; font-size: 12px;',
        'A5': 'background-color: white; color: black; text-align: left; font-size: 10px;' // Regional alinhada à esquerda, sem negrito
      };
      
      let currentRow = 7;
      
      gruposOrdenados.forEach(([chave, grupo]) => {
        // Cabeçalho do período com Local na mesma linha
        data.push([`Período: ${(grupo as any).periodo}`, 'Local:', '', '', '', '']);
        detranStyle[`A${currentRow}`] = 'background-color: #fde047; color: black; font-weight: bold; text-align: left;';
        detranStyle[`B${currentRow}`] = 'background-color: #fde047; color: black; font-weight: bold; text-align: left;';
        currentRow++;
        
        // Cabeçalho da tabela (amarelo)
        data.push(['Servidor', 'Matrícula', 'Nº Viagem', 'Conc?', 'Rev?', 'Obs.']);
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
          detranStyle[`${col}${currentRow}`] = 'background-color: #fde047; color: black; font-weight: bold; text-align: center;';
        });
        currentRow++;
        
        // Ordenar servidores por nome
        const servidoresOrdenados = (grupo as any).servidores.sort((a: any, b: any) => a.nome.localeCompare(b.nome));
        
        // Dados dos servidores
        servidoresOrdenados.forEach((servidor: any) => {
          data.push([
            servidor.nome,
            servidor.matricula,
            '', // Nº Viagem (em branco)
            '', // Conc? (em branco)
            '', // Rev? (em branco)
            ''  // Obs. (em branco)
          ]);
          currentRow++;
        });
        
        // Linha em branco entre períodos
        data.push(['', '', '', '', '', '']);
        currentRow++;
      });
      
      // Calcular larguras automáticas das colunas baseadas no conteúdo
      const autoColWidths = calculateAutoColumnWidths(data);
      
      const worksheetData: WorksheetData = {
        name: 'Diretoria',
        data,
        style: detranStyle,
        originalStyle: {},
        detranStyle,
        colWidths: autoColWidths,
        rowHeights: Array(data.length).fill(25)
      };

      setWorksheetsData([worksheetData]);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados da diretoria');
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      if (worksheetsData.length === 0) return;
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Diretoria');
      
      // Adicionar cabeçalho com imagem
      const imageBuffer = await fetch('/cabeçalho.png').then(res => res.arrayBuffer());
      const imageId = workbook.addImage({
        buffer: imageBuffer,
        extension: 'png',
      });
      
      // Inserir linha vazia para o cabeçalho
      const headerRow = worksheet.addRow(['', '', '', '', '', '']);
      
      // Mesclar células A1:F1 para o cabeçalho
      worksheet.mergeCells('A1:F1');
      
      // Adicionar a imagem na célula mesclada A1:F1
      worksheet.addImage(imageId, 'A1:F1');
      
      // Definir altura da linha do cabeçalho
      worksheet.getRow(1).height = 80;
      
      // Adicionar linha vazia após o cabeçalho
      const linha2 = worksheet.addRow(['', '', '', '', '', '']);
      
      // Formatar linha 2 (linha vazia) com bordas visíveis
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        const cell = worksheet.getCell(`${col}2`);
        cell.font = { name: 'Arial', size: 10 };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Adicionar dados (começando da linha 3)
      const currentData = worksheetsData[currentWorksheet];
      currentData.data.forEach((row, rowIndex) => {
        const excelRow = worksheet.addRow(row);
        
        // Aplicar estilos para cada célula
        row.forEach((cell, colIndex) => {
          const cellRef = String.fromCharCode(65 + colIndex) + (rowIndex + 1);
          const style = currentData.style[cellRef];
          const excelCell = excelRow.getCell(colIndex + 1);
          
          // Definir fonte padrão Arial 10pt para todas as células
          excelCell.font = { name: 'Arial', size: 10 };
          
          // Aplicar bordas para todas as células
          excelCell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          
          // Aplicar formatação específica para as células A1 e A2 (linhas fixas)
          if (cellRef === 'A1' || cellRef === 'A2') {
            excelCell.font = { name: 'Arial', size: 12, bold: true };
            excelCell.alignment = { horizontal: 'center' };
          }
          

          
          if (style) {
            // Aplicar cor de fundo e estilos específicos
            if (style.includes('background-color: #1e40af')) {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E40AF' }
              };
              excelCell.font = { name: 'Arial', size: 14, color: { argb: 'FFFFFFFF' }, bold: true };
            } else if (style.includes('background-color: #3b82f6')) {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF3B82F6' }
              };
              excelCell.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
            } else if (style.includes('background-color: #6b7280')) {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF6B7280' }
              };
              excelCell.font = { name: 'Arial', size: 10, color: { argb: 'FFFFFFFF' }, bold: true };
            } else if (style.includes('background-color: #fde047')) {
              excelCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFDE047' }
              };
              excelCell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' }, bold: true };
            }
            
            // Aplicar alinhamento
            if (style.includes('text-align: center')) {
              excelCell.alignment = { horizontal: 'center' };
            } else if (style.includes('text-align: left')) {
              excelCell.alignment = { horizontal: 'left' };
            }
          }
        });
        
        // Mesclar células B até F para linhas que contêm "Local:"
        if (row[1] === 'Local:') {
          const excelRowIndex = excelRow.number; // Usar o número da linha do Excel diretamente
          worksheet.mergeCells(`B${excelRowIndex}:F${excelRowIndex}`);
          
          // Aplicar estilo à célula mesclada
          const mergedCell = worksheet.getCell(`B${excelRowIndex}`);
          mergedCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFDE047' }
          };
          mergedCell.font = { name: 'Arial', size: 10, color: { argb: 'FF000000' }, bold: true };
          mergedCell.alignment = { horizontal: 'left' };
        }
      });
      
      // Aplicar bordas para a linha 3 (linha vazia acima de "Planilha para pedidos de diárias")
      ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
        const cell = worksheet.getCell(`${col}3`);
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      // Mesclar células das linhas fixas
      worksheet.mergeCells('A3:F3'); // "Planilha para pedidos de diárias" (linha 3 na contagem do Excel)
      worksheet.mergeCells('A4:F4'); // "Setor: Núcleo de Fiscalização (NUFIS)" (linha 4 na contagem do Excel)
      // Não mesclar a linha da regional - ela fica apenas na coluna A
      
      // Aplicar estilos às células mescladas das linhas fixas
      const linha3Cell = worksheet.getCell('A3'); // "Planilha para pedidos de diárias"
      linha3Cell.value = 'Planilha para pedidos de diárias'; // Definir o texto correto
      linha3Cell.font = { name: 'Arial', size: 12, bold: true };
      linha3Cell.alignment = { horizontal: 'center' };
      linha3Cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      const linha4Cell = worksheet.getCell('A4'); // "Setor: Núcleo de Fiscalização (NUFIS)"
      linha4Cell.value = 'Setor: Núcleo de Fiscalização (NUFIS)'; // Definir o texto correto
      linha4Cell.font = { name: 'Arial', size: 12, bold: true };
      linha4Cell.alignment = { horizontal: 'center' };
      linha4Cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      
      // Estilo para a célula da regional (linha 8, apenas coluna A)
      const linha8Cell = worksheet.getCell('A8');
      linha8Cell.font = { name: 'Arial', size: 10, bold: false }; // Não negrito conforme solicitado
      linha8Cell.alignment = { horizontal: 'left' }; // Alinhado à esquerda
      linha8Cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };

      
      // Auto-ajustar largura das colunas baseado no conteúdo
      const autoAdjustColumnWidths = () => {
        const columnWidths: number[] = [];
        const numColumns = currentData.data[0]?.length || 6;
        
        // Calcular largura ideal para cada coluna
        for (let colIndex = 0; colIndex < numColumns; colIndex++) {
          let maxWidth = 8; // Largura mínima
          
          // Verificar todas as linhas para encontrar o conteúdo mais longo
          currentData.data.forEach((row, rowIndex) => {
            const cellValue = String(row[colIndex] || '');
            let cellWidth = cellValue.length;
            
            // Ajustar para caracteres especiais e formatação
            if (cellValue.includes('Local:') || cellValue.includes('Setor:') || cellValue.includes('REGIONAL:')) {
              cellWidth = cellWidth * 1.2; // Texto em negrito ocupa mais espaço
            }
            
            maxWidth = Math.max(maxWidth, cellWidth);
          });
          
          // Aplicar folga extra para colunas específicas
          if (colIndex === 0) { // Coluna A - Nome (folga maior)
            maxWidth = Math.max(maxWidth * 1.3, 20); // Mínimo 20, folga de 30%
          } else if (colIndex === 1) { // Coluna B - Matrícula (folga maior)
            maxWidth = Math.max(maxWidth * 1.25, 15); // Mínimo 15, folga de 25%
          } else {
            maxWidth = Math.max(maxWidth * 1.1, 12); // Outras colunas: folga de 10%
          }
          
          // Limitar largura máxima para evitar colunas muito largas
          maxWidth = Math.min(maxWidth, 50);
          
          columnWidths.push(maxWidth);
        }
        
        return columnWidths;
      };
      
      // Aplicar larguras auto-ajustadas
      const adjustedWidths = autoAdjustColumnWidths();
      adjustedWidths.forEach((width, index) => {
        worksheet.getColumn(index + 1).width = width;
      });
      
      // Garantir que a imagem do cabeçalho se ajuste perfeitamente às colunas A-F
      const totalWidth = adjustedWidths.slice(0, 6).reduce((sum, width) => sum + width, 0);
      
      // Ajustar proporcionalmente as 6 primeiras colunas para manter a imagem bem posicionada
      const targetTotalWidth = 80; // Largura ideal total para as 6 colunas
      const scaleFactor = targetTotalWidth / totalWidth;
      
      for (let i = 0; i < 6; i++) {
        if (adjustedWidths[i]) {
          worksheet.getColumn(i + 1).width = adjustedWidths[i] * scaleFactor;
        }
      }
      
      // Gerar arquivo
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      
      // Download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Erro ao exportar:', error);
      alert('Erro ao exportar planilha');
    }
  };

  const printSpreadsheet = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Bloqueador de pop-up ativo. Permita pop-ups para imprimir.');
        return;
      }
      
      const currentData = worksheetsData[currentWorksheet];
      
      let html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>${fileName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { border-collapse: collapse; width: 100%; }
            td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
            .header { background-color: #1e40af; color: white; font-weight: bold; text-align: center; }
            .subheader { background-color: #3b82f6; color: white; font-weight: bold; text-align: center; }
            .tableheader { background-color: #6b7280; color: white; font-weight: bold; text-align: center; }
            .yellow { background-color: #fde047; color: black; font-weight: bold; text-align: center; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <table>
      `;
      
      currentData.data.forEach((row, rowIndex) => {
        html += '<tr>';
        row.forEach((cell, colIndex) => {
          const cellRef = String.fromCharCode(65 + colIndex) + (rowIndex + 1);
          const style = currentData.style[cellRef];
          
          let className = '';
          if (style) {
            if (style.includes('background-color: #1e40af')) className = 'header';
            else if (style.includes('background-color: #3b82f6')) className = 'subheader';
            else if (style.includes('background-color: #6b7280')) className = 'tableheader';
            else if (style.includes('background-color: #fde047')) className = 'yellow';
          }
          
          html += `<td class="${className}">${cell || ''}</td>`;
        });
        html += '</tr>';
      });
      
      html += `
          </table>
        </body>
        </html>
      `;
      
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      alert('Erro ao imprimir planilha');
    }
  };

  const refreshData = () => {
    loadDiretoriaData();
  };

  useEffect(() => {
    // ✅ VERIFICAÇÃO DE AUTENTICAÇÃO: Garantir que o supervisor está autenticado
    if (!isSupervisorAuthenticated()) {
      setError('Acesso não autorizado. Faça login como supervisor.');
      setLoading(false);
      return;
    }
    
    loadDiretoriaData();
  }, []);

  // Auto-ajustar colunas após carregamento da planilha
  useEffect(() => {
    if (worksheetsData.length > 0 && spreadsheetRef.current) {
      const timer = setTimeout(() => {
        try {
          const spreadsheet = spreadsheetRef.current;
          if (spreadsheet && spreadsheet.jspreadsheet && spreadsheet.jspreadsheet[0]) {
            const jss = spreadsheet.jspreadsheet[0];
            
            // Auto-ajustar todas as colunas
            const numCols = jss.options.data[0]?.length || 6;
            for (let col = 0; col < numCols; col++) {
              // Simular duplo clique para auto-ajuste
              if (jss.setWidth) {
                jss.setWidth(col, null, true); // true para auto-ajuste
              }
            }
            
            // Forçar re-render
            if (jss.refresh) {
              jss.refresh();
            }
          }
        } catch (error) {
          console.log('Auto-ajuste aplicado via método alternativo');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [worksheetsData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        {/* Container de Loading Elegante */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 shadow-2xl border border-white/20 max-w-md w-full mx-4">
          <div className="text-center">
            {/* Ícone da Planilha */}
            <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-4xl">📊</span>
            </div>
            
            {/* Spinner Elegante */}
            <div className="relative mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/30 border-t-white mx-auto"></div>
              <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse"></div>
            </div>
            
            {/* Texto de Loading */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white">Planilha de Diárias</h2>
              <p className="text-white/80 text-lg">Carregando dados...</p>
              <div className="flex items-center justify-center space-x-1 mt-4">
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 flex items-center justify-center">
        {/* Container de Erro Elegante */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-12 shadow-2xl border border-white/20 max-w-md w-full mx-4">
          <div className="text-center">
            {/* Ícone de Erro */}
            <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <span className="text-4xl">❌</span>
            </div>
            
            {/* Título e Mensagem */}
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-white">Ops! Algo deu errado</h2>
              <p className="text-white/80 text-lg">Não foi possível carregar a planilha</p>
              <div className="bg-red-500/20 rounded-lg p-4 border border-red-400/30">
                <p className="text-red-100 text-sm">{error}</p>
              </div>
              
              {/* Botões de Ação */}
              <div className="flex flex-col gap-3 mt-6">
                <button
                  onClick={() => window.location.reload()}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-colors duration-200 font-medium flex items-center gap-2 justify-center"
                >
                  🔄 Tentar Novamente
                </button>
                
                <Link 
                  href="/supervisor/diretoria"
                  className="px-6 py-3 bg-blue-500/20 hover:bg-blue-500/30 text-white rounded-lg transition-colors duration-200 font-medium flex items-center gap-2 justify-center"
                >
                  ← Voltar para Diretoria
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentData = worksheetsData[currentWorksheet];
  
  const getEffectiveStyle = () => {
    if (useDetranStyle) {
      return currentData.detranStyle;
    } else {
      return Object.keys(currentData.originalStyle).length > 0 
        ? currentData.originalStyle 
        : currentData.style;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
      {/* Interface Simplificada - Apenas os dois botões essenciais */}
      <div className="flex flex-col items-center justify-center min-h-screen gap-8">
        {/* Título discreto */}
        <h1 className="text-white text-2xl font-bold mb-8">📊 Planilha de Diárias</h1>
        
        {/* Container dos dois botões principais */}
        <div className="flex flex-col gap-6">
          {/* Botão Principal - Exportar Excel */}
          <button
            onClick={exportToExcel}
            className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors duration-200 font-medium text-lg flex items-center gap-3 shadow-lg"
            title="Baixar planilha em Excel"
          >
            📊 Baixar Planilha Excel
          </button>
          
          {/* Botão Secundário - Voltar */}
          <Link 
            href="/supervisor/diretoria"
            className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors duration-200 font-medium text-lg flex items-center gap-3 backdrop-blur shadow-lg justify-center"
          >
            ← Voltar para Diretoria
          </Link>
        </div>
      </div>

      {/* Elementos ocultos mas funcionais - mantém todas as funcionalidades */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', visibility: 'hidden' }}>
        {/* Header oculto mas funcional */}
        <div className="max-w-7xl mx-auto" style={{padding: 'clamp(8px, 2vw, 16px) clamp(12px, 3vw, 24px)', boxSizing: 'border-box'}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'clamp(4px, 1vw, 8px)', flexWrap: 'nowrap'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 16px)', flex: '1 1 0%', minWidth: '0px'}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 'clamp(4px, 1vw, 8px)', flexShrink: 0}}>
                <div className="bg-white/20 rounded-lg flex items-center justify-center" style={{width: 'clamp(24px, 5vw, 32px)', height: 'clamp(24px, 5vw, 32px)', borderRadius: 'clamp(4px, 1vw, 8px)'}}>
                  <span style={{fontSize: 'clamp(0.8rem, 2.5vw, 1.2rem)'}}>🎯</span>
                </div>
                <h1 className="font-bold text-white" style={{fontSize: 'clamp(0.7rem, 2.5vw, 1.1rem)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: '0px'}}>Portal do Supervisor</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Card da Planilha oculto mas funcional */}
        <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
          {/* Header da Planilha oculto */}
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center">
                    📊 {fileName}
                    <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      🎨 Com Formatação
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {currentData.data.length} linhas × {currentData.data[0]?.length || 0} colunas
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {/* Botões ocultos mas funcionais */}
                <button
                  onClick={() => setUseDetranStyle(!useDetranStyle)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    useDetranStyle
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {useDetranStyle ? '🎨 Estilo DETRAN' : '📋 Formatação Original'}
                </button>
                
                <button
                  onClick={printSpreadsheet}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  title="Imprimir planilha"
                >
                  🖨️ Imprimir
                </button>
                
                <button
                  onClick={refreshData}
                  className="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
                  title="Atualizar dados"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>
          </div>

          {/* Conteúdo da Planilha oculto mas funcional */}
          <div className="p-4" style={{ height: '70vh', overflow: 'auto' }}>
            <Spreadsheet 
              ref={spreadsheetRef}
              toolbar={[
                'undo', 'redo', '|', 
                'font', 'font-size', '|',
                'bold', 'italic', '|',
                'font-color', 'background-color', '|',
                'align-left', 'align-center', 'align-right', '|',
                'border-all', 'border-outside', 'border-inside', '|',
                'save'
              ]}
              search={true}
              fullscreen={false}
              lazyLoading={true}
              loadingSpin={true}
            >
              <Worksheet 
                data={currentData.data}
                style={getEffectiveStyle()}
                colWidths={currentData.colWidths}
                rowHeights={currentData.rowHeights}
                minDimensions={[currentData.data[0]?.length || 10, currentData.data.length || 20]}
                tableOverflow={true}
                tableWidth="100%"
                tableHeight="100%"
                freezeColumns={0}
                columnSorting={false}
                columnDrag={false}
                rowDrag={false}
                editable={false}
                allowInsertRow={false}
                allowInsertColumn={false}
                allowDeleteRow={false}
                allowDeleteColumn={false}
                contextMenu={false}
                csvFileName={fileName.replace('.xlsx', '')}
                aboutThisSoftware={false}
                copyCompatibility={false}
                persistance={false}
                parseFormulas={true}
                readOnly={false}
                selection={true}
                selectionCopy={false}
              />
            </Spreadsheet>
          </div>

          {/* Footer da Planilha oculto */}
          <div className="p-3 border-t border-gray-200 bg-gray-50 text-sm">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-4">
                <span className="text-green-600 font-medium">
                  ✅ {useDetranStyle ? 'Estilo DETRAN Aplicado' : 'Formatação Original Preservada'}
                </span>
                <span className="text-gray-600">Sheet: <strong>{currentData.name}</strong></span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  useDetranStyle 
                    ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {useDetranStyle ? '🎨 DETRAN Style' : '📋 Original Style'}
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  📏 Dimensões
                </span>
                <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                  🔧 Editável
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
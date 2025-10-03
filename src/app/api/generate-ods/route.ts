import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx-js-style';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import JSZip from 'jszip';
import { parseString, Builder } from 'xml2js';

async function addHeaderImageToODS(filePath: string): Promise<void> {
  console.log('🖼️ Adicionando imagem do cabeçalho na célula mesclada...');
  
  try {
    // Ler o arquivo ODS
    const odsBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(odsBuffer);
    
    // Carregar a imagem do cabeçalho
    const imagePath = path.join(process.cwd(), 'public', 'cabeçalho.png');
    if (!fs.existsSync(imagePath)) {
      console.log('⚠️ Imagem cabeçalho.png não encontrada, pulando...');
      return;
    }
    
    const imageBuffer = fs.readFileSync(imagePath);
    console.log('📷 Imagem carregada:', imagePath, '- Tamanho:', imageBuffer.length, 'bytes');
    
    // Adicionar a imagem ao ZIP do ODS
    zip.file('Pictures/cabeçalho.png', imageBuffer);
    
    // Extrair content.xml
    const contentXml = await zip.file('content.xml')?.async('string');
    if (!contentXml) {
      throw new Error('content.xml não encontrado no arquivo ODS');
    }
    
    // Parse do XML
    const parseXml = (xml: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        parseString(xml, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
    
    const contentObj = await parseXml(contentXml);
    
    // Acessar a primeira tabela
    const spreadsheet = contentObj['office:document-content']['office:body'][0]['office:spreadsheet'][0];
    const table = spreadsheet['table:table'][0];
    const rows = table['table:table-row'];
    
    if (rows && rows.length > 0) {
      // Inserir nova linha no início para o cabeçalho com imagem
      const headerRowWithImage = {
        '$': {
          'table:style-name': 'HeaderRowStyle'
        },
        'table:table-cell': [{
          '$': {
            'table:number-columns-spanned': '6',
            'table:style-name': 'HeaderCellWithImage'
          },
          'text:p': [''],
          'draw:frame': [{
            '$': {
              'draw:name': 'HeaderImage',
              'draw:style-name': 'HeaderImageStyle',
              'text:anchor-type': 'cell',
              'svg:width': '18.6cm',
              'svg:height': '3.3cm',
              'svg:x': '0cm',
              'svg:y': '0cm'
            },
            'draw:image': [{
              '$': {
                'xlink:href': 'Pictures/cabeçalho.png',
                'xlink:type': 'simple',
                'xlink:show': 'embed',
                'xlink:actuate': 'onLoad'
              }
            }]
          }]
        }]
      };
      
      // Adicionar células cobertas para completar a mesclagem A1:F1
      if (!headerRowWithImage['table:covered-table-cell']) {
        headerRowWithImage['table:covered-table-cell'] = [];
      }
      for (let i = 1; i < 6; i++) {
        headerRowWithImage['table:covered-table-cell'].push({});
      }
      
      // Inserir apenas a linha do cabeçalho (sem linha vazia extra)
      rows.unshift(headerRowWithImage);
      
      // Aplicar mesclagens nas linhas fixas (agora nas posições corretas)
      // Linha 2 (índice 1): "Planilha para pedidos de diárias"
      if (rows[1] && rows[1]['table:table-cell'] && rows[1]['table:table-cell'].length > 0) {
        const linha2Cell = rows[1]['table:table-cell'][0];
        linha2Cell['$'] = linha2Cell['$'] || {};
        linha2Cell['$']['table:number-columns-spanned'] = '6';
        linha2Cell['$']['table:style-name'] = 'HeaderCell';
        
        // Definir o conteúdo da célula
        linha2Cell['text:p'] = ['Planilha para pedidos de diárias'];
        
        // Remover células extras e manter apenas a primeira
        rows[1]['table:table-cell'] = [linha2Cell];
        
        // Adicionar células cobertas
        if (!rows[1]['table:covered-table-cell']) {
          rows[1]['table:covered-table-cell'] = [];
        }
        for (let i = 1; i < 6; i++) {
          rows[1]['table:covered-table-cell'].push({});
        }
      }
      
      // Linha 3 (índice 2): "Setor: Núcleo de Fiscalização (NUFIS)"
      if (rows[2] && rows[2]['table:table-cell'] && rows[2]['table:table-cell'].length > 0) {
        const linha3Cell = rows[2]['table:table-cell'][0];
        linha3Cell['$'] = linha3Cell['$'] || {};
        linha3Cell['$']['table:number-columns-spanned'] = '6';
        linha3Cell['$']['table:style-name'] = 'HeaderCell';
        
        // Definir o conteúdo da célula
        linha3Cell['text:p'] = ['Setor: Núcleo de Fiscalização (NUFIS)'];
        
        // Remover células extras e manter apenas a primeira
        rows[2]['table:table-cell'] = [linha3Cell];
        
        // Adicionar células cobertas
        if (!rows[2]['table:covered-table-cell']) {
          rows[2]['table:covered-table-cell'] = [];
        }
        for (let i = 1; i < 6; i++) {
          rows[2]['table:covered-table-cell'].push({});
        }
      }
      
      // Remover essas informações dos dados originais (a partir da linha 4)
      for (let i = 3; i < rows.length; i++) {
        if (rows[i] && rows[i]['table:table-cell']) {
          rows[i]['table:table-cell'].forEach((cell: any) => {
            if (cell['text:p']) {
              const cellText = cell['text:p'][0];
              if (typeof cellText === 'string') {
                if (cellText.includes('Planilha para pedidos de diárias') || 
                    cellText.includes('Setor: Núcleo de Fiscalização')) {
                  cell['text:p'] = [''];
                }
              }
            }
          });
        }
      }
      
      console.log('✅ Linhas de cabeçalho inseridas e mesclagens aplicadas. Total de linhas agora:', rows.length);
    }
    
    // Adicionar estilos necessários para a imagem e célula mesclada
    const automaticStyles = contentObj['office:document-content']['office:automatic-styles'][0];
    
    if (!automaticStyles['style:style']) {
      automaticStyles['style:style'] = [];
    }
    
    // Estilo para a linha do cabeçalho (altura aumentada)
    const headerRowStyle = {
      '$': {
        'style:name': 'HeaderRowStyle',
        'style:family': 'table-row'
      },
      'style:table-row-properties': [{
        '$': {
          'style:row-height': '3.3cm'
        }
      }]
    };
    
    // Estilo para linhas padrão
    const defaultRowStyle = {
      '$': {
        'style:name': 'DefaultRowStyle',
        'style:family': 'table-row'
      },
      'style:table-row-properties': [{
        '$': {
          'style:row-height': '0.5cm' // Altura padrão
        }
      }]
    };
    
    // Estilo para a célula com imagem (sem padding para preenchimento completo)
    const headerCellWithImageStyle = {
      '$': {
        'style:name': 'HeaderCellWithImage',
        'style:family': 'table-cell'
      },
      'style:table-cell-properties': [{
        '$': {
          'fo:border': '0.5pt solid #000000',
          'style:vertical-align': 'top',
          'fo:padding': '0cm',
          'style:shrink-to-fit': 'false'
        }
      }],
      'style:paragraph-properties': [{
        '$': {
          'fo:text-align': 'left',
          'style:vertical-align': 'top'
        }
      }]
    };
    
    // Estilo para a imagem (preenchimento completo)
    const headerImageStyle = {
      '$': {
        'style:name': 'HeaderImageStyle',
        'style:family': 'graphic'
      },
      'style:graphic-properties': [{
        '$': {
          'style:vertical-pos': 'top',
          'style:vertical-rel': 'cell',
          'style:horizontal-pos': 'left',
          'style:horizontal-rel': 'cell',
          'style:wrap': 'none',
          'style:run-through': 'foreground',
          'fo:margin-left': '0cm',
          'fo:margin-right': '0cm',
          'fo:margin-top': '0cm',
          'fo:margin-bottom': '0cm',
          'style:flow-with-text': 'false',
          'fo:padding': '0cm'
        }
      }]
    };
    
    // Adicionar os novos estilos
    automaticStyles['style:style'].push(headerRowStyle, defaultRowStyle, headerCellWithImageStyle, headerImageStyle);
    
    // Gerar o XML modificado
    const xmlString = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: false }
    }).buildObject(contentObj);
    
    // Atualizar o arquivo no ZIP
    zip.file('content.xml', xmlString);
    
    // Atualizar manifest.xml para incluir a imagem
    const manifestXml = await zip.file('META-INF/manifest.xml')?.async('string');
    if (manifestXml) {
      // Adicionar entrada para a imagem no manifest
      const updatedManifest = manifestXml.replace(
        '</manifest:manifest>',
        '  <manifest:file-entry manifest:full-path="Pictures/cabeçalho.png" manifest:media-type="image/png"/>\n</manifest:manifest>'
      );
      zip.file('META-INF/manifest.xml', updatedManifest);
    }
    
    // Salvar o arquivo modificado
    const newOdsBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, newOdsBuffer);
    
    console.log('✅ Imagem do cabeçalho adicionada com sucesso na célula mesclada!');
    
  } catch (error: any) {
    console.error('❌ Erro ao adicionar imagem do cabeçalho:', error.message);
    throw error;
  }
}

async function applyCompleteFormatting(filePath: string): Promise<void> {
  console.log('🎨 Aplicando formatação completa no ODS (bordas, fontes e cores)...');
  
  try {
    // Ler o arquivo ODS
    const odsBuffer = fs.readFileSync(filePath);
    const zip = await JSZip.loadAsync(odsBuffer);
    
    // Extrair content.xml
    const contentXml = await zip.file('content.xml')?.async('string');
    if (!contentXml) {
      throw new Error('content.xml não encontrado no arquivo ODS');
    }
    
    // Parse do XML
    const parseXml = (xml: string): Promise<any> => {
      return new Promise((resolve, reject) => {
        parseString(xml, (err, result) => {
          if (err) reject(err);
          else resolve(result);
        });
      });
    };
    
    const contentObj = await parseXml(contentXml);
    
    // Adicionar estilos
    const automaticStyles = contentObj['office:document-content']['office:automatic-styles'][0];
    
    if (!automaticStyles['style:style']) {
      automaticStyles['style:style'] = [];
    }
    
    // Estilos de coluna com larguras específicas
    const columnAStyle = {
      '$': {
        'style:name': 'ColumnA',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '8.5cm' // Largura bem maior para nomes longos
        }
      }]
    };
    
    const columnBStyle = {
      '$': {
        'style:name': 'ColumnB',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '3cm' // Largura padrão
        }
      }]
    };
    
    const columnCStyle = {
      '$': {
        'style:name': 'ColumnC',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '2.1cm' // Largura padrão
        }
      }]
    };
    
    const columnDStyle = {
      '$': {
        'style:name': 'ColumnD',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '2cm' // Largura padrão
        }
      }]
    };
    
    const columnEStyle = {
      '$': {
        'style:name': 'ColumnE',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '1.5cm' // Largura padrão
        }
      }]
    };
    
    const columnFStyle = {
      '$': {
        'style:name': 'ColumnF',
        'style:family': 'table-column'
      },
      'style:table-column-properties': [{
        '$': {
          'style:column-width': '1.5cm' // Largura padrão
        }
      }]
    };
    
    // 1. Estilo padrão com bordas pretas e Arial 10pt
    const defaultCellStyle = {
      '$': {
        'style:name': 'DefaultCell',
        'style:family': 'table-cell',
        'style:parent-style-name': 'Default'
      },
      'style:table-cell-properties': [{
        '$': {
          'fo:border': '0.5pt solid #000000'
        }
      }],
      'style:text-properties': [{
        '$': {
          'style:font-name': 'Arial',
          'fo:font-size': '10pt'
        }
      }]
    };
    
    // 2. Estilo para cabeçalhos (Arial 12pt negrito, centralizado)
    const headerCellStyle = {
      '$': {
        'style:name': 'HeaderCell',
        'style:family': 'table-cell',
        'style:parent-style-name': 'Default'
      },
      'style:table-cell-properties': [{
        '$': {
          'fo:border': '0.5pt solid #000000',
          'style:vertical-align': 'middle'
        }
      }],
      'style:paragraph-properties': [{
        '$': {
          'fo:text-align': 'center'
        }
      }],
      'style:text-properties': [{
        '$': {
          'style:font-name': 'Arial',
          'fo:font-size': '12pt',
          'fo:font-weight': 'bold'
        }
      }]
    };
    
    // 3. Estilo amarelo com bordas pretas e Arial 10pt negrito
    const yellowCellStyle = {
      '$': {
        'style:name': 'YellowCell',
        'style:family': 'table-cell',
        'style:parent-style-name': 'Default'
      },
      'style:table-cell-properties': [{
        '$': {
          'fo:background-color': '#FFFF00',
          'fo:border': '0.5pt solid #000000'
        }
      }],
      'style:text-properties': [{
        '$': {
          'style:font-name': 'Arial',
          'fo:font-size': '10pt',
          'fo:font-weight': 'bold'
        }
      }]
    };
    
    // Adicionar todos os estilos
    automaticStyles['style:style'].push(
      columnAStyle, columnBStyle, columnCStyle, columnDStyle, columnEStyle, columnFStyle,
      defaultCellStyle, headerCellStyle, yellowCellStyle
    );
    
    // Aplicar formatação nas células
    const spreadsheet = contentObj['office:document-content']['office:body'][0]['office:spreadsheet'][0];
    const table = spreadsheet['table:table'][0];
    
    // Adicionar definições de coluna com larguras específicas
    if (!table['table:table-column']) {
      table['table:table-column'] = [];
    }
    
    // Limpar definições existentes e adicionar as novas
    table['table:table-column'] = [
      {
        '$': {
          'table:style-name': 'ColumnA'
        }
      },
      {
        '$': {
          'table:style-name': 'ColumnB'
        }
      },
      {
        '$': {
          'table:style-name': 'ColumnC'
        }
      },
      {
        '$': {
          'table:style-name': 'ColumnD'
        }
      },
      {
        '$': {
          'table:style-name': 'ColumnE'
        }
      },
      {
        '$': {
          'table:style-name': 'ColumnF'
        }
      }
    ];
    
    const rows = table['table:table-row'];
    
    let formattedRows = 0;
    let headerRows = 0;
    let totalCellsFormatted = 0;
    
    if (rows) {
      rows.forEach((row: any, rowIndex: number) => {
        if (row['table:table-cell']) {
          // Verificar se é linha de cabeçalho especial (contém "Planilha para pedidos" ou "Setor:")
          const isHeaderRow = row['table:table-cell'].some((cell: any) => {
            const cellText = cell['text:p']?.[0]?._ || cell['text:p']?.[0] || '';
            const cellValue = String(cellText).toLowerCase();
            return cellValue.includes('planilha para pedidos') || cellValue.includes('setor:');
          });
          
          // Verificar se é linha amarela (contém "Período" ou "Servidor")
          const isYellowRow = row['table:table-cell'].some((cell: any) => {
            const cellText = cell['text:p']?.[0]?._ || cell['text:p']?.[0] || '';
            const cellValue = String(cellText).toLowerCase();
            return cellValue.includes('período') || cellValue.includes('servidor');
          });
          
          // Verificar se é linha com "Local:" na coluna B (índice 1)
          const hasLocalInColumnB = row['table:table-cell'].length > 1 && 
            row['table:table-cell'][1] && 
            row['table:table-cell'][1]['text:p'] && 
            String(row['table:table-cell'][1]['text:p'][0] || '').includes('Local:');
          
          // Aplicar mesclagem para linhas com "Local:" na coluna B
          if (hasLocalInColumnB) {
            console.log(`🔗 Aplicando mesclagem na linha ${rowIndex + 1} (contém "Local:" na coluna B)`);
            
            // Mesclar células B até F (índices 1 a 5)
            const cellB = row['table:table-cell'][1];
            if (cellB) {
              cellB['$'] = cellB['$'] || {};
              cellB['$']['table:number-columns-spanned'] = '5'; // Mesclar B até F (5 colunas)
              cellB['$']['table:style-name'] = 'YellowCell';
              
              // Manter apenas células A e B, removendo C, D, E, F
              const cellA = row['table:table-cell'][0];
              row['table:table-cell'] = [cellA, cellB];
            }
          }
          
          // Aplicar formatação apropriada para TODAS as células
          row['table:table-cell'].forEach((cell: any, cellIndex: number) => {
            // Garantir que a célula tenha estrutura adequada
            if (typeof cell === 'object' && cell !== null) {
              cell['$'] = cell['$'] || {};
              
              if (isHeaderRow) {
                cell['$']['table:style-name'] = 'HeaderCell';
              } else if (isYellowRow) {
                cell['$']['table:style-name'] = 'YellowCell';
              } else if (!cell['$']['table:style-name']) { // Não sobrescrever se já tem estilo (como células mescladas)
                cell['$']['table:style-name'] = 'DefaultCell';
              }
              totalCellsFormatted++;
            } else if (typeof cell === 'string' || cell === undefined || cell === null) {
              // Converter células simples em objetos com estilo
              row['table:table-cell'][cellIndex] = {
                '$': {
                  'table:style-name': isHeaderRow ? 'HeaderCell' : (isYellowRow ? 'YellowCell' : 'DefaultCell')
                },
                'text:p': [cell || '']
              };
              totalCellsFormatted++;
            }
          });
          
          if (isHeaderRow) {
            console.log(`📋 Aplicando formatação de cabeçalho na linha ${rowIndex + 1}`);
            headerRows++;
          } else if (isYellowRow) {
            console.log(`🟡 Aplicando formatação amarela na linha ${rowIndex + 1}`);
            formattedRows++;
          }
        }
      });
    }
    
    console.log(`✅ Formatação aplicada: ${headerRows} cabeçalhos, ${formattedRows} linhas amarelas, ${totalCellsFormatted} células totais`);
    
    // Segunda passada: garantir que TODAS as células tenham estilos (incluindo as vazias criadas pelo XLSX)
    let additionalCellsFormatted = 0;
    if (rows) {
      rows.forEach((row: any, rowIndex: number) => {
        if (row['table:table-cell']) {
          row['table:table-cell'].forEach((cell: any, cellIndex: number) => {
            // Se a célula não tem estilo definido, aplicar DefaultCell
            if (!cell['$'] || !cell['$']['table:style-name']) {
              cell['$'] = cell['$'] || {};
              cell['$']['table:style-name'] = 'DefaultCell';
              additionalCellsFormatted++;
            }
          });
        }
      });
    }
    
    if (additionalCellsFormatted > 0) {
      console.log(`🔧 Aplicado estilo DefaultCell a ${additionalCellsFormatted} células adicionais sem estilo`);
    }

    // Excluir linhas 5, 6 e 7 (índices 4, 5, 6) para reduzir espaço vazio
    console.log('🗑️ Excluindo linhas 5, 6 e 7 para reduzir espaço vazio...');
    if (rows && rows.length > 6) {
      rows.splice(4, 3); // Remove 3 linhas a partir do índice 4 (linhas 5, 6, 7)
      console.log('✅ Linhas 5, 6 e 7 excluídas com sucesso');
    }
    
    // Gerar o XML modificado usando o Builder com as modificações das passadas anteriores
    let xmlString = new Builder({
      xmldec: { version: '1.0', encoding: 'UTF-8' },
      renderOpts: { pretty: false }
    }).buildObject(contentObj);
    
    // IMPORTANTE: O Builder pode recriar células vazias, então aplicamos a correção aqui
    console.log('🔍 Aplicando correção de células vazias no XML gerado pelo Builder...');
    
    // Corrigir células vazias no XML gerado pelo Builder
    let xmlEmptyCellsFormatted = 0;
    
    // Células auto-fechadas sem style-name
    const emptyCellsPattern1 = /<table:table-cell\s*\/>/g;
    const emptyCellsMatches1 = xmlString.match(emptyCellsPattern1);
    if (emptyCellsMatches1) {
      xmlString = xmlString.replace(emptyCellsPattern1, '<table:table-cell office:value-type="string" table:style-name="DefaultCell"></table:table-cell>');
      xmlEmptyCellsFormatted += emptyCellsMatches1.length;
    }
    
    // Células vazias com tags separadas
    const emptyCellsPattern2 = /<table:table-cell\s*><\/table:table-cell>/g;
    const emptyCellsMatches2 = xmlString.match(emptyCellsPattern2);
    if (emptyCellsMatches2) {
      xmlString = xmlString.replace(emptyCellsPattern2, '<table:table-cell office:value-type="string" table:style-name="DefaultCell"></table:table-cell>');
      xmlEmptyCellsFormatted += emptyCellsMatches2.length;
    }
    
    console.log(`🔧 Células vazias corrigidas no XML do Builder: ${xmlEmptyCellsFormatted} (auto-fechadas: ${emptyCellsMatches1?.length || 0}, com tags: ${emptyCellsMatches2?.length || 0})`);
    
    // Atualizar o arquivo no ZIP com o XML corrigido
    zip.file('content.xml', xmlString);
    
    // Salvar o arquivo modificado
    const newOdsBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(filePath, newOdsBuffer);
    
    console.log('✅ Arquivo ODS atualizado com formatação completa!');
    
  } catch (error: any) {
    console.error('❌ Erro ao aplicar formatação:', error.message);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 API generate-ods chamada');
    const { data, fileName } = await request.json();
    console.log('📊 Dados recebidos:', { dataLength: data?.length, fileName });
    
    if (!data || !fileName) {
      console.log('❌ Dados ou fileName ausentes');
      return NextResponse.json(
        { error: 'Dados e nome do arquivo são obrigatórios' },
        { status: 400 }
      );
    }
    
    // Criar arquivo ODS básico no servidor
    const workbook = XLSX.utils.book_new();
    
    // Converter dados para array de arrays se necessário
    let sheetData;
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      // Converter array de objetos para array de arrays
      const headers = Object.keys(data[0]);
      sheetData = [headers, ...data.map(row => headers.map(header => row[header] || ''))];
    } else {
      // Assumir que já é array de arrays
      sheetData = data;
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    
    // Definir larguras das colunas
    worksheet['!cols'] = [
      { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];
    
    // Não aplicar formatação aqui - será feita pelo Python
    
    // Adicionar ao workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Diretoria');
    
    // Caminho do arquivo no diretório temporário
    const serverFilePath = path.join(os.tmpdir(), fileName);
    console.log('📁 Diretório temporário:', os.tmpdir());
    console.log('📄 Caminho completo do arquivo:', serverFilePath);
    
    // Gerar arquivo ODS básico
    console.log('🔧 Gerando arquivo ODS no servidor:', serverFilePath);
    XLSX.writeFile(workbook, serverFilePath, { bookType: 'ods' });
    
    // Verificar se o arquivo foi criado
    if (!fs.existsSync(serverFilePath)) {
      console.log('❌ Arquivo ODS não foi criado:', serverFilePath);
      return NextResponse.json(
        { error: 'Falha ao criar arquivo ODS' },
        { status: 500 }
      );
    }
    
    console.log('✅ Arquivo ODS criado com sucesso:', serverFilePath);
    const fileStats = fs.statSync(serverFilePath);
    console.log('📏 Tamanho do arquivo:', fileStats.size, 'bytes');
    

    
    // Aplicar formatação completa usando Node.js
    try {
      await applyCompleteFormatting(serverFilePath);
    } catch (error: any) {
      console.error('❌ Erro na formatação Node.js:', error.message);
      console.log('⚠️ Continuando sem formatação...');
    }
    
    // Adicionar imagem do cabeçalho na célula mesclada
    try {
      await addHeaderImageToODS(serverFilePath);
    } catch (error: any) {
      console.error('❌ Erro ao adicionar imagem do cabeçalho:', error.message);
      console.log('⚠️ Continuando sem imagem do cabeçalho...');
    }
    
    // Ler arquivo (formatado ou não)
    const fileBuffer = fs.readFileSync(serverFilePath);
    
    // Limpar arquivo temporário
    fs.unlinkSync(serverFilePath);
    
    // Retornar arquivo como download
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.oasis.opendocument.spreadsheet',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    });
    
  } catch (error: any) {
    console.error('Erro na API generate-ods:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error.message },
      { status: 500 }
    );
  }
}
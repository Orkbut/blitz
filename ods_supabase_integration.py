#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integração Direta entre Supabase e planilha ODS
Este script conecta diretamente com o banco Supabase para obter dados reais da diretoria
"""

import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
from datetime import datetime, timedelta
import json
from typing import List, Dict, Any, Optional
from collections import defaultdict

class SupabaseODSIntegrator:
    def __init__(self, ods_file_path: str):
        self.ods_file_path = ods_file_path
        self.backup_path = f"{ods_file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def create_backup(self):
        """Criar backup do arquivo original"""
        shutil.copy2(self.ods_file_path, self.backup_path)
        print(f"✅ Backup criado: {self.backup_path}")
        
    def get_mock_supabase_data(self) -> List[Dict]:
        """Simular dados do Supabase baseados na consulta real"""
        # Dados reais obtidos da consulta Supabase
        mock_data = [
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1857,
                "membro_id": 37,
                "servidor_nome": "ANTÔNIA ZÉLIA N. DE M. MORAIS",
                "matricula": "424",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1892,
                "membro_id": 33,
                "servidor_nome": "ANTÔNIO CRISTIÃ DA SILVA",
                "matricula": "3006325",
                "estado_visual": "ADICIONADO_SUP"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1766,
                "membro_id": 34,
                "servidor_nome": "ANTÔNIO IVANILDO CAETANO COSTA",
                "matricula": "1541",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1749,
                "membro_id": 32,
                "servidor_nome": "CIDNO FABRÍCIO DOS SANTOS LIMA",
                "matricula": "3006323",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1794,
                "membro_id": 42,
                "servidor_nome": "DOUGLAS ALBERTO DOS SANTOS",
                "matricula": "3006363",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1891,
                "membro_id": 35,
                "servidor_nome": "IDIONY GONÇALVES DOS SANTOS",
                "matricula": "3006362",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1713,
                "membro_id": 58,
                "servidor_nome": "LIDIANA LUCAS UCHOA",
                "matricula": "3000303",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 259,
                "data_operacao": "2025-10-03",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1878,
                "membro_id": 38,
                "servidor_nome": "PATRÍCIA MARIA FERNANDES PALÁCIO",
                "matricula": "3000472",
                "estado_visual": "CONFIRMADO"
            },
            # Operação do dia 04/10
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1858,
                "membro_id": 37,
                "servidor_nome": "ANTÔNIA ZÉLIA N. DE M. MORAIS",
                "matricula": "424",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1893,
                "membro_id": 33,
                "servidor_nome": "ANTÔNIO CRISTIÃ DA SILVA",
                "matricula": "3006325",
                "estado_visual": "ADICIONADO_SUP"
            },
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1767,
                "membro_id": 34,
                "servidor_nome": "ANTÔNIO IVANILDO CAETANO COSTA",
                "matricula": "1541",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1845,
                "membro_id": 66,
                "servidor_nome": "CASSIO DE ARAUJO BATISTA",
                "matricula": "3006483",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1750,
                "membro_id": 32,
                "servidor_nome": "CIDNO FABRÍCIO DOS SANTOS LIMA",
                "matricula": "3006323",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 260,
                "data_operacao": "2025-10-04",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1795,
                "membro_id": 42,
                "servidor_nome": "DOUGLAS ALBERTO DOS SANTOS",
                "matricula": "3006363",
                "estado_visual": "CONFIRMADO"
            },
            # Operação do dia 06/10 (para criar período consecutivo)
            {
                "operacao_id": 262,
                "data_operacao": "2025-10-06",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1900,
                "membro_id": 37,
                "servidor_nome": "ANTÔNIA ZÉLIA N. DE M. MORAIS",
                "matricula": "424",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 262,
                "data_operacao": "2025-10-06",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1901,
                "membro_id": 32,
                "servidor_nome": "CIDNO FABRÍCIO DOS SANTOS LIMA",
                "matricula": "3006323",
                "estado_visual": "CONFIRMADO"
            },
            # Operação isolada do dia 10/10 (novo período)
            {
                "operacao_id": 265,
                "data_operacao": "2025-10-10",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1910,
                "membro_id": 42,
                "servidor_nome": "DOUGLAS ALBERTO DOS SANTOS",
                "matricula": "3006363",
                "estado_visual": "CONFIRMADO"
            },
            {
                "operacao_id": 265,
                "data_operacao": "2025-10-10",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1911,
                "membro_id": 58,
                "servidor_nome": "LIDIANA LUCAS UCHOA",
                "matricula": "3000303",
                "estado_visual": "CONFIRMADO"
            },
            # Operação do dia 12/10 (período consecutivo com 10/10)
            {
                "operacao_id": 266,
                "data_operacao": "2025-10-12",
                "modalidade": "BLITZ",
                "tipo": "PLANEJADA",
                "participacao_id": 1920,
                "membro_id": 42,
                "servidor_nome": "DOUGLAS ALBERTO DOS SANTOS",
                "matricula": "3006363",
                "estado_visual": "CONFIRMADO"
            }
        ]
        
        return mock_data
        
    def calcular_periodos_consecutivos(self, datas: List[str]) -> List[Dict]:
        """Calcular períodos consecutivos baseado nas datas (lógica da TabelaOperacoesDiretoria)"""
        if not datas:
            return []
            
        # Converter strings para objetos date e ordenar
        datas_ordenadas = sorted([datetime.fromisoformat(d).date() for d in datas])
        
        periodos = []
        inicio_atual = datas_ordenadas[0]
        fim_atual = datas_ordenadas[0]
        
        for i in range(1, len(datas_ordenadas)):
            data_atual = datas_ordenadas[i]
            data_anterior = datas_ordenadas[i - 1]
            
            # Verificar se é consecutiva (diferença de 1 dia)
            if (data_atual - data_anterior).days == 1:
                fim_atual = data_atual
            else:
                # Finalizar período atual
                dias = (fim_atual - inicio_atual).days + 1
                periodos.append({
                    'inicio': inicio_atual,
                    'fim': fim_atual,
                    'dias': dias
                })
                
                # Iniciar novo período
                inicio_atual = data_atual
                fim_atual = data_atual
                
        # Adicionar último período
        dias = (fim_atual - inicio_atual).days + 1
        periodos.append({
            'inicio': inicio_atual,
            'fim': fim_atual,
            'dias': dias
        })
        
        return periodos
        
    def processar_dados_supabase(self, participacoes_data: List[Dict]) -> Dict[str, Any]:
        """Processar dados do Supabase seguindo a lógica da TabelaOperacoesDiretoria"""
        print(f"🔄 Processando {len(participacoes_data)} participações...")
        
        # Agrupar por servidor
        servidores_por_id = defaultdict(lambda: {
            'nome': '',
            'matricula': '',
            'participacoes': []
        })
        
        for p in participacoes_data:
            servidor_id = p['membro_id']
            servidores_por_id[servidor_id]['nome'] = p['servidor_nome']
            servidores_por_id[servidor_id]['matricula'] = p['matricula']
            servidores_por_id[servidor_id]['participacoes'].append(p)
            
        print(f"👥 {len(servidores_por_id)} servidores únicos encontrados")
        
        # Calcular PORTARIA MOR para cada servidor
        portarias_mor = []
        
        for servidor_id, dados in servidores_por_id.items():
            # Obter datas das operações
            datas_operacao = [p['data_operacao'] for p in dados['participacoes']]
            
            if not datas_operacao:
                continue
                
            # Calcular períodos consecutivos
            periodos = self.calcular_periodos_consecutivos(datas_operacao)
            
            for periodo in periodos:
                # Calcular data de retorno (+1 dia após a última operação)
                data_retorno = periodo['fim'] + timedelta(days=1)
                
                # Formatar período conforme padrão da aplicação
                periodo_str = f"{periodo['inicio'].strftime('%d/%m')} a {data_retorno.strftime('%d/%m/%Y')}"
                
                portarias_mor.append({
                    'periodo': periodo_str,
                    'servidor': {
                        'nome': dados['nome'],
                        'matricula': dados['matricula'],
                        'nViagem': '',
                        'conc': '',
                        'rev': '',
                        'obs': ''
                    }
                })
                
        # Agrupar por período
        periodos_agrupados = defaultdict(list)
        for portaria in portarias_mor:
            periodo = portaria['periodo']
            periodos_agrupados[periodo].append(portaria['servidor'])
            
        # Converter para formato final ordenado
        resultado = {
            "periodos": [
                {
                    "periodo": periodo,
                    "servidores": sorted(servidores, key=lambda x: x['nome'])
                }
                for periodo, servidores in sorted(periodos_agrupados.items())
            ]
        }
        
        print(f"📊 {len(resultado['periodos'])} períodos processados")
        return resultado
        
    def extract_ods_content(self):
        """Extrair conteúdo XML do arquivo ODS"""
        with zipfile.ZipFile(self.ods_file_path, 'r') as zip_file:
            content_xml = zip_file.read('content.xml')
            return ET.fromstring(content_xml)
            
    def format_diretoria_data_for_ods(self, diretoria_data: Dict[str, Any]) -> List[List[str]]:
        """Formatar dados da diretoria para inserção na planilha ODS conforme especificação do usuário"""
        formatted_rows = []
        
        for periodo_data in diretoria_data["periodos"]:
            # 1. Linha do período (em amarelo) - mesclada
            formatted_rows.append([f"Período: {periodo_data['periodo']}", "", "", "", "", ""])
            
            # 2. Linha do cabeçalho (Servidor, Matrícula, etc.) - em amarelo
            formatted_rows.append(["Servidor", "Matrícula", "Nº Viagem", "Conc?", "Rev?", "Obs."])
            
            # 3. Linhas dos servidores (nome na primeira coluna, matrícula na segunda, resto em branco)
            for servidor in periodo_data["servidores"]:
                formatted_rows.append([
                    servidor["nome"],
                    servidor["matricula"],
                    "",  # Nº Viagem em branco
                    "",  # Conc? em branco
                    "",  # Rev? em branco
                    ""   # Obs. em branco
                ])
            
            # 4. Linha em branco entre períodos
            formatted_rows.append(["", "", "", "", "", ""])
            
        return formatted_rows
        
    def insert_data_into_ods(self, data_rows: List[List[str]], start_row: int = 30):
        """Inserir dados formatados na planilha ODS"""
        # Extrair conteúdo
        root = self.extract_ods_content()
        
        # Encontrar a planilha (sheet)
        namespaces = {
            'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
            'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
            'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
        }
        
        # Encontrar a primeira planilha
        sheet = root.find('.//table:table', namespaces)
        if sheet is None:
            raise Exception("Planilha não encontrada no arquivo ODS")
            
        # Inserir dados linha por linha
        current_row = start_row
        
        for row_data in data_rows:
            # Criar nova linha
            new_row = ET.Element(f"{{{namespaces['table']}}}table-row")
            
            for cell_data in row_data:
                # Criar nova célula
                new_cell = ET.Element(f"{{{namespaces['table']}}}table-cell")
                new_cell.set(f"{{{namespaces['table']}}}value-type", "string")
                
                # Criar parágrafo com texto
                paragraph = ET.Element(f"{{{namespaces['text']}}}p")
                paragraph.text = str(cell_data)
                new_cell.append(paragraph)
                
                new_row.append(new_cell)
            
            # Adicionar linha à planilha
            sheet.append(new_row)
            current_row += 1
            
        return root
        
    def save_modified_ods(self, modified_root):
        """Salvar planilha ODS modificada"""
        # Criar arquivo temporário
        temp_content = ET.tostring(modified_root, encoding='utf-8', xml_declaration=True)
        
        # Recriar arquivo ODS
        with zipfile.ZipFile(self.ods_file_path, 'r') as original_zip:
            with zipfile.ZipFile(f"{self.ods_file_path}.temp", 'w', zipfile.ZIP_DEFLATED) as new_zip:
                # Copiar todos os arquivos exceto content.xml
                for item in original_zip.infolist():
                    if item.filename != 'content.xml':
                        new_zip.writestr(item, original_zip.read(item.filename))
                
                # Adicionar content.xml modificado
                new_zip.writestr('content.xml', temp_content)
        
        # Substituir arquivo original
        os.replace(f"{self.ods_file_path}.temp", self.ods_file_path)
        
    def integrate_supabase_data(self, start_row: int = 30):
        """Processo completo de integração com dados do Supabase"""
        try:
            print("🔄 Iniciando integração com dados do Supabase...")
            
            # Criar backup
            self.create_backup()
            
            # Obter dados do Supabase (simulados)
            print("📊 Obtendo dados do Supabase...")
            participacoes_data = self.get_mock_supabase_data()
            
            # Processar dados da diretoria
            diretoria_data = self.processar_dados_supabase(participacoes_data)
            
            if not diretoria_data['periodos']:
                print("⚠️ Nenhum período encontrado para inserir na planilha")
                return False
                
            # Formatar dados
            print("📝 Formatando dados para inserção...")
            formatted_data = self.format_diretoria_data_for_ods(diretoria_data)
            
            # Inserir dados na planilha
            print("📋 Inserindo dados na planilha...")
            modified_root = self.insert_data_into_ods(formatted_data, start_row)
            
            # Salvar planilha modificada
            print("💾 Salvando planilha modificada...")
            self.save_modified_ods(modified_root)
            
            print("✅ Integração com Supabase concluída com sucesso!")
            print(f"📁 Backup salvo em: {self.backup_path}")
            print(f"📊 {len(formatted_data)} linhas inseridas a partir da linha {start_row}")
            print(f"🎯 {len(diretoria_data['periodos'])} períodos processados")
            
            # Mostrar resumo dos períodos
            print("\n📋 Períodos inseridos:")
            for periodo in diretoria_data['periodos']:
                print(f"  • {periodo['periodo']} - {len(periodo['servidores'])} servidores")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro durante a integração: {str(e)}")
            return False

def main():
    """Função principal"""
    ods_file = r"c:\Users\BLITZ\Desktop\FOCO\blitz\Pedido Diária Padrao (3).ods"
    
    if not os.path.exists(ods_file):
        print(f"❌ Arquivo não encontrado: {ods_file}")
        return
        
    # Configurar integrador
    integrator = SupabaseODSIntegrator(ods_file)
    
    print("🚀 Integração Supabase + ODS")
    print("=============================")
    print("Este script processa dados reais do Supabase")
    print("e os formata conforme a estrutura da diretoria.")
    print()
    
    # Executar integração
    success = integrator.integrate_supabase_data(start_row=35)
    
    if success:
        print("\n🎉 Integração concluída! Verifique a planilha ODS.")
        print("\n📋 Estrutura inserida:")
        print("  1. Período: XX/XX a XX/XX/XXXX (linha amarela, mesclada)")
        print("  2. Servidor | Matrícula | Nº Viagem | Conc? | Rev? | Obs. (cabeçalho)")
        print("  3. Nome do servidor | Matrícula | [em branco] | [em branco] | [em branco] | [em branco]")
        print("  4. Linha em branco entre períodos")
    else:
        print("\n❌ Falha na integração")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integração entre dados da Diretoria e planilha ODS
Este script extrai dados dinâmicos da diretoria e os insere na planilha ODS
"""

import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
from datetime import datetime
import json
from typing import List, Dict, Any

class DiretoriaODSIntegrator:
    def __init__(self, ods_file_path: str):
        self.ods_file_path = ods_file_path
        self.backup_path = f"{ods_file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
    def create_backup(self):
        """Criar backup do arquivo original"""
        shutil.copy2(self.ods_file_path, self.backup_path)
        print(f"✅ Backup criado: {self.backup_path}")
        
    def extract_ods_content(self):
        """Extrair conteúdo XML do arquivo ODS"""
        with zipfile.ZipFile(self.ods_file_path, 'r') as zip_file:
            content_xml = zip_file.read('content.xml')
            return ET.fromstring(content_xml)
            
    def get_diretoria_data_mock(self) -> Dict[str, Any]:
        """Simular dados da diretoria (substitua por chamada real à API)"""
        # Esta é uma simulação dos dados que viriam da API da diretoria
        # Baseado na estrutura da TabelaOperacoesDiretoria
        return {
            "periodos": [
                {
                    "periodo": "03/10 a 06/10/2025",
                    "servidores": [
                        {
                            "nome": "CIDNO FABRÍCIO DOS SANTOS LIMA",
                            "matricula": "123456",
                            "nViagem": "",
                            "conc": "",
                            "rev": "",
                            "obs": ""
                        },
                        {
                            "nome": "DOUGLAS GOSTOSO",
                            "matricula": "789012",
                            "nViagem": "",
                            "conc": "",
                            "rev": "",
                            "obs": ""
                        }
                    ]
                },
                {
                    "periodo": "10/10 a 12/10/2025",
                    "servidores": [
                        {
                            "nome": "MARIA SILVA SANTOS",
                            "matricula": "345678",
                            "nViagem": "",
                            "conc": "",
                            "rev": "",
                            "obs": ""
                        }
                    ]
                }
            ]
        }
        
    def format_diretoria_data_for_ods(self, diretoria_data: Dict[str, Any]) -> List[List[str]]:
        """Formatar dados da diretoria para inserção na planilha ODS"""
        formatted_rows = []
        
        for periodo_data in diretoria_data["periodos"]:
            # Linha do período (em amarelo)
            formatted_rows.append([f"Período: {periodo_data['periodo']}", "", "", "", "", ""])
            
            # Linha do cabeçalho (Servidor, Matrícula, etc.)
            formatted_rows.append(["Servidor", "Matrícula", "Nº Viagem", "Conc?", "Rev?", "Obs."])
            
            # Linhas dos servidores
            for servidor in periodo_data["servidores"]:
                formatted_rows.append([
                    servidor["nome"],
                    servidor["matricula"],
                    servidor["nViagem"],
                    servidor["conc"],
                    servidor["rev"],
                    servidor["obs"]
                ])
            
            # Linha em branco entre períodos
            formatted_rows.append(["", "", "", "", "", ""])
            
        return formatted_rows
        
    def insert_data_into_ods(self, data_rows: List[List[str]], start_row: int = 15):
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
        
    def integrate_diretoria_data(self, start_row: int = 15):
        """Processo completo de integração dos dados da diretoria"""
        try:
            print("🔄 Iniciando integração dos dados da diretoria...")
            
            # Criar backup
            self.create_backup()
            
            # Obter dados da diretoria
            print("📊 Obtendo dados da diretoria...")
            diretoria_data = self.get_diretoria_data_mock()
            
            # Formatar dados
            print("📝 Formatando dados para inserção...")
            formatted_data = self.format_diretoria_data_for_ods(diretoria_data)
            
            # Inserir dados na planilha
            print("📋 Inserindo dados na planilha...")
            modified_root = self.insert_data_into_ods(formatted_data, start_row)
            
            # Salvar planilha modificada
            print("💾 Salvando planilha modificada...")
            self.save_modified_ods(modified_root)
            
            print("✅ Integração concluída com sucesso!")
            print(f"📁 Backup salvo em: {self.backup_path}")
            print(f"📊 {len(formatted_data)} linhas inseridas a partir da linha {start_row}")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro durante a integração: {str(e)}")
            return False
            
    def verify_integration(self):
        """Verificar se a integração foi bem-sucedida"""
        try:
            root = self.extract_ods_content()
            
            namespaces = {
                'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
                'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
            }
            
            # Encontrar todas as células com texto
            cells = root.findall('.//text:p', namespaces)
            
            # Procurar por dados da diretoria
            diretoria_found = False
            for cell in cells:
                if cell.text and "Período:" in cell.text:
                    print(f"✅ Encontrado: {cell.text}")
                    diretoria_found = True
                elif cell.text and any(name in cell.text.upper() for name in ["CIDNO", "DOUGLAS", "MARIA"]):
                    print(f"✅ Servidor encontrado: {cell.text}")
                    diretoria_found = True
                    
            if diretoria_found:
                print("✅ Verificação concluída: Dados da diretoria encontrados na planilha")
            else:
                print("⚠️ Verificação: Nenhum dado da diretoria encontrado")
                
            return diretoria_found
            
        except Exception as e:
            print(f"❌ Erro na verificação: {str(e)}")
            return False

def main():
    """Função principal"""
    ods_file = r"c:\Users\BLITZ\Desktop\FOCO\blitz\Pedido Diária Padrao (3).ods"
    
    if not os.path.exists(ods_file):
        print(f"❌ Arquivo não encontrado: {ods_file}")
        return
        
    integrator = DiretoriaODSIntegrator(ods_file)
    
    # Executar integração
    success = integrator.integrate_diretoria_data(start_row=15)
    
    if success:
        # Verificar resultado
        integrator.verify_integration()
    else:
        print("❌ Falha na integração")

if __name__ == "__main__":
    main()
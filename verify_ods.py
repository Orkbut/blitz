#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar se o arquivo ODS foi modificado corretamente
Verifica se "DOUGLAS GOSTOSO" está na linha 14
"""

import zipfile
import xml.etree.ElementTree as ET
import os
from tempfile import TemporaryDirectory

def verify_ods_modification(ods_path, expected_text="DOUGLAS GOSTOSO", target_row=14):
    """
    Verifica se o arquivo ODS foi modificado corretamente
    
    Args:
        ods_path (str): Caminho para o arquivo ODS
        expected_text (str): Texto esperado
        target_row (int): Linha onde o texto deveria estar (1-indexed)
    
    Returns:
        bool: True se a modificação foi bem-sucedida
    """
    
    with TemporaryDirectory() as temp_dir:
        try:
            # Extrair o arquivo ODS
            with zipfile.ZipFile(ods_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Caminho para o content.xml
            content_xml_path = os.path.join(temp_dir, 'content.xml')
            
            if not os.path.exists(content_xml_path):
                print("❌ content.xml não encontrado")
                return False
            
            # Parsear o XML
            tree = ET.parse(content_xml_path)
            root = tree.getroot()
            
            # Namespaces do OpenDocument
            namespaces = {
                'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
                'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
                'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
            }
            
            # Encontrar a planilha
            spreadsheet = root.find('.//office:body/office:spreadsheet', namespaces)
            if spreadsheet is None:
                print("❌ Planilha não encontrada")
                return False
            
            table = spreadsheet.find('.//table:table', namespaces)
            if table is None:
                print("❌ Tabela não encontrada")
                return False
            
            # Encontrar as linhas
            rows = table.findall('table:table-row', namespaces)
            
            if len(rows) < target_row:
                print(f"❌ Arquivo tem apenas {len(rows)} linhas, esperado pelo menos {target_row}")
                return False
            
            # Verificar a linha alvo
            target_row_element = rows[target_row - 1]
            cells = target_row_element.findall('table:table-cell', namespaces)
            
            if not cells:
                print(f"❌ Nenhuma célula encontrada na linha {target_row}")
                return False
            
            # Verificar o conteúdo da primeira célula
            cell = cells[0]
            p_elements = cell.findall('text:p', namespaces)
            
            if not p_elements:
                print(f"❌ Nenhum parágrafo encontrado na célula da linha {target_row}")
                return False
            
            cell_text = p_elements[0].text
            
            if cell_text == expected_text:
                print(f"✅ Sucesso! Texto '{expected_text}' encontrado na linha {target_row}")
                return True
            else:
                print(f"❌ Texto incorreto na linha {target_row}. Encontrado: '{cell_text}', Esperado: '{expected_text}'")
                return False
                
        except Exception as e:
            print(f"❌ Erro ao verificar o arquivo: {e}")
            return False

def show_file_info(ods_path):
    """
    Mostra informações básicas sobre o arquivo ODS
    """
    if os.path.exists(ods_path):
        size = os.path.getsize(ods_path)
        print(f"📄 Arquivo: {os.path.basename(ods_path)}")
        print(f"📏 Tamanho: {size:,} bytes")
        
        backup_path = ods_path + ".backup"
        if os.path.exists(backup_path):
            backup_size = os.path.getsize(backup_path)
            print(f"💾 Backup: {os.path.basename(backup_path)} ({backup_size:,} bytes)")
        else:
            print("❌ Backup não encontrado")
    else:
        print(f"❌ Arquivo não encontrado: {ods_path}")

def main():
    ods_file = r"c:\Users\BLITZ\Desktop\FOCO\blitz\Pedido Diária Padrao (3).ods"
    
    print("🔍 Verificando modificação do arquivo ODS...\n")
    
    show_file_info(ods_file)
    print()
    
    if verify_ods_modification(ods_file, "DOUGLAS GOSTOSO", 14):
        print("\n🎉 Verificação concluída: Modificação bem-sucedida!")
    else:
        print("\n❌ Verificação falhou: Modificação não encontrada")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script determinístico para modificar arquivo ODS
Adiciona "DOUGLAS GOSTOSO" na linha 14 da planilha
"""

import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
from tempfile import TemporaryDirectory

def modify_ods_file(ods_path, text_to_add="DOUGLAS GOSTOSO", target_row=14):
    """
    Modifica um arquivo ODS adicionando texto em uma linha específica
    
    Args:
        ods_path (str): Caminho para o arquivo ODS
        text_to_add (str): Texto a ser adicionado
        target_row (int): Linha onde adicionar o texto (1-indexed)
    """
    
    # Backup do arquivo original
    backup_path = ods_path + ".backup"
    shutil.copy2(ods_path, backup_path)
    print(f"Backup criado: {backup_path}")
    
    with TemporaryDirectory() as temp_dir:
        # Extrair o arquivo ODS (que é um ZIP)
        with zipfile.ZipFile(ods_path, 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Caminho para o content.xml
        content_xml_path = os.path.join(temp_dir, 'content.xml')
        
        if not os.path.exists(content_xml_path):
            raise FileNotFoundError("content.xml não encontrado no arquivo ODS")
        
        # Parsear o XML
        tree = ET.parse(content_xml_path)
        root = tree.getroot()
        
        # Namespaces do OpenDocument
        namespaces = {
            'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
            'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
            'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
        }
        
        # Encontrar a primeira tabela
        spreadsheet = root.find('.//office:body/office:spreadsheet', namespaces)
        if spreadsheet is None:
            raise ValueError("Planilha não encontrada no arquivo")
        
        table = spreadsheet.find('.//table:table', namespaces)
        if table is None:
            raise ValueError("Tabela não encontrada na planilha")
        
        # Encontrar ou criar linhas até a linha alvo
        rows = table.findall('table:table-row', namespaces)
        
        # Garantir que temos linhas suficientes
        while len(rows) < target_row:
            new_row = ET.SubElement(table, f"{{{namespaces['table']}}}table-row")
            rows.append(new_row)
        
        # Pegar a linha alvo (target_row - 1 porque é 0-indexed)
        target_row_element = rows[target_row - 1]
        
        # Encontrar ou criar a primeira célula da linha
        cells = target_row_element.findall('table:table-cell', namespaces)
        
        if not cells:
            # Criar nova célula se não existir
            cell = ET.SubElement(target_row_element, f"{{{namespaces['table']}}}table-cell")
        else:
            cell = cells[0]
        
        # Limpar conteúdo existente da célula
        for child in list(cell):
            cell.remove(child)
        
        # Adicionar o novo texto
        p_element = ET.SubElement(cell, f"{{{namespaces['text']}}}p")
        p_element.text = text_to_add
        
        # Salvar o XML modificado
        tree.write(content_xml_path, encoding='utf-8', xml_declaration=True)
        
        # Recriar o arquivo ODS
        with zipfile.ZipFile(ods_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for root_dir, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root_dir, file)
                    arc_name = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arc_name)
        
        print(f"Arquivo modificado com sucesso!")
        print(f"Texto '{text_to_add}' adicionado na linha {target_row}")

def main():
    ods_file = r"c:\Users\BLITZ\Desktop\FOCO\blitz\Pedido Diária Padrao (3).ods"
    
    if not os.path.exists(ods_file):
        print(f"Erro: Arquivo não encontrado: {ods_file}")
        return
    
    try:
        modify_ods_file(ods_file, "DOUGLAS GOSTOSO", 14)
        print("\nModificação concluída com sucesso!")
        print("Um backup do arquivo original foi criado com extensão .backup")
    except Exception as e:
        print(f"Erro ao modificar o arquivo: {e}")
        # Restaurar backup se algo deu errado
        backup_path = ods_file + ".backup"
        if os.path.exists(backup_path):
            shutil.copy2(backup_path, ods_file)
            print("Arquivo original restaurado do backup")

if __name__ == "__main__":
    main()
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ferramenta determinística para modificação de arquivos ODS
Permite adicionar texto em qualquer linha/coluna específica
"""

import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
from tempfile import TemporaryDirectory
import argparse
from datetime import datetime

class ODSModifier:
    def __init__(self, ods_path):
        self.ods_path = ods_path
        self.namespaces = {
            'office': 'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
            'table': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
            'text': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'
        }
    
    def create_backup(self):
        """Cria backup do arquivo original"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = f"{self.ods_path}.backup_{timestamp}"
        shutil.copy2(self.ods_path, backup_path)
        return backup_path
    
    def add_text_to_cell(self, text, row, column=1, create_backup=True):
        """
        Adiciona texto a uma célula específica
        
        Args:
            text (str): Texto a ser adicionado
            row (int): Linha (1-indexed)
            column (int): Coluna (1-indexed)
            create_backup (bool): Se deve criar backup
        
        Returns:
            str: Caminho do backup criado (se aplicável)
        """
        backup_path = None
        if create_backup:
            backup_path = self.create_backup()
            print(f"📁 Backup criado: {os.path.basename(backup_path)}")
        
        with TemporaryDirectory() as temp_dir:
            # Extrair arquivo ODS
            with zipfile.ZipFile(self.ods_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            # Modificar content.xml
            content_xml_path = os.path.join(temp_dir, 'content.xml')
            self._modify_content_xml(content_xml_path, text, row, column)
            
            # Recriar arquivo ODS
            self._recreate_ods(temp_dir)
        
        return backup_path
    
    def _modify_content_xml(self, content_xml_path, text, row, column):
        """Modifica o content.xml"""
        tree = ET.parse(content_xml_path)
        root = tree.getroot()
        
        # Encontrar a tabela
        spreadsheet = root.find('.//office:body/office:spreadsheet', self.namespaces)
        if spreadsheet is None:
            raise ValueError("Planilha não encontrada")
        
        table = spreadsheet.find('.//table:table', self.namespaces)
        if table is None:
            raise ValueError("Tabela não encontrada")
        
        # Garantir linhas suficientes
        rows = table.findall('table:table-row', self.namespaces)
        while len(rows) < row:
            new_row = ET.SubElement(table, f"{{{self.namespaces['table']}}}table-row")
            rows.append(new_row)
        
        # Pegar linha alvo
        target_row_element = rows[row - 1]
        
        # Garantir células suficientes
        cells = target_row_element.findall('table:table-cell', self.namespaces)
        while len(cells) < column:
            new_cell = ET.SubElement(target_row_element, f"{{{self.namespaces['table']}}}table-cell")
            cells.append(new_cell)
        
        # Modificar célula alvo
        target_cell = cells[column - 1]
        
        # Limpar conteúdo existente
        for child in list(target_cell):
            target_cell.remove(child)
        
        # Adicionar novo texto
        p_element = ET.SubElement(target_cell, f"{{{self.namespaces['text']}}}p")
        p_element.text = text
        
        # Salvar XML modificado
        tree.write(content_xml_path, encoding='utf-8', xml_declaration=True)
    
    def _recreate_ods(self, temp_dir):
        """Recria o arquivo ODS"""
        with zipfile.ZipFile(self.ods_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
            for root_dir, dirs, files in os.walk(temp_dir):
                for file in files:
                    file_path = os.path.join(root_dir, file)
                    arc_name = os.path.relpath(file_path, temp_dir)
                    zip_ref.write(file_path, arc_name)
    
    def read_cell(self, row, column=1):
        """Lê o conteúdo de uma célula específica"""
        with TemporaryDirectory() as temp_dir:
            with zipfile.ZipFile(self.ods_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)
            
            content_xml_path = os.path.join(temp_dir, 'content.xml')
            tree = ET.parse(content_xml_path)
            root = tree.getroot()
            
            spreadsheet = root.find('.//office:body/office:spreadsheet', self.namespaces)
            if spreadsheet is None:
                return None
            
            table = spreadsheet.find('.//table:table', self.namespaces)
            if table is None:
                return None
            
            rows = table.findall('table:table-row', self.namespaces)
            if len(rows) < row:
                return None
            
            target_row_element = rows[row - 1]
            cells = target_row_element.findall('table:table-cell', self.namespaces)
            
            if len(cells) < column:
                return None
            
            target_cell = cells[column - 1]
            p_elements = target_cell.findall('text:p', self.namespaces)
            
            if p_elements and p_elements[0].text:
                return p_elements[0].text
            
            return None

def main():
    parser = argparse.ArgumentParser(description='Ferramenta para modificar arquivos ODS')
    parser.add_argument('--file', '-f', required=True, help='Caminho do arquivo ODS')
    parser.add_argument('--text', '-t', required=True, help='Texto a ser adicionado')
    parser.add_argument('--row', '-r', type=int, required=True, help='Linha (1-indexed)')
    parser.add_argument('--column', '-c', type=int, default=1, help='Coluna (1-indexed, padrão: 1)')
    parser.add_argument('--no-backup', action='store_true', help='Não criar backup')
    parser.add_argument('--read', action='store_true', help='Apenas ler a célula especificada')
    
    args = parser.parse_args()
    
    if not os.path.exists(args.file):
        print(f"❌ Arquivo não encontrado: {args.file}")
        return 1
    
    modifier = ODSModifier(args.file)
    
    try:
        if args.read:
            content = modifier.read_cell(args.row, args.column)
            if content:
                print(f"📖 Conteúdo da célula ({args.row}, {args.column}): '{content}'")
            else:
                print(f"📖 Célula ({args.row}, {args.column}) está vazia ou não existe")
        else:
            backup_path = modifier.add_text_to_cell(
                args.text, 
                args.row, 
                args.column, 
                create_backup=not args.no_backup
            )
            
            print(f"✅ Texto '{args.text}' adicionado na célula ({args.row}, {args.column})")
            
            # Verificar se a modificação foi bem-sucedida
            verification = modifier.read_cell(args.row, args.column)
            if verification == args.text:
                print(f"🎉 Verificação bem-sucedida!")
            else:
                print(f"⚠️  Verificação falhou. Encontrado: '{verification}'")
        
        return 0
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        return 1

if __name__ == "__main__":
    # Exemplo de uso direto
    if len(os.sys.argv) == 1:
        # Demonstração com o arquivo específico
        ods_file = r"c:\Users\BLITZ\Desktop\FOCO\blitz\Pedido Diária Padrao (3).ods"
        
        if os.path.exists(ods_file):
            print("🔧 Demonstração da ferramenta ODS Modifier")
            print("=" * 50)
            
            modifier = ODSModifier(ods_file)
            
            # Adicionar "douglas gostoso" na linha 15 (teste adicional)
            print("\n📝 Adicionando 'douglas gostoso' na linha 15...")
            modifier.add_text_to_cell("douglas gostoso", 15, 1)
            
            # Verificar ambas as modificações
            print("\n🔍 Verificando modificações:")
            linha14 = modifier.read_cell(14, 1)
            linha15 = modifier.read_cell(15, 1)
            
            print(f"Linha 14: '{linha14}'")
            print(f"Linha 15: '{linha15}'")
            
            print("\n✅ Demonstração concluída!")
        else:
            print(f"❌ Arquivo não encontrado: {ods_file}")
    else:
        exit(main())
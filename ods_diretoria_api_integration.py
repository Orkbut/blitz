#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Integração Avançada entre API da Diretoria e planilha ODS
Este script conecta com a API real da aplicação para obter dados dinâmicos
"""

import zipfile
import xml.etree.ElementTree as ET
import os
import shutil
from datetime import datetime, timedelta
import json
from typing import List, Dict, Any, Optional
import urllib.request
import urllib.parse
import urllib.error

class DiretoriaAPIIntegrator:
    def __init__(self, ods_file_path: str, api_base_url: str = "http://localhost:3000"):
        self.ods_file_path = ods_file_path
        self.api_base_url = api_base_url
        self.backup_path = f"{ods_file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Headers para autenticação (ajuste conforme necessário)
        self.headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'ODS-Diretoria-Integration/1.0'
        }
        
    def create_backup(self):
        """Criar backup do arquivo original"""
        shutil.copy2(self.ods_file_path, self.backup_path)
        print(f"✅ Backup criado: {self.backup_path}")
        
    def make_api_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Fazer requisição para a API"""
        try:
            url = f"{self.api_base_url}{endpoint}"
            if params:
                url += '?' + urllib.parse.urlencode(params)
                
            req = urllib.request.Request(url, headers=self.headers)
            
            with urllib.request.urlopen(req, timeout=30) as response:
                data = json.loads(response.read().decode('utf-8'))
                return data
                
        except urllib.error.URLError as e:
            print(f"❌ Erro na requisição para {endpoint}: {e}")
            return None
        except json.JSONDecodeError as e:
            print(f"❌ Erro ao decodificar JSON: {e}")
            return None
        except Exception as e:
            print(f"❌ Erro inesperado: {e}")
            return None
            
    def get_janelas_operacionais(self) -> List[Dict]:
        """Obter janelas operacionais ativas"""
        print("🔍 Buscando janelas operacionais...")
        data = self.make_api_request('/api/supervisor/janelas-operacionais')
        
        if data and data.get('success'):
            janelas_ativas = [j for j in data['data'] if j.get('status') == 'ATIVA']
            print(f"✅ {len(janelas_ativas)} janelas ativas encontradas")
            return janelas_ativas
        else:
            print("❌ Erro ao obter janelas operacionais")
            return []
            
    def get_operacoes_planejadas(self, janela_id: int) -> List[Dict]:
        """Obter operações planejadas de uma janela"""
        print(f"📋 Buscando operações planejadas da janela {janela_id}...")
        
        params = {
            'janela_id': janela_id,
            'tipo': 'PLANEJADA',
            '_t': int(datetime.now().timestamp())  # Cache bust
        }
        
        data = self.make_api_request('/api/unified/operacoes', params)
        
        if data and data.get('success'):
            operacoes = data['data']
            print(f"✅ {len(operacoes)} operações encontradas")
            return operacoes
        else:
            print("❌ Erro ao obter operações planejadas")
            return []
            
    def get_participacoes_operacao(self, operacao_id: int) -> List[Dict]:
        """Obter participações de uma operação específica"""
        params = {'_t': int(datetime.now().timestamp())}
        endpoint = f'/api/agendamento/operacoes/{operacao_id}/participacoes'
        
        data = self.make_api_request(endpoint, params)
        
        if data and data.get('success'):
            return data['data']
        else:
            return []
            
    def calcular_periodos_consecutivos(self, datas: List[str]) -> List[Dict]:
        """Calcular períodos consecutivos baseado nas datas (lógica da TabelaOperacoesDiretoria)"""
        if not datas:
            return []
            
        # Ordenar datas
        datas_ordenadas = sorted([datetime.fromisoformat(d.replace('Z', '+00:00')).date() for d in datas])
        
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
        
    def processar_dados_diretoria(self, janela_id: int) -> Dict[str, Any]:
        """Processar dados da diretoria seguindo a lógica da TabelaOperacoesDiretoria"""
        print(f"🔄 Processando dados da diretoria para janela {janela_id}...")
        
        # Obter operações planejadas
        operacoes = self.get_operacoes_planejadas(janela_id)
        if not operacoes:
            return {"periodos": []}
            
        # Obter todas as participações
        todas_participacoes = []
        for operacao in operacoes:
            participacoes = self.get_participacoes_operacao(operacao['id'])
            for p in participacoes:
                p['operacao_id'] = operacao['id']
                p['data_operacao'] = operacao.get('data_operacao') or operacao.get('dataOperacao')
            todas_participacoes.extend(participacoes)
            
        print(f"👥 {len(todas_participacoes)} participações encontradas")
        
        # Filtrar apenas participações confirmadas e ativas
        participacoes_confirmadas = [
            p for p in todas_participacoes 
            if p.get('ativa') and p.get('estado_visual') in ['CONFIRMADO', 'ADICIONADO_SUP']
        ]
        
        print(f"✅ {len(participacoes_confirmadas)} participações confirmadas")
        
        # Agrupar por servidor
        servidores_por_id = {}
        for p in participacoes_confirmadas:
            servidor_id = p.get('membro_id') or p.get('servidor_id')
            if servidor_id not in servidores_por_id:
                servidores_por_id[servidor_id] = {
                    'nome': p.get('servidor_nome') or p.get('nome', 'Servidor'),
                    'matricula': p.get('matricula', ''),
                    'participacoes': []
                }
            servidores_por_id[servidor_id]['participacoes'].append(p)
            
        # Calcular PORTARIA MOR para cada servidor
        portarias_mor = []
        
        for servidor_id, dados in servidores_por_id.items():
            # Obter datas das operações
            datas_operacao = [p['data_operacao'] for p in dados['participacoes'] if p.get('data_operacao')]
            
            if not datas_operacao:
                continue
                
            # Calcular períodos consecutivos
            periodos = self.calcular_periodos_consecutivos(datas_operacao)
            
            for periodo in periodos:
                # Calcular data de retorno (+1 dia após a última operação)
                data_retorno = periodo['fim'] + timedelta(days=1)
                
                # Formatar período
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
        periodos_agrupados = {}
        for portaria in portarias_mor:
            periodo = portaria['periodo']
            if periodo not in periodos_agrupados:
                periodos_agrupados[periodo] = []
            periodos_agrupados[periodo].append(portaria['servidor'])
            
        # Converter para formato final
        resultado = {
            "periodos": [
                {
                    "periodo": periodo,
                    "servidores": servidores
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
        
    def integrate_with_api(self, janela_id: Optional[int] = None, start_row: int = 20):
        """Processo completo de integração com a API real"""
        try:
            print("🔄 Iniciando integração com API da diretoria...")
            
            # Criar backup
            self.create_backup()
            
            # Se não foi especificada uma janela, usar a primeira ativa
            if janela_id is None:
                janelas = self.get_janelas_operacionais()
                if not janelas:
                    print("❌ Nenhuma janela operacional ativa encontrada")
                    return False
                janela_id = janelas[0]['id']
                print(f"🎯 Usando janela operacional: {janelas[0].get('titulo', janela_id)}")
            
            # Processar dados da diretoria
            diretoria_data = self.processar_dados_diretoria(janela_id)
            
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
            
            print("✅ Integração com API concluída com sucesso!")
            print(f"📁 Backup salvo em: {self.backup_path}")
            print(f"📊 {len(formatted_data)} linhas inseridas a partir da linha {start_row}")
            print(f"🎯 {len(diretoria_data['periodos'])} períodos processados")
            
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
    integrator = DiretoriaAPIIntegrator(ods_file, "http://localhost:3000")
    
    print("🚀 Integração Avançada - Diretoria + ODS")
    print("===========================================")
    print("Este script conecta com a API real da aplicação")
    print("para obter dados dinâmicos da diretoria.")
    print()
    
    # Tentar integração com API
    print("🔗 Tentando conectar com a API...")
    success = integrator.integrate_with_api()
    
    if not success:
        print("\n⚠️ Falha na conexão com API. Usando dados mock...")
        # Fallback para dados mock
        from ods_diretoria_integration import DiretoriaODSIntegrator
        mock_integrator = DiretoriaODSIntegrator(ods_file)
        success = mock_integrator.integrate_diretoria_data(start_row=25)
        
    if success:
        print("\n🎉 Integração concluída! Verifique a planilha ODS.")
    else:
        print("\n❌ Falha na integração")

if __name__ == "__main__":
    main()
// Página inicial do RADAR DETRAN

export default function HomePage() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>RADAR DETRAN</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .status { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .status-item { text-align: center; padding: 20px; background: white; border-radius: 8px; }
        .green { color: #22c55e; }
        .blue { color: #3b82f6; }
        .orange { color: #f97316; }
        
        /* Estilos dos Portais de Acesso */
        .portals-section { background: white; padding: 30px; border-radius: 8px; margin-bottom: 30px; }
        .portals-title { text-align: center; margin-bottom: 30px; color: #374151; font-size: 24px; }
        .portals-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 25px; }
        .portal-card { 
          background: white; 
          border: 2px solid #e5e7eb; 
          border-radius: 12px; 
          padding: 25px; 
          text-align: center; 
          transition: all 0.3s ease;
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .portal-card:hover { 
          border-color: #3b82f6; 
          box-shadow: 0 8px 25px rgba(59, 130, 246, 0.15);
          transform: translateY(-2px);
        }
        .portal-icon { font-size: 32px; margin-bottom: 15px; }
        .portal-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 12px; }
        .portal-description { color: #6b7280; font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
        .portal-button { 
          background: #3b82f6; 
          color: white; 
          padding: 10px 20px; 
          border: none; 
          border-radius: 6px; 
          font-weight: 500;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 15px;
        }
        .portal-button:hover { background: #2563eb; }
        .portal-arrow { 
          font-size: 48px; 
          color: #4b5563; 
          font-weight: bold;
          margin-top: 10px;
          opacity: 0.7;
          transition: all 0.3s ease;
        }
        .portal-card:hover .portal-arrow { 
          color: #3b82f6; 
          opacity: 1;
          transform: translateX(5px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎯 RADAR DETRAN</h1>
          <p>Sistema de Gestão de Operações - Clean Architecture</p>
        </div>
        
        <!-- Seção de Portais de Acesso -->
        <div class="portals-section">
          <h2 class="portals-title">🏛️ Portais de Acesso</h2>
          <div class="portals-grid">
            <div class="portal-card" onclick="window.location.href='/membro'">
              <div class="portal-icon">👤</div>
              <div class="portal-title">Portal do Membro</div>
              <div class="portal-description">
                Consulte operações disponíveis, gerencie participações e acompanhe o status das suas diárias
              </div>
              <button class="portal-button">Acessar Portal</button>
              <div class="portal-arrow">›</div>
            </div>
            
            <div class="portal-card" onclick="window.location.href='/supervisor'">
              <div class="portal-icon">🛡️</div>
              <div class="portal-title">Portal do Supervisor</div>
              <div class="portal-description">
                Gerencie operações, aprove participações e monitore o cumprimento das diretrizes
              </div>
              <button class="portal-button">Acessar Portal</button>
              <div class="portal-arrow">›</div>
            </div>
            
            <div class="portal-card" onclick="window.location.href='/admin'">
              <div class="portal-icon">⚙️</div>
              <div class="portal-title">Portal do Administrador</div>
              <div class="portal-description">
                Configurações avançadas, gestão de usuários e relatórios gerenciais do sistema
              </div>
              <button class="portal-button">Acessar Portal</button>
              <div class="portal-arrow">›</div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h2>Sistema RADAR</h2>
          <p>Plataforma integrada para gestão de operações de fiscalização DETRAN, com foco na experiência do usuário e eficiência operacional.</p>
        </div>
        
        <div class="grid">
          <div class="card">
            <h3>👥 Gestão de Membros</h3>
            <p>Controle completo do efetivo com perfis, regionais e disponibilidade.</p>
            <ul>
              <li>Cadastro de servidores por regional</li>
              <li>Controle de perfis (Membro, Supervisor, Admin)</li>
              <li>Verificação automática de disponibilidade</li>
            </ul>
          </div>
          
          <div class="card">
            <h3>📅 Operações Inteligentes</h3>
            <p>Planejamento e execução de operações BLITZ e BALANÇA.</p>
            <ul>
              <li>Modalidades BLITZ e BALANÇA</li>
              <li>Gestão automática de vagas</li>
              <li>Controle de ciclo funcional 10→09</li>
            </ul>
          </div>
          
          <div class="card">
            <h3>📈 EU VOU Sistema</h3>
            <p>Participação voluntária com validações automáticas e filas inteligentes.</p>
            <ul>
              <li>Validação automática de limites</li>
              <li>Cálculo de diárias em tempo real</li>
              <li>Sistema de filas por modalidade</li>
            </ul>
          </div>
        </div>
        
        <div class="card">
          <h3>🏗️ Arquitetura Clean & Robusta</h3>
          <p>Implementação seguindo padrões de Clean Architecture com TypeScript + Next.js</p>
          <div class="grid">
            <div>
              <h4>Domain Layer</h4>
              <ul>
                <li>Entities: Operacao, Participacao, Servidor</li>
                <li>Value Objects: Modalidade, CicloFuncional</li>
                <li>Domain Services: EuVouOrchestrator, ValidadorParticipacao</li>
              </ul>
            </div>
            <div>
              <h4>Infrastructure</h4>
              <ul>
                <li>Supabase Integration via MCP</li>
                <li>Repository Pattern Implementation</li>
                <li>Zero Hardcode - Parametrização Total</li>
              </ul>
            </div>
          </div>
        </div>
        
        <div class="card">
          <h3>📊 Status do Sistema</h3>
          <div class="status">
            <div class="status-item">
              <div class="green">✅</div>
              <div>Domain Layer</div>
              <small class="green">Completo</small>
            </div>
            <div class="status-item">
              <div class="green">✅</div>
              <div>Application Layer</div>
              <small class="green">Completo</small>
            </div>
            <div class="status-item">
              <div class="blue">🔄</div>
              <div>Infrastructure</div>
              <small class="blue">Em progresso</small>
            </div>
            <div class="status-item">
              <div class="orange">⏳</div>
              <div>Interface</div>
              <small class="orange">Pendente</small>
            </div>
          </div>
        </div>
        
        <div class="card">
          <p>&copy; 2024 RADAR DETRAN - Sistema de Gestão de Operações</p>
          <p><small>Desenvolvido com Clean Architecture • Next.js • TypeScript • Supabase</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
} 
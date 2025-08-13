# Implementation Plan

- [x] 1. Implementar migração do banco de dados





  - Criar migração SQL para adicionar campos de inativação na tabela operacao
  - Adicionar índice para performance em consultas de operações inativas
  - _Requirements: 1.4, 2.2_

- [x] 2. Criar API para inativar/reativar múltiplas operações





  - Implementar endpoint POST `/api/supervisor/operacoes/inativar-multiplas`
  - Validar permissões de supervisor e regional
  - Processar array de IDs de operações para inativar/reativar
  - _Requirements: 1.3, 2.2_

- [x] 3. Modificar APIs de participação para verificar operações inativas





  - Atualizar API de solicitação de participação para verificar `inativa_pelo_supervisor`
  - Atualizar API de cancelamento de participação para verificar `inativa_pelo_supervisor`
  - Retornar erro específico quando operação estiver inativa
  - _Requirements: 5.1, 5.2, 5.3_

- [x] 4. Implementar validação na exclusão de janelas operacionais






  - Modificar API de exclusão de janela para verificar operações inativas
  - Retornar lista de operações inativas que impedem a exclusão
  - Bloquear exclusão até que todas operações sejam reativadas
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 5. Criar componente Modal de Inativação de Operações








  - Implementar `ModalInativacaoOperacoes.tsx` com calendário pequeno
  - Adicionar seleção múltipla de operações com checkboxes
  - Implementar botões "Inativar Selecionadas" e "Reativar Selecionadas"
  - Adicionar campo opcional para motivo da inativação
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 6. Adicionar botão de inativação no calendário do supervisor







  - Inserir botão "📁 Inativar Operações" no cabeçalho do CalendarioSupervisor
  - Implementar abertura do modal de inativação
  - Adicionar estado para controlar abertura/fechamento do modal
  - _Requirements: 1.1_

- [x] 7. Implementar estilização de operações inativas no calendário supervisor





  - Aplicar classe CSS `operacao-inativa` para operações com `inativa_pelo_supervisor=true`
  - Adicionar tarjeta "HISTÓRICO" com CSS ::after
  - Implementar filtro grayscale e opacidade reduzida
  - _Requirements: 3.1, 3.2_

- [x] 8. Modificar portal do membro para exibir operações inativas





  - Atualizar CalendarioMembro para aplicar estilo diferenciado em operações inativas
  - Desabilitar botões "Eu Vou" e "Cancelar" para operações inativas
  - Exibir texto "📁 Histórico" no lugar dos botões de ação
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 9. Atualizar modal de detalhes da operação para membros



  - Modificar ModalOperacao para não exibir botões de ação em operações inativas
  - Manter visualização de detalhes mas sem possibilidade de interação
  - _Requirements: 3.4_

- [ ] 10. Integrar com sistema de realtime
  - Atualizar useRealtimeUnified para detectar mudanças em `inativa_pelo_supervisor`
  - Garantir que mudanças de status sejam refletidas em tempo real
  - Atualizar tanto portal supervisor quanto membro automaticamente
  - _Requirements: 1.3, 2.2_

- [ ] 11. Implementar testes unitários
  - Criar testes para API de inativação/reativação múltipla
  - Testar validações de operações inativas nas APIs de participação
  - Testar componente ModalInativacaoOperacoes
  - _Requirements: Todos_

- [ ] 12. Implementar testes de integração
  - Testar fluxo completo: supervisor inativa → membro visualiza → supervisor reativa
  - Testar bloqueio de exclusão de janela com operações inativas
  - Testar atualização em tempo real entre portais
  - _Requirements: Todos_
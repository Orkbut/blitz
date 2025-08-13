# Requirements Document

## Introduction

Esta funcionalidade permite que supervisores marquem operações específicas como "históricas" através de um calendário modal, impedindo que membros interajam com elas (solicitar/cancelar participação), mas mantendo a visualização com estilo diferenciado. Supervisores podem reativar operações a qualquer momento.

## Requirements

### Requirement 1

**User Story:** Como supervisor, eu quero inativar operações específicas através de um calendário modal, para que membros não possam mais interagir com operações canceladas ou problemáticas.

#### Acceptance Criteria

1. WHEN supervisor clica no botão "Inativar Operações" no cabeçalho do calendário THEN sistema SHALL abrir um modal com calendário pequeno mostrando operações ativas
2. WHEN supervisor seleciona operações no calendário modal THEN sistema SHALL destacar visualmente as operações selecionadas
3. WHEN supervisor clica em "Confirmar" no modal THEN sistema SHALL inativar as operações selecionadas sem solicitar motivo obrigatório
4. WHEN operação é inativada THEN sistema SHALL adicionar campos `inativa_pelo_supervisor=true`, `data_inativacao`, `supervisor_inativacao_id` no banco

### Requirement 2

**User Story:** Como supervisor, eu quero reativar operações inativadas, para que membros possam voltar a interagir com elas caso necessário.

#### Acceptance Criteria

1. WHEN supervisor clica no botão "Inativar Operações" THEN sistema SHALL mostrar operações inativas no calendário modal com estilo diferenciado
2. WHEN supervisor seleciona operações inativas e clica "Confirmar" THEN sistema SHALL reativar as operações (definir `inativa_pelo_supervisor=false`)
3. WHEN operação é reativada THEN sistema SHALL limpar campos de inativação no banco

### Requirement 3

**User Story:** Como membro, eu quero visualizar operações inativas com estilo diferenciado, para que eu saiba que não posso interagir com elas.

#### Acceptance Criteria

1. WHEN membro visualiza calendário THEN sistema SHALL mostrar operações inativas com cor pálida e filtro grayscale
2. WHEN operação está inativa THEN sistema SHALL exibir tarjeta "HISTÓRICO" em cada quadradinho da grid
3. WHEN membro tenta interagir com operação inativa THEN sistema SHALL desabilitar botões "Eu Vou" e "Cancelar"
4. WHEN membro abre modal de operação inativa THEN sistema SHALL mostrar detalhes mas sem botões de ação

### Requirement 4

**User Story:** Como supervisor, eu quero ser impedido de excluir janelas que contenham operações inativas, para manter integridade dos dados históricos.

#### Acceptance Criteria

1. WHEN supervisor tenta excluir janela operacional THEN sistema SHALL verificar se existem operações inativas na janela
2. IF janela contém operações inativas THEN sistema SHALL exibir alerta informando quais operações estão inativas
3. WHEN alerta é exibido THEN sistema SHALL impedir exclusão da janela até que todas operações sejam reativadas

### Requirement 5

**User Story:** Como membro, eu quero ser impedido de solicitar ou cancelar participação em operações inativas, para evitar ações desnecessárias.

#### Acceptance Criteria

1. WHEN membro tenta solicitar participação em operação inativa THEN API SHALL retornar erro "Esta operação está no histórico"
2. WHEN membro tenta cancelar participação em operação inativa THEN API SHALL retornar erro "Esta operação está no histórico"
3. WHEN API recebe requisição para operação inativa THEN sistema SHALL verificar campo `inativa_pelo_supervisor` antes de processar
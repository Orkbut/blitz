/**
 * Testes unitários para LoadingStates
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoadingStates } from '../LoadingStates';

// Mock dos estilos CSS
vi.mock('../../GerenciarMembrosModal.module.css', () => ({
  default: {
    memberListSkeleton: 'memberListSkeleton',
    memberItemSkeleton: 'memberItemSkeleton',
    avatarSkeleton: 'avatarSkeleton',
    contentSkeleton: 'contentSkeleton',
    nameSkeleton: 'nameSkeleton',
    emailSkeleton: 'emailSkeleton',
    actionsSkeleton: 'actionsSkeleton',
    formSkeleton: 'formSkeleton',
    inputSkeleton: 'inputSkeleton',
    buttonSkeleton: 'buttonSkeleton',
    operationCardSkeleton: 'operationCardSkeleton',
    operationHeaderSkeleton: 'operationHeaderSkeleton',
    operationContentSkeleton: 'operationContentSkeleton',
    operationInfoSkeleton: 'operationInfoSkeleton',
    operationActionsSkeleton: 'operationActionsSkeleton',
    loadingContainer: 'loadingContainer',
    loadingSpinner: 'loadingSpinner',
    spinning: 'spinning',
    emptyState: 'emptyState',
    emptyIcon: 'emptyIcon',
    emptyHint: 'emptyHint',
    errorState: 'errorState',
    errorIcon: 'errorIcon',
    retryButton: 'retryButton',
    actionLoading: 'actionLoading',
  }
}));

// Mock das constantes
vi.mock('../../utils/constants', () => ({
  constants: {
    UI: {
      SKELETON_ITEMS: 3,
    },
    MESSAGES: {
      LOADING: 'Carregando...',
      NO_MEMBERS: 'Nenhum membro encontrado',
      CONNECTION_ERROR: 'Erro de conexão',
    },
  },
}));

describe('LoadingStates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MemberList Skeleton', () => {
    it('deve renderizar skeleton da lista de membros', () => {
      render(<LoadingStates.MemberList />);
      
      // Deve renderizar 3 itens skeleton (baseado na constante mockada)
      const skeletonItems = document.querySelectorAll('.memberItemSkeleton');
      expect(skeletonItems).toHaveLength(3);
    });
  });

  describe('MemberForm Skeleton', () => {
    it('deve renderizar skeleton do formulário', () => {
      render(<LoadingStates.MemberForm />);
      
      expect(document.querySelector('.formSkeleton')).toBeInTheDocument();
      expect(document.querySelectorAll('.inputSkeleton')).toHaveLength(3);
      expect(document.querySelector('.buttonSkeleton')).toBeInTheDocument();
    });
  });

  describe('OperationCard Skeleton', () => {
    it('deve renderizar skeleton do card de operação', () => {
      render(<LoadingStates.OperationCard />);
      
      expect(document.querySelector('.operationCardSkeleton')).toBeInTheDocument();
      expect(document.querySelector('.operationHeaderSkeleton')).toBeInTheDocument();
      expect(document.querySelector('.operationContentSkeleton')).toBeInTheDocument();
    });
  });

  describe('Loading Spinner', () => {
    it('deve renderizar spinner com mensagem padrão', () => {
      render(<LoadingStates.Spinner />);
      
      expect(screen.getByText('Carregando...')).toBeInTheDocument();
    });

    it('deve renderizar spinner com mensagem customizada', () => {
      render(<LoadingStates.Spinner message="Salvando dados..." />);
      
      expect(screen.getByText('Salvando dados...')).toBeInTheDocument();
    });
  });

  describe('Inline Spinner', () => {
    it('deve renderizar spinner inline', () => {
      render(<LoadingStates.InlineSpinner />);
      
      expect(document.querySelector('.spinning')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('deve renderizar estado vazio com mensagem padrão', () => {
      render(<LoadingStates.Empty />);
      
      expect(screen.getByText('Nenhum membro encontrado')).toBeInTheDocument();
    });

    it('deve renderizar estado vazio com mensagem customizada', () => {
      render(<LoadingStates.Empty message="Nenhuma operação disponível" />);
      
      expect(screen.getByText('Nenhuma operação disponível')).toBeInTheDocument();
    });

    it('deve mostrar dica de busca quando showSearch=true', () => {
      render(<LoadingStates.Empty showSearch={true} />);
      
      expect(screen.getByText('Tente ajustar os filtros de busca')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('deve renderizar estado de erro com mensagem padrão', () => {
      render(<LoadingStates.Error />);
      
      expect(screen.getByText('Erro de conexão')).toBeInTheDocument();
    });

    it('deve renderizar estado de erro com mensagem customizada', () => {
      render(<LoadingStates.Error message="Erro personalizado" />);
      
      expect(screen.getByText('Erro personalizado')).toBeInTheDocument();
    });

    it('deve chamar onRetry quando botão é clicado', () => {
      const mockRetry = vi.fn();
      render(<LoadingStates.Error onRetry={mockRetry} />);
      
      const retryButton = screen.getByText('Tentar novamente');
      fireEvent.click(retryButton);
      
      expect(mockRetry).toHaveBeenCalledTimes(1);
    });

    it('não deve mostrar botão retry quando onRetry não é fornecido', () => {
      render(<LoadingStates.Error />);
      
      expect(screen.queryByText('Tentar novamente')).not.toBeInTheDocument();
    });
  });

  describe('Action Loading', () => {
    it('deve renderizar loading de ação com texto', () => {
      render(<LoadingStates.ActionLoading action="Salvando" />);
      
      expect(screen.getByText('Salvando...')).toBeInTheDocument();
      expect(document.querySelector('.spinning')).toBeInTheDocument();
    });
  });
});
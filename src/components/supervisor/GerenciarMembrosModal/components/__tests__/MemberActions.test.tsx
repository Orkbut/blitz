/**
 * Testes unitários para MemberActions
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemberActions } from '../MemberActions';

// Mock dos estilos CSS
vi.mock('../../GerenciarMembrosModal.module.css', () => ({
  default: {
    memberActions: 'memberActions',
    actionButton: 'actionButton',
    addButton: 'addButton',
    removeButton: 'removeButton',
    approveButton: 'approveButton',
    rejectButton: 'rejectButton',
    spinning: 'spinning',
  }
}));

// Props padrão para testes
const defaultProps = {
  membroId: 1,
  participacaoId: 10,
  acoes: ['adicionar', 'remover', 'aprovar', 'rejeitar'],
  loading: false,
  onAdicionarMembro: vi.fn().mockResolvedValue(undefined),
  onRemoverMembro: vi.fn().mockResolvedValue(undefined),
  onAprovarSolicitacao: vi.fn().mockResolvedValue(undefined),
  onRejeitarSolicitacao: vi.fn().mockResolvedValue(undefined),
};

describe('MemberActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar todos os botões quando todas as ações estão disponíveis', () => {
    render(<MemberActions {...defaultProps} />);
    
    expect(screen.getByText('Adicionar')).toBeInTheDocument();
    expect(screen.getByText('Remover')).toBeInTheDocument();
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
    expect(screen.getByText('Rejeitar')).toBeInTheDocument();
  });

  it('deve renderizar apenas botões para ações disponíveis', () => {
    render(<MemberActions {...defaultProps} acoes={['adicionar', 'aprovar']} />);
    
    expect(screen.getByText('Adicionar')).toBeInTheDocument();
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
    expect(screen.queryByText('Remover')).not.toBeInTheDocument();
    expect(screen.queryByText('Rejeitar')).not.toBeInTheDocument();
  });

  it('não deve renderizar nada quando não há ações disponíveis', () => {
    const { container } = render(<MemberActions {...defaultProps} acoes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('deve chamar onAdicionarMembro quando botão adicionar é clicado', () => {
    const mockOnAdicionar = vi.fn().mockResolvedValue(undefined);
    render(<MemberActions {...defaultProps} acoes={['adicionar']} onAdicionarMembro={mockOnAdicionar} />);
    
    const addButton = screen.getByText('Adicionar');
    fireEvent.click(addButton);
    
    expect(mockOnAdicionar).toHaveBeenCalledWith(1);
  });

  it('deve chamar onRemoverMembro quando botão remover é clicado', () => {
    const mockOnRemover = vi.fn().mockResolvedValue(undefined);
    render(<MemberActions {...defaultProps} acoes={['remover']} onRemoverMembro={mockOnRemover} />);
    
    const removeButton = screen.getByText('Remover');
    fireEvent.click(removeButton);
    
    expect(mockOnRemover).toHaveBeenCalledWith(10);
  });

  it('deve desabilitar botões quando loading=true', () => {
    render(<MemberActions {...defaultProps} loading={true} />);
    
    expect(screen.getByText('Adicionar').closest('button')).toBeDisabled();
    expect(screen.getByText('Remover').closest('button')).toBeDisabled();
    expect(screen.getByText('Aprovar').closest('button')).toBeDisabled();
    expect(screen.getByText('Rejeitar').closest('button')).toBeDisabled();
  });
});
/**
 * Testes unitários básicos para MemberList
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemberList } from '../MemberList';
import type { Membro } from '../../types';

// Mock dos estilos CSS
vi.mock('../../GerenciarMembrosModal.module.css', () => ({
  default: {
    membrosList: 'membrosList',
    mobile: 'mobile',
    desktop: 'desktop',
    semResultados: 'semResultados',
  }
}));

// Mock do MembroCard
vi.mock('../MembroCard', () => ({
  MembroCard: ({ membro }: { membro: Membro }) => (
    <div data-testid={`membro-${membro.id}`}>
      {membro.nome} - {membro.matricula}
    </div>
  ),
}));

// Mock do LoadingStates
vi.mock('../LoadingStates', () => ({
  LoadingStates: {
    MemberList: () => <div data-testid="loading-skeleton">Loading...</div>,
  },
}));

const mockMembros: Membro[] = [
  { id: 1, nome: 'João Silva', matricula: '12345', perfil: 'Agente', ativo: true },
  { id: 2, nome: 'Maria Santos', matricula: '67890', perfil: 'Supervisor', ativo: true },
];

// Props padrão para testes
const defaultProps = {
  members: mockMembros,
  searchTerm: '',
  operacaoSelecionada: null,
  loading: false,
  isMobile: false,
  getStatusParticipacao: vi.fn(() => ({ label: null, acoes: ['adicionar'] })),
  onAdicionarMembro: vi.fn(),
  onAprovarSolicitacao: vi.fn(),
  onRejeitarSolicitacao: vi.fn(),
  onRemoverMembro: vi.fn(),
};

describe('MemberList', () => {
  it('deve renderizar lista de membros corretamente', () => {
    render(<MemberList {...defaultProps} />);
    
    expect(screen.getByTestId('membro-1')).toBeInTheDocument();
    expect(screen.getByTestId('membro-2')).toBeInTheDocument();
  });

  it('deve mostrar loading skeleton quando loading=true', () => {
    render(<MemberList {...defaultProps} loading={true} />);
    
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('deve mostrar estado vazio quando não há membros', () => {
    render(<MemberList {...defaultProps} members={[]} />);
    
    expect(screen.getByText('Nenhum membro encontrado')).toBeInTheDocument();
  });
});
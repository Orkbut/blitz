/**
 * Testes unitários básicos para MemberForm
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemberForm } from '../MemberForm';

// Mock dos estilos CSS
vi.mock('../../GerenciarMembrosModal.module.css', () => ({
  default: {
    memberFormContainer: 'memberFormContainer',
    memberFormHeader: 'memberFormHeader',
    memberForm: 'memberForm',
    formGroup: 'formGroup',
    formLabel: 'formLabel',
    formInput: 'formInput',
    formSelect: 'formSelect',
    validationErrors: 'validationErrors',
    errorMessage: 'errorMessage',
    formActions: 'formActions',
    cancelButton: 'cancelButton',
    saveButton: 'saveButton',
    closeButton: 'closeButton',
  }
}));

// Mock do LoadingStates
vi.mock('../LoadingStates', () => ({
  LoadingStates: {
    MemberForm: () => <div data-testid="form-loading">Loading form...</div>,
  },
}));

// Props padrão para testes
const defaultProps = {
  isOpen: true,
  loading: false,
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

describe('MemberForm', () => {
  it('não deve renderizar quando isOpen=false', () => {
    render(<MemberForm {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Adicionar Membro')).not.toBeInTheDocument();
  });

  it('deve mostrar loading quando loading=true', () => {
    render(<MemberForm {...defaultProps} loading={true} />);
    expect(screen.getByTestId('form-loading')).toBeInTheDocument();
  });

  it('deve renderizar formulário de adição quando não há membro', () => {
    render(<MemberForm {...defaultProps} />);
    expect(screen.getByText('Adicionar Membro')).toBeInTheDocument();
  });
});
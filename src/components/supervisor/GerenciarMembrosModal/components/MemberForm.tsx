/**
 * Componente MemberForm
 * 
 * Componente memoizado para formulário de edição/criação de membros
 * com validação local e estados de loading.
 */

import React, { memo, useState, useCallback, useEffect } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';
import type { Membro, CreateMemberData, ValidationResult } from '../types';
import { memberValidation } from '../utils/memberValidation';
import { LoadingStates } from './LoadingStates';
import styles from '../GerenciarMembrosModal.module.css';

interface MemberFormProps {
  member?: Membro | null;
  isOpen: boolean;
  loading: boolean;
  onSave: (memberData: CreateMemberData) => Promise<void>;
  onCancel: () => void;
}

export const MemberForm = memo<MemberFormProps>(({
  member,
  isOpen,
  loading,
  onSave,
  onCancel
}) => {
  // Estados do formulário
  const [formData, setFormData] = useState<CreateMemberData>({
    name: '',
    email: '',
    role: ''
  });
  
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: []
  });

  const [isDirty, setIsDirty] = useState(false);

  // ✅ EFEITO: Preencher formulário quando membro é selecionado
  useEffect(() => {
    if (member) {
      setFormData({
        name: member.nome || '',
        email: '', // Email não está disponível no tipo Membro atual
        role: member.perfil || ''
      });
    } else {
      setFormData({
        name: '',
        email: '',
        role: ''
      });
    }
    setIsDirty(false);
    setValidation({ isValid: true, errors: [] });
  }, [member]);

  // ✅ CALLBACK: Atualizar campo do formulário
  const handleFieldChange = useCallback((field: keyof CreateMemberData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: field === 'name' ? memberValidation.sanitizeName(value) : value
    }));
    setIsDirty(true);

    // Limpar erros de validação quando usuário começa a digitar
    if (validation.errors.length > 0) {
      setValidation({ isValid: true, errors: [] });
    }
  }, [validation.errors.length]);

  // ✅ CALLBACK: Validar formulário
  const validateForm = useCallback((): boolean => {
    const result = memberValidation.validateMemberData(formData);
    setValidation(result);
    return result.isValid;
  }, [formData]);

  // ✅ CALLBACK: Submeter formulário
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSave(formData);
      setIsDirty(false);
    } catch (error) {
      // Erro será tratado pelo componente pai
      console.error('Erro ao salvar membro:', error);
    }
  }, [formData, validateForm, onSave]);

  // ✅ CALLBACK: Cancelar edição
  const handleCancel = useCallback(() => {
    if (isDirty) {
      const confirmCancel = window.confirm(
        'Você tem alterações não salvas. Deseja realmente cancelar?'
      );
      if (!confirmCancel) return;
    }
    
    onCancel();
  }, [isDirty, onCancel]);

  // ✅ CALLBACK: Handlers de campo específicos
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange('name', e.target.value);
  }, [handleFieldChange]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFieldChange('email', e.target.value);
  }, [handleFieldChange]);

  const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    handleFieldChange('role', e.target.value);
  }, [handleFieldChange]);

  // Não renderizar se não estiver aberto
  if (!isOpen) {
    return null;
  }

  // ✅ ESTADO DE LOADING
  if (loading) {
    return (
      <div className={styles.memberFormContainer}>
        <LoadingStates.MemberForm />
      </div>
    );
  }

  return (
    <div className={styles.memberFormContainer}>
      <div className={styles.memberFormHeader}>
        <h3>{member ? 'Editar Membro' : 'Adicionar Membro'}</h3>
        <button
          type="button"
          onClick={handleCancel}
          className={styles.closeButton}
          aria-label="Fechar formulário"
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.memberForm}>
        {/* Campo Nome */}
        <div className={styles.formGroup}>
          <label htmlFor="member-name" className={styles.formLabel}>
            Nome *
          </label>
          <input
            id="member-name"
            type="text"
            value={formData.name}
            onChange={handleNameChange}
            className={styles.formInput}
            placeholder="Digite o nome completo"
            required
            disabled={loading}
          />
        </div>

        {/* Campo Email */}
        <div className={styles.formGroup}>
          <label htmlFor="member-email" className={styles.formLabel}>
            Email *
          </label>
          <input
            id="member-email"
            type="email"
            value={formData.email}
            onChange={handleEmailChange}
            className={styles.formInput}
            placeholder="Digite o email"
            required
            disabled={loading}
          />
        </div>

        {/* Campo Função */}
        <div className={styles.formGroup}>
          <label htmlFor="member-role" className={styles.formLabel}>
            Função *
          </label>
          <select
            id="member-role"
            value={formData.role}
            onChange={handleRoleChange}
            className={styles.formSelect}
            required
            disabled={loading}
          >
            <option value="">Selecione uma função</option>
            <option value="Agente">Agente</option>
            <option value="Supervisor">Supervisor</option>
            <option value="Coordenador">Coordenador</option>
            <option value="Diretor">Diretor</option>
          </select>
        </div>

        {/* Erros de Validação */}
        {!validation.isValid && validation.errors.length > 0 && (
          <div className={styles.validationErrors}>
            <AlertCircle size={16} />
            <div>
              {validation.errors.map((error, index) => (
                <p key={index} className={styles.errorMessage}>
                  {error}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className={styles.formActions}>
          <button
            type="button"
            onClick={handleCancel}
            className={styles.cancelButton}
            disabled={loading}
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className={styles.saveButton}
            disabled={loading || !isDirty}
          >
            <Save size={16} />
            {member ? 'Atualizar' : 'Adicionar'}
          </button>
        </div>
      </form>
    </div>
  );
});

MemberForm.displayName = 'MemberForm';
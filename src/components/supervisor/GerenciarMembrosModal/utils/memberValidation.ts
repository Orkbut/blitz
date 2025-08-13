/**
 * Utilitários de validação para membros
 */

import type { ValidationResult, CreateMemberData } from '../types';

/**
 * Valida dados de criação de membro
 */
export const validateMemberData = (data: CreateMemberData): ValidationResult => {
  const errors: string[] = [];

  if (!data.name?.trim()) {
    errors.push('Nome é obrigatório');
  }

  if (!data.email?.trim()) {
    errors.push('Email é obrigatório');
  } else if (!isValidEmail(data.email)) {
    errors.push('Email inválido');
  }

  if (!data.role?.trim()) {
    errors.push('Função é obrigatória');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Valida formato de email
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida matrícula de membro
 */
export const validateMatricula = (matricula: string): boolean => {
  // Assumindo formato básico de matrícula
  return matricula?.trim().length >= 3;
};

/**
 * Sanitiza nome de membro
 */
export const sanitizeName = (name: string): string => {
  return name?.trim().replace(/\s+/g, ' ') || '';
};

export const memberValidation = {
  validateMemberData,
  validateMatricula,
  sanitizeName,
  isValidEmail,
};
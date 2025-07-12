import { useState, useEffect } from 'react';

export interface ModalConfig {
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'input';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: (inputValue?: string) => void;
  onCancel?: () => void;
  inputPlaceholder?: string;
  inputValue?: string;
  inputMinLength?: number;
}

export const useModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<ModalConfig | null>(null);

  // Hook para fechar modal com ESC ou Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || !config) return;

      if (e.key === 'Escape') {
        if (config.type === 'confirm' && config.onCancel) {
          config.onCancel();
        }
        setIsOpen(false);
      }

      if (e.key === 'Enter') {
        if (config.type === 'confirm' && config.onConfirm) {
          config.onConfirm();
        }
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, config]);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setConfig({
      title,
      message,
      type,
      confirmText: 'OK'
    });
    setIsOpen(true);
  };

  const showConfirm = (
    title: string, 
    message: string, 
    onConfirm: () => void,
    onCancel?: () => void,
    confirmText: string = 'Confirmar',
    cancelText: string = 'Cancelar'
  ) => {
    setConfig({
      title,
      message,
      type: 'confirm',
      confirmText,
      cancelText,
      onConfirm: () => {
        onConfirm();
        setIsOpen(false);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setIsOpen(false);
      }
    });
    setIsOpen(true);
  };

  const showInput = (
    title: string,
    message: string,
    onConfirm: (inputValue: string) => void,
    onCancel?: () => void,
    inputPlaceholder: string = '',
    initialValue: string = '',
    minLength: number = 0,
    confirmText: string = 'Confirmar',
    cancelText: string = 'Cancelar'
  ) => {
    setConfig({
      title,
      message,
      type: 'input',
      confirmText,
      cancelText,
      inputPlaceholder,
      inputValue: initialValue,
      inputMinLength: minLength,
      onConfirm: (inputValue?: string) => {
        if (inputValue !== undefined) {
          onConfirm(inputValue);
        }
        setIsOpen(false);
      },
      onCancel: () => {
        if (onCancel) onCancel();
        setIsOpen(false);
      }
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return {
    isOpen,
    config,
    showAlert,
    showConfirm,
    showInput,
    closeModal
  };
}; 
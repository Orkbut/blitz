'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface ModalState {
  id: string;
  onClose: () => void;
  priority?: number; // Maior prioridade = fechado primeiro
}

export function useNativeBackButton() {
  const router = useRouter();
  const modalStack = useRef<ModalState[]>([]);
  const isHandlingBack = useRef(false);

  // Registrar modal aberto
  const registerModal = useCallback((modal: ModalState) => {
    // Remover modal existente com mesmo ID
    modalStack.current = modalStack.current.filter(m => m.id !== modal.id);
    
    // Adicionar novo modal
    modalStack.current.push(modal);
    
    // Ordenar por prioridade (maior prioridade primeiro)
    modalStack.current.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Adicionar entrada no histórico para interceptar o botão voltar
    window.history.pushState({ modalId: modal.id }, '', window.location.href);
  }, []);

  // Desregistrar modal fechado
  const unregisterModal = useCallback((modalId: string) => {
    const modalIndex = modalStack.current.findIndex(m => m.id === modalId);
    if (modalIndex !== -1) {
      modalStack.current.splice(modalIndex, 1);
      
      // Se não há mais modais, voltar ao estado normal do histórico
      if (modalStack.current.length === 0 && !isHandlingBack.current) {
        // Remover a entrada extra do histórico
        window.history.back();
      }
    }
  }, []);

  // Fechar modal mais prioritário
  const closeTopModal = useCallback(() => {
    if (modalStack.current.length > 0) {
      const topModal = modalStack.current[modalStack.current.length - 1];
      topModal.onClose();
      return true;
    }
    return false;
  }, []);

  // Interceptar evento popstate (botão voltar)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Evitar loop infinito
      if (isHandlingBack.current) {
        return;
      }

      isHandlingBack.current = true;

      // Se há modais abertos, fechar o mais prioritário
      if (modalStack.current.length > 0) {
        event.preventDefault();
        const topModal = modalStack.current.pop();
        if (topModal) {
          topModal.onClose();
        }
        
        // Se ainda há modais, manter no histórico
        if (modalStack.current.length > 0) {
          window.history.pushState({ modalId: modalStack.current[modalStack.current.length - 1].id }, '', window.location.href);
        }
      }

      // Reset flag após um pequeno delay
      setTimeout(() => {
        isHandlingBack.current = false;
      }, 100);
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Limpar stack quando componente desmonta
  useEffect(() => {
    return () => {
      modalStack.current = [];
    };
  }, []);

  return {
    registerModal,
    unregisterModal,
    closeTopModal,
    hasOpenModals: () => modalStack.current.length > 0,
    getModalCount: () => modalStack.current.length
  };
}

// Hook específico para modais
export function useModalBackButton(
  modalId: string,
  isOpen: boolean,
  onClose: () => void,
  priority: number = 0
) {
  const { registerModal, unregisterModal } = useNativeBackButton();

  useEffect(() => {
    if (isOpen) {
      registerModal({
        id: modalId,
        onClose,
        priority
      });

      return () => {
        unregisterModal(modalId);
      };
    }
  }, [isOpen, modalId, onClose, priority, registerModal, unregisterModal]);
}
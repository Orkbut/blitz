import React, { useState, useEffect } from 'react';
import { ModalConfig } from '../../../hooks/useModal';

interface UniversalModalProps {
  isOpen: boolean;
  config: ModalConfig | null;
  onClose: () => void;
}

const UniversalModal: React.FC<UniversalModalProps> = ({ isOpen, config, onClose }) => {
  const [inputValue, setInputValue] = useState('');
  
  // Resetar valor do input quando o modal abre
  useEffect(() => {
    if (isOpen && config?.type === 'input') {
      setInputValue(config.inputValue || '');
    }
  }, [isOpen, config]);
  
  if (!isOpen || !config) return null;

  const getIcon = () => {
    switch (config.type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'confirm': return '❓';
      case 'input': return '✏️';
      default: return 'ℹ️';
    }
  };

  const getColors = () => {
    switch (config.type) {
      case 'success': 
        return {
          bg: '#f0f9ff',
          border: '#bfdbfe',
          iconColor: '#16a34a',
          buttonColor: '#16a34a'
        };
      case 'error': 
        return {
          bg: '#fef2f2',
          border: '#fecaca',
          iconColor: '#dc2626',
          buttonColor: '#dc2626'
        };
      case 'warning': 
        return {
          bg: '#fffbeb',
          border: '#fed7aa',
          iconColor: '#d97706',
          buttonColor: '#d97706'
        };
      case 'confirm': 
        return {
          bg: '#f8fafc',
          border: '#cbd5e1',
          iconColor: '#3b82f6',
          buttonColor: '#3b82f6'
        };
      case 'input': 
        return {
          bg: '#f8fafc',
          border: '#cbd5e1',
          iconColor: '#3b82f6',
          buttonColor: '#3b82f6'
        };
      default: 
        return {
          bg: '#f0f9ff',
          border: '#bfdbfe',
          iconColor: '#3b82f6',
          buttonColor: '#3b82f6'
        };
    }
  };

  const colors = getColors();

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '24px 24px 16px 24px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              fontSize: '24px',
              color: colors.iconColor
            }}>
              {getIcon()}
            </div>
            <h3 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: '#1f2937'
            }}>
              {config.title}
            </h3>
          </div>
        </div>

        {/* Content */}
        <div style={{
          padding: '20px 24px',
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
          margin: '0 24px',
          borderRadius: '8px'
        }}>
          <p style={{
            margin: config.type === 'input' ? '0 0 16px 0' : 0,
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#374151',
            whiteSpace: 'pre-wrap'
          }}>
            {config.message}
          </p>
          
          {config.type === 'input' && (
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={config.inputPlaceholder || 'Digite sua resposta...'}
              style={{
                width: '100%',
                minHeight: '80px',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = colors.buttonColor;
                e.target.style.boxShadow = `0 0 0 3px ${colors.buttonColor}20`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.boxShadow = 'none';
              }}
            />
          )}
          
          {config.type === 'input' && config.inputMinLength && (
            <p style={{
              margin: '8px 0 0 0',
              fontSize: '12px',
              color: inputValue.length >= config.inputMinLength ? '#16a34a' : '#dc2626'
            }}>
              {inputValue.length >= config.inputMinLength 
                ? `✅ ${inputValue.length} caracteres (mínimo ${config.inputMinLength})`
                : `⚠️ ${inputValue.length}/${config.inputMinLength} caracteres mínimos`
              }
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px 24px',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          {config.type === 'confirm' || config.type === 'input' ? (
            <>
              <button
                onClick={() => {
                  if (config.onCancel) config.onCancel();
                  else onClose();
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: '#374151',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#e5e7eb';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#f3f4f6';
                }}
              >
                {config.cancelText || 'Cancelar'}
              </button>
              <button
                onClick={() => {
                  if (config.type === 'input') {
                    // Validar input se necessário
                    if (config.inputMinLength && inputValue.length < config.inputMinLength) {
                      return; // Não permitir confirmação se não atende ao mínimo
                    }
                    if (config.onConfirm) config.onConfirm(inputValue);
                  } else {
                    if (config.onConfirm) config.onConfirm();
                  }
                }}
                disabled={config.type === 'input' && config.inputMinLength ? inputValue.length < config.inputMinLength : false}
                style={{
                  padding: '10px 20px',
                  backgroundColor: (config.type === 'input' && config.inputMinLength && inputValue.length < config.inputMinLength) 
                    ? '#9ca3af' 
                    : colors.buttonColor,
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (config.type === 'input' && config.inputMinLength && inputValue.length < config.inputMinLength) 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'white',
                  transition: 'all 0.2s',
                  opacity: (config.type === 'input' && config.inputMinLength && inputValue.length < config.inputMinLength) 
                    ? '0.6' 
                    : '1'
                }}
                onMouseOver={(e) => {
                  if (!(config.type === 'input' && config.inputMinLength && inputValue.length < config.inputMinLength)) {
                    e.currentTarget.style.opacity = '0.9';
                  }
                }}
                onMouseOut={(e) => {
                  if (!(config.type === 'input' && config.inputMinLength && inputValue.length < config.inputMinLength)) {
                    e.currentTarget.style.opacity = '1';
                  }
                }}
              >
                {config.confirmText || 'Confirmar'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                backgroundColor: colors.buttonColor,
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                color: 'white',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              {config.confirmText || 'OK'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UniversalModal; 
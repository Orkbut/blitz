import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { CirculoProgresso } from './CirculoProgresso';

describe('CirculoProgresso', () => {
  const defaultProps = {
    valorAtual: 75,
    valorMaximo: 100,
    rotulo: 'Teste'
  };

  it('renderiza corretamente com props básicas', () => {
    render(<CirculoProgresso {...defaultProps} />);
    
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Teste')).toBeInTheDocument();
  });

  it('configura atributos ARIA corretamente', () => {
    render(<CirculoProgresso {...defaultProps} />);
    
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '75');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('aplica tamanho correto', () => {
    const { container } = render(
      <CirculoProgresso 
        {...defaultProps} 
        tamanho="large"
      />
    );
    
    const element = container.firstChild as HTMLElement;
    expect(element.className).toContain('large');
  });

  it('calcula percentual corretamente', () => {
    render(
      <CirculoProgresso 
        valorAtual={25}
        valorMaximo={50}
        rotulo="Teste"
      />
    );
    
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '25');
    expect(progressbar).toHaveAttribute('aria-valuemax', '50');
  });

  it('protege contra divisão por zero', () => {
    render(
      <CirculoProgresso 
        valorAtual={10}
        valorMaximo={0}
        rotulo="Teste"
      />
    );
    
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '10');
    expect(progressbar).toHaveAttribute('aria-valuemax', '0');
  });
});
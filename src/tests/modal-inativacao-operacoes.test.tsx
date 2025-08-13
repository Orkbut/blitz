import React from 'react';
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalInativacaoOperacoes } from '@/components/supervisor/ModalInativacaoOperacoes';

// Mock do getSupervisorHeaders
vi.mock('@/lib/auth-utils', () => ({
    getSupervisorHeaders: () => ({
        'Authorization': 'Bearer mock-token',
        'X-Regional-ID': '1'
    })
}));

// Mock do window.scrollTo para evitar erros no JSDOM
Object.defineProperty(window, 'scrollTo', {
    value: vi.fn(),
    writable: true
});

// Mock do fetch global
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ModalInativacaoOperacoes', () => {
    const mockProps = {
        isOpen: true,
        onClose: vi.fn(),
        janelaId: 1,
        onOperacoesAlteradas: vi.fn()
    };

    const mockOperacoes = [
        {
            id: 1,
            data_operacao: '2024-01-15',
            modalidade: 'BLITZ',
            tipo: 'PLANEJADA',
            turno: 'MANHA',
            limite_participantes: 15,
            ativa: true,
            inativa_pelo_supervisor: false,
            participantes_confirmados: 5,
            status: 'ATIVA',
            criado_em: '2024-01-10T10:00:00Z'
        },
        {
            id: 2,
            data_operacao: '2024-01-16',
            modalidade: 'BALANCA',
            tipo: 'VOLUNTARIA',
            turno: 'TARDE',
            limite_participantes: 10,
            ativa: true,
            inativa_pelo_supervisor: true,
            participantes_confirmados: 3,
            status: 'ATIVA',
            criado_em: '2024-01-10T10:00:00Z'
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock mais simples e direto
        mockFetch.mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                    success: true,
                    data: mockOperacoes
                })
            })
        );
    });

    afterEach(() => {
        // Limpar estilos do body após cada teste
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
    });

    it('deve renderizar o modal quando isOpen é true', () => {
        render(<ModalInativacaoOperacoes {...mockProps} />);
        expect(screen.getByText('📁 Inativar Operações')).toBeInTheDocument();
    });

    it('não deve renderizar quando isOpen é false', () => {
        render(<ModalInativacaoOperacoes {...mockProps} isOpen={false} />);
        expect(screen.queryByText('📁 Inativar Operações')).not.toBeInTheDocument();
    });

    it('deve chamar onClose quando clicar no botão fechar', () => {
        render(<ModalInativacaoOperacoes {...mockProps} />);
        const closeButton = screen.getByLabelText('Fechar modal');
        fireEvent.click(closeButton);
        expect(mockProps.onClose).toHaveBeenCalled();
    });

    it('deve mostrar loading inicialmente', () => {
        render(<ModalInativacaoOperacoes {...mockProps} />);
        expect(screen.getByText('Carregando operações...')).toBeInTheDocument();
    });

    it('deve fazer chamada para API ao abrir', () => {
        render(<ModalInativacaoOperacoes {...mockProps} />);

        expect(mockFetch).toHaveBeenCalledWith(
            '/api/unified/operacoes?portal=supervisor&janela_id=1&includeInactive=true',
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer mock-token',
                    'X-Regional-ID': '1'
                })
            })
        );
    });

    it('deve ter estrutura básica do modal', () => {
        render(<ModalInativacaoOperacoes {...mockProps} />);

        // Verifica se o modal tem os elementos básicos
        expect(screen.getByText('📁 Inativar Operações')).toBeInTheDocument();
        expect(screen.getByLabelText('Fechar modal')).toBeInTheDocument();
        expect(screen.getByText('Carregando operações...')).toBeInTheDocument();
    });
});
// Script para preparar dados de teste para validação de exclusão de janela
// Execute no console do navegador (F12) quando estiver logado como supervisor

async function prepararDadosTeste() {
    console.log('🔧 Preparando dados de teste...');

    // 1. Buscar uma janela operacional existente
    const responseJanelas = await fetch('/api/supervisor/janelas-operacionais', {
        headers: {
            'X-Supervisor-Id': '42', // Ajuste conforme seu ID
            'X-Regional-Id': '1'     // Ajuste conforme sua regional
        }
    });

    const janelas = await responseJanelas.json();
    console.log('📋 Janelas encontradas:', janelas);

    if (!janelas.data || janelas.data.length === 0) {
        console.log('❌ Nenhuma janela encontrada. Crie uma janela primeiro.');
        return;
    }

    const janela = janelas.data[0];
    console.log('🎯 Usando janela:', janela);

    // 2. Buscar operações dessa janela
    const responseOperacoes = await fetch(`/api/unified/operacoes?janela_id=${janela.id}`);
    const operacoes = await responseOperacoes.json();
    console.log('⚡ Operações encontradas:', operacoes);

    if (!operacoes.data || operacoes.data.length === 0) {
        console.log('❌ Nenhuma operação encontrada. Crie uma operação primeiro.');
        return;
    }

    const operacao = operacoes.data[0];
    console.log('🎯 Usando operação:', operacao);

    // 3. Inativar a operação diretamente via API
    const responseInativar = await fetch('/api/supervisor/operacoes/inativar-multiplas', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Supervisor-Id': '42', // Ajuste conforme seu ID
            'X-Regional-Id': '1'     // Ajuste conforme sua regional
        },
        body: JSON.stringify({
            operacaoIds: [operacao.id],
            inativar: true,
            motivo: 'Teste de validação de exclusão'
        })
    });

    const resultadoInativar = await responseInativar.json();
    console.log('✅ Resultado inativação:', resultadoInativar);

    if (resultadoInativar.success) {
        console.log(`✅ Dados preparados! Agora tente excluir a janela ID: ${janela.id}`);
        console.log(`📝 A operação ID: ${operacao.id} foi inativada e deve bloquear a exclusão.`);

        return {
            janelaId: janela.id,
            operacaoId: operacao.id,
            proximoPasso: `Agora vá na interface e tente excluir a janela "${janela.dataInicio} - ${janela.dataFim}"`
        };
    } else {
        console.log('❌ Erro ao inativar operação:', resultadoInativar);
    }
}

// Executar automaticamente
prepararDadosTeste();
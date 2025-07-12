// TESTE SIMPLES DO LOGGER TEMPORÁRIO
const TempLogger = require('./src/lib/temp-logger');

console.log('TESTE LOGGER: Iniciando teste...');
console.log('process.cwd():', process.cwd());

TempLogger.log('TESTE', 'Primeira mensagem de teste');
TempLogger.log('TESTE', 'Segunda mensagem com dados', { usuario: 'teste', operacao: 123 });

console.log('TESTE LOGGER: Teste concluído. Verifique o arquivo ts-morph/debug-logs.txt'); 
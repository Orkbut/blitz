import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * HEALTH CHECK ENDPOINT - REALTIME
 * 
 * Verifica se o Supabase Realtime está funcionando corretamente
 * Útil para monitoramento em produção (Vercel)
 */

export async function GET() {
  const startTime = Date.now();
  
  try {
    console.log('🏥 [HEALTH-CHECK] Iniciando verificação do realtime...');
    
    // ✅ TESTE 1: Verificar conectividade básica
    const { data, error } = await supabase
      .from('operacao')
      .select('id')
      .limit(1);
    
    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }
    
    // ✅ TESTE 2: Tentar criar canal realtime
    let channelStatus = 'unknown';
    let channelError = null;
    
    try {
      const channel = supabase.channel('health-check-channel');
      
      // Simular subscription
      const subscriptionPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Channel subscription timeout'));
        }, 5000);
        
        channel.subscribe((status) => {
          clearTimeout(timeout);
          resolve(status);
        });
      });
      
      channelStatus = await subscriptionPromise as string;
      
      // Limpar canal após teste
      await supabase.removeChannel(channel);
      
    } catch (error: any) {
      channelError = error.message;
      channelStatus = 'failed';
    }
    
    const responseTime = Date.now() - startTime;
    
    // ✅ RESULTADO DO HEALTH CHECK
    const healthData = {
      status: channelStatus === 'SUBSCRIBED' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      checks: {
        database: data !== null ? 'ok' : 'failed',
        realtime: {
          status: channelStatus,
          error: channelError
        }
      },
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').substring(0, 20) + '...',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        region: process.env.VERCEL_REGION || 'local'
      }
    };
    
    console.log('🏥 [HEALTH-CHECK] Resultado:', healthData);
    
    const httpStatus = healthData.status === 'healthy' ? 200 : 503;
    
    return NextResponse.json(healthData, { status: httpStatus });
    
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    console.error('🏥 [HEALTH-CHECK] Erro:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: error.message,
      environment: {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/https?:\/\//, '').substring(0, 20) + '...',
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        region: process.env.VERCEL_REGION || 'local'
      }
    }, { status: 500 });
  }
} 
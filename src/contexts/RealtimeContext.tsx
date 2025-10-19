/**
 * 🚀 REALTIME CONTEXT - WRAPPER DE COMPATIBILIDADE
 * 
 * Mantém a API pública para compatibilidade com componentes existentes,
 * mas agora delega toda responsabilidade para o RealtimeManager singleton.
 * 
 * MIGRAÇÃO GRADUAL:
 * - Componentes podem continuar usando useRealtimeContext()
 * - Novos componentes devem usar useRealtime() diretamente
 * - Este context será removido em versões futuras
 */

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { realtimeManager, ChannelSubscription } from "@/core/infrastructure/services/RealtimeManager";

type RealtimeContextValue = {
  isConnected: boolean;
  subscribe: (subscription: ChannelSubscription) => boolean;
  unsubscribe: (channelId: string) => void;
  getStats: () => Record<string, any>;
  getActiveChannels: () => string[];
};

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  subscribe: () => false,
  unsubscribe: () => {},
  getStats: () => ({}),
  getActiveChannels: () => [],
});

export const useRealtimeContext = () => useContext(RealtimeContext);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    console.log('[RealtimeProvider] 🚀 Inicializando provider com RealtimeManager');
    
    // Listener global para status de conexão
    const handleConnectionStatus = (event: CustomEvent) => {
      const { status } = event.detail;
      setIsConnected(status === 'connected');
    };
    
    // Adicionar listener
    realtimeManager.addEventListener('connection_status_change', handleConnectionStatus as EventListener);
    
    // Cleanup
    return () => {
      realtimeManager.removeEventListener('connection_status_change', handleConnectionStatus as EventListener);
    };
  }, []);
  
  const contextValue: RealtimeContextValue = {
    isConnected,
    subscribe: (subscription: ChannelSubscription) => {
      console.log('[RealtimeProvider] 📡 Subscribe delegado para RealtimeManager:', subscription.channelId);
      return realtimeManager.subscribe(subscription);
    },
    unsubscribe: (channelId: string) => {
      console.log('[RealtimeProvider] 🔌 Unsubscribe delegado para RealtimeManager:', channelId);
      realtimeManager.unsubscribe(channelId);
    },
    getStats: () => {
      return realtimeManager.getChannelStats();
    },
    getActiveChannels: () => {
      return realtimeManager.getActiveChannels();
    }
  };
  
  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
};

export default RealtimeProvider;
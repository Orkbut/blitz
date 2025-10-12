"use client";

import React, { createContext, useContext } from "react";

type RealtimeContextValue = {
  isConnected: boolean;
  subscribe: (...args: any[]) => void;
  unsubscribe: (...args: any[]) => void;
};

const RealtimeContext = createContext<RealtimeContextValue>({
  isConnected: false,
  subscribe: () => {},
  unsubscribe: () => {},
});

export const useRealtimeContext = () => useContext(RealtimeContext);

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RealtimeContext.Provider value={{ isConnected: false, subscribe: () => {}, unsubscribe: () => {} }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export default RealtimeProvider;
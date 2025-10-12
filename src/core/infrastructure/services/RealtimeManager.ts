export type DatabaseChangeEvent = {
  channelId: string;
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  payload: any;
  timestamp: number;
};

export const realtimeManager = {
  subscribe: () => ({ unsubscribe: () => {} }),
  unsubscribe: () => {},
  getStats: () => ({ channels: 0, eventsPerSecond: 0 }),
};
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  time: string;
  read: boolean;
}

export interface NotificationContextValue {
  notifications: AppNotification[];
  pushNotificationLocal: (
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ) => Promise<void>;
  markRead: (id: string) => void;
  clearAll: () => void;
}

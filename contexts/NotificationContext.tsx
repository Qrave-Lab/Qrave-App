import React, { createContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import type { AppNotification, NotificationContextValue } from "@/types/notification";

export const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  pushNotificationLocal: async () => {},
  markRead: () => {},
  clearAll: () => {},
});

interface NotificationProviderProps {
  children: React.ReactNode;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotificationsModule = any;

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsApi, setNotificationsApi] = useState<NotificationsModule | null>(null);

  useEffect(() => {
    // Load saved notifications from AsyncStorage on mount
    (async () => {
      try {
        const saved = await AsyncStorage.getItem("notifications");
        if (saved) setNotifications(JSON.parse(saved));
      } catch (e) {
        console.warn("Failed to load notifications", e);
      }
    })();

    if (Constants.appOwnership !== "expo") {
      try {
        const Notifications = require("expo-notifications");
        setNotificationsApi(Notifications);
      } catch {
        setNotificationsApi(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!notificationsApi) return;

    // Handle notification taps (if you want to navigate on tap later)
    const responseListener = notificationsApi.addNotificationResponseReceivedListener(() => {
      // console.log("Notification tapped:", response);
    });

    return () => {
      responseListener.remove();
    };
  }, [notificationsApi]);

  // Persist notifications whenever they change
  useEffect(() => {
    AsyncStorage.setItem("notifications", JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  const pushNotificationLocal = async (title: string, body: string, data: Record<string, unknown> = {}): Promise<void> => {
    const newNotif: AppNotification = {
      id: Date.now().toString(),
      title,
      body,
      data,
      time: new Date().toISOString(),
      read: false,
    };
    // add to in-app list
    setNotifications(prev => [newNotif, ...prev]);

    // show device local notification
    try {
      if (notificationsApi) {
        await notificationsApi.scheduleNotificationAsync({
        content: { title, body, data, sound: "default" },
        trigger: null, // fire immediately
      });
      }
    } catch (e) {
      console.warn("Failed to show local notification", e);
    }
  };

  const markRead = (id: string): void => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearAll = (): void => setNotifications([]);

  return (
    <NotificationContext.Provider value={{ notifications, pushNotificationLocal, markRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
};

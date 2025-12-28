import React, { createContext, useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

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

    // Handle notification taps (if you want to navigate on tap later)
    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      // console.log("Notification tapped:", response);
    });

    return () => {
      responseListener.remove();
    };
  }, []);

  // Persist notifications whenever they change
  useEffect(() => {
    AsyncStorage.setItem("notifications", JSON.stringify(notifications)).catch(() => {});
  }, [notifications]);

  const pushNotificationLocal = async (title, body, data = {}) => {
    const newNotif = {
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
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data, sound: "default" },
        trigger: null, // fire immediately
      });
    } catch (e) {
      console.warn("Failed to show local notification", e);
    }
  };

  const markRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const clearAll = () => setNotifications([]);

  return (
    <NotificationContext.Provider value={{ notifications, pushNotificationLocal, markRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
};

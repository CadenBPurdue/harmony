// src/renderer/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

// Create context
const NotificationContext = createContext(null);

// Notification provider component
export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Update unread count whenever notifications change
  useEffect(() => {
    const count = notifications.filter(notification => !notification.read).length;
    setUnreadCount(count);
  }, [notifications]);

  // Add a new notification with optional details
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(), // Use timestamp as unique ID
      timestamp: new Date(),
      read: false,
      details: notification.details || null, // Store additional details if provided
      ...notification
    };
    
    setNotifications(prevNotifications => [newNotification, ...prevNotifications]);
    
    // Optional: You could also send this to your backend/Firebase here
    if (window.electronAPI && window.electronAPI.saveNotification) {
      window.electronAPI.saveNotification(newNotification);
    }
  };

  // Mark a notification as read
  const markAsRead = (notificationId) => {
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      )
    );
  };

  // Mark all notifications as read
  const markAllAsRead = () => {
    setNotifications(prevNotifications => 
      prevNotifications.map(notification => ({ ...notification, read: true }))
    );
  };

  // Format notification time relative to now
  const formatNotificationTime = (timestamp) => {
    const now = new Date();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    }
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    return timestamp.toLocaleDateString();
  };

  // Context value
  const value = {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    formatNotificationTime
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

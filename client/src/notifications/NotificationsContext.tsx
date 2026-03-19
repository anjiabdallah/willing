import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, X } from 'lucide-react';
import { createContext, useCallback, useRef, useState, type ReactNode } from 'react';

// Tailwind safelists
// alert-success
// alert-info
// alert-warning
// alert-error

type NotificationType = 'success' | 'info' | 'warning' | 'error';

type NotificationInput = {
  message: string;
  type: NotificationType;
};

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  entering: boolean;
  exiting: boolean;
}

const NOTIFICATION_TIMEOUT = 6000;
const EXIT_ANIMATION_DURATION = 220;

type NotificationsContextType = {
  notifications: Notification[];
  push: (notification: NotificationInput) => void;
};

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  push: () => {},
});

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const nextNotificationId = useRef(1);
  const dismissingNotificationIds = useRef(new Set<number>());

  const removeNotification = useCallback((id: number) => {
    dismissingNotificationIds.current.delete(id);
    setNotifications(previousNotifications => previousNotifications.filter(notification => notification.id !== id));
  }, []);

  const dismiss = useCallback((id: number) => {
    if (dismissingNotificationIds.current.has(id)) {
      return;
    }

    dismissingNotificationIds.current.add(id);

    setNotifications(previousNotifications => previousNotifications.map((notification) => {
      if (notification.id !== id || notification.exiting) {
        return notification;
      }

      return { ...notification, exiting: true };
    }));

    setTimeout(() => removeNotification(id), EXIT_ANIMATION_DURATION);
  }, [removeNotification]);

  const push = useCallback((notification: NotificationInput) => {
    const id = nextNotificationId.current;
    nextNotificationId.current += 1;

    setNotifications(previousNotifications => [...previousNotifications, {
      ...notification,
      id,
      entering: true,
      exiting: false,
    }]);

    requestAnimationFrame(() => {
      setNotifications(previousNotifications => previousNotifications.map((existingNotification) => {
        if (existingNotification.id !== id || existingNotification.exiting) {
          return existingNotification;
        }

        return { ...existingNotification, entering: false };
      }));
    });

    setTimeout(() => dismiss(id), NOTIFICATION_TIMEOUT);
  }, [dismiss]);

  return (
    <NotificationsContext.Provider value={{ notifications, push }}>
      <div className="max-w-[90%] w-120 toast toast-bottom toast-center z-9999 pointer-events-none">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className="grid transition-all duration-200 ease-out"
            style={{
              gridTemplateRows: notification.exiting ? '0fr' : '1fr',
              marginBottom: '0rem',
            }}
          >
            <div className="overflow-hidden">
              <div
                role="alert"
                className={`flex alert pointer-events-auto w-full shadow-md transition-all duration-200 ease-out ${notification.exiting || notification.entering ? 'translate-y-1 scale-[0.98] opacity-0' : 'translate-y-0 scale-100 opacity-100'} alert-${notification.type}`}
              >
                {
                  notification.type === 'success' && <CircleCheckIcon size={20} />
                }
                {
                  notification.type === 'info' && <InfoIcon size={20} />
                }
                {
                  notification.type === 'warning' && <TriangleAlertIcon size={20} />
                }
                {
                  notification.type === 'error' && <CircleAlertIcon size={20} />
                }
                <span className="flex-1">{notification.message}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-square btn-sm"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(notification.id)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {children}
    </NotificationsContext.Provider>
  );
};

export default NotificationsContext;

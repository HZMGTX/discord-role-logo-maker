import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastState {
  message: string;
  visible: boolean;
}

export function useToast(): { toast: ToastState; notify: (message: string) => void } {
  const [toast, setToast] = useState<ToastState>({ message: '', visible: false });
  const timer = useRef<number | null>(null);

  const notify = useCallback((message: string) => {
    setToast({ message, visible: true });
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setToast((current) => ({ ...current, visible: false }));
    }, 2400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  return { toast, notify };
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div className={`toast${toast.visible ? ' toast--visible' : ''}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}

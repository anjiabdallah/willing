import { useCallback, useRef, useState } from 'react';

import { ModalContext } from './modal.context';
import Button from '../components/Button.tsx';
import Modal from '../components/Modal.tsx';

import type { PromptModalOptions } from './modal.types';
import type { ReactNode } from 'react';

export function ModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<PromptModalOptions<string> | null>(null);
  const resolveRef = useRef<((value: string | undefined) => void) | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    if (resolveRef.current) {
      resolveRef.current(undefined);
      resolveRef.current = null;
    }
    setOptions(null);
  }, []);

  const handleAction = useCallback((value: string) => {
    setOpen(false);
    if (resolveRef.current) {
      resolveRef.current(value);
      resolveRef.current = null;
    }
    setOptions(null);
  }, []);

  const promptModal = useCallback(<T extends string = string>(modalOptions: PromptModalOptions<T>) => {
    return new Promise<T | undefined>((resolve) => {
      resolveRef.current = resolve as (value: string | undefined) => void;
      setOptions(modalOptions as PromptModalOptions<string>);
      setOpen(true);
    });
  }, []);

  return (
    <ModalContext.Provider value={{ promptModal }}>
      {children}
      <Modal
        open={open}
        title={options?.title ?? ''}
        description={options?.content}
        onClose={options?.cancelable ? close : undefined}
        disableBackdropClose={!options?.cancelable}
        actions={options?.actions.map(action => (
          <Button
            key={action.value}
            type="button"
            color={action.color}
            onClick={() => handleAction(action.value)}
          >
            {action.label}
          </Button>
        ))}
      />
    </ModalContext.Provider>
  );
}

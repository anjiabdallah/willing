import type { ReactNode } from 'react';

export type ModalButtonColor
  = | 'primary'
    | 'secondary'
    | 'accent'
    | 'neutral'
    | 'success'
    | 'error'
    | 'warning'
    | 'info'
    | 'ghost';

export type ModalAction<T extends string = string> = {
  value: T;
  label: string;
  color?: ModalButtonColor;
};

export type PromptModalOptions<T extends string = string> = {
  title: string;
  content?: ReactNode;
  actions: ModalAction<T>[];
  cancelable?: boolean;
};

export type ModalContextType = {
  promptModal: <T extends string = string>(options: PromptModalOptions<T>) => Promise<T | undefined>;
};

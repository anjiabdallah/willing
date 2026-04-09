import { X } from 'lucide-react';

import IconButton from './IconButton';

import type { ReactNode } from 'react';

type ModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  onClose?: () => void;
  showCloseButton?: boolean;
  disableBackdropClose?: boolean;
};

function Modal({
  open,
  title,
  description,
  children,
  actions,
  onClose,
  showCloseButton = true,
  disableBackdropClose = false,
}: ModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box border border-base-300 overflow-visible">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-bold text-lg">{title}</h3>
            {description && (
              <p className="text-sm text-base-content/70 mt-2">{description}</p>
            )}
          </div>
          {showCloseButton && (
            <IconButton
              type="button"
              onClick={onClose}
              disabled={disableBackdropClose}
              Icon={X}
            />
          )}
        </div>

        {children}

        {actions && (
          <div className="modal-action">
            {actions}
          </div>
        )}
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close modal"
        onClick={!disableBackdropClose ? onClose : undefined}
      />
    </div>
  );
}

export default Modal;

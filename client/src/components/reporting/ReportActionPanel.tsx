import { AlertCircle, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import Alert from '../Alert';

type ReportActionPanelProps = {
  actionError: string | null;
  isActionInProgress: boolean;
  onAccept: () => void;
  onReject: () => void;
  acceptLabel?: string;
  rejectLabel?: string;
  warningMessage?: string;
  confirmDisableMessage?: string;
  confirmTitle?: string;
  confirmButtonLabel?: string;
};

function ReportActionPanel({
  actionError,
  isActionInProgress,
  onAccept,
  onReject,
  acceptLabel = 'Disable Account',
  rejectLabel = 'Delete Report',
  warningMessage = 'Disabling an account also resolves the report.',
  confirmDisableMessage = 'Are you sure? This will disable the reported account and resolve this report.',
  confirmTitle = 'Confirm Disable Account',
  confirmButtonLabel = 'Yes, disable account',
}: ReportActionPanelProps) {
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  useEffect(() => {
    if (isActionInProgress) {
      setIsConfirmModalOpen(false);
    }
  }, [isActionInProgress]);

  const handleAcceptClick = () => {
    if (isActionInProgress) return;
    setIsConfirmModalOpen(true);
  };

  const handleConfirmDisable = () => {
    if (isActionInProgress) return;
    setIsConfirmModalOpen(false);
    onAccept();
  };

  const handleRejectClick = () => {
    if (isActionInProgress) return;
    setIsConfirmModalOpen(false);
    onReject();
  };

  return (
    <div className="space-y-3">
      {actionError && (
        <Alert color="error">
          <p>{actionError}</p>
        </Alert>
      )}

      <button
        type="button"
        className="btn btn-success btn-block gap-2"
        onClick={handleAcceptClick}
        disabled={isActionInProgress}
      >
        {isActionInProgress
          ? (
              <>
                <div className="loading loading-spinner loading-sm" />
              </>
            )
          : (
              <>
                <Check size={18} />
                {acceptLabel}
              </>
            )}
      </button>

      <button
        type="button"
        className="btn btn-outline btn-block gap-2"
        onClick={handleRejectClick}
        disabled={isActionInProgress}
      >
        <X size={18} />
        {rejectLabel}
      </button>

      <div className="alert alert-warning gap-2">
        <AlertCircle size={18} />
        <span className="text-xs">{warningMessage}</span>
      </div>

      <div className={`modal ${isConfirmModalOpen ? 'modal-open' : ''}`}>
        <div className="modal-box border border-base-300">
          <h3 className="font-bold text-lg">{confirmTitle}</h3>
          <p className="py-3 text-sm">{confirmDisableMessage}</p>
          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isActionInProgress}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-error"
              onClick={handleConfirmDisable}
              disabled={isActionInProgress}
            >
              {confirmButtonLabel}
            </button>
          </div>
        </div>
        <button
          type="button"
          className="modal-backdrop"
          aria-label="Close modal"
          onClick={() => setIsConfirmModalOpen(false)}
        />
      </div>
    </div>
  );
}

export default ReportActionPanel;

import { AlertCircle, Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';

import Alert from '../Alert';
import Button from '../Button';
import Modal from '../Modal';

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

      <Button
        type="button"
        color="success"
        layout="block"
        Icon={Check}
        onClick={handleAcceptClick}
        disabled={isActionInProgress}
        loading={isActionInProgress}
      >
        {acceptLabel}
      </Button>

      <Button
        type="button"
        style="outline"
        layout="block"
        Icon={X}
        onClick={handleRejectClick}
        disabled={isActionInProgress}
      >
        {rejectLabel}
      </Button>

      <Alert color="warning" icon={AlertCircle}>
        <p className="text-xs">{warningMessage}</p>
      </Alert>

      <Modal
        open={isConfirmModalOpen}
        title={confirmTitle}
        description={confirmDisableMessage}
        onClose={() => setIsConfirmModalOpen(false)}
        disableBackdropClose={isActionInProgress}
        showCloseButton={!isActionInProgress}
        actions={(
          <>
            <Button
              type="button"
              color="ghost"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isActionInProgress}
            >
              Cancel
            </Button>
            <Button
              type="button"
              color="error"
              onClick={handleConfirmDisable}
              disabled={isActionInProgress}
            >
              {confirmButtonLabel}
            </Button>
          </>
        )}
      />
    </div>
  );
}

export default ReportActionPanel;

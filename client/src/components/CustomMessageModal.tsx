import { zodResolver } from '@hookform/resolvers/zod';
import { Send, X } from 'lucide-react';
import React, { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import zod from 'zod';

import Button from './Button';
import Modal from './Modal.tsx';

const applyMessageSchema = zod.object({
  message: zod.string().max(350, 'Message must be 350 characters or fewer').optional(),
});

type CustomMessageFormData = zod.infer<typeof applyMessageSchema>;

type CustomMessageModalProps = {
  open: boolean;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (message?: string) => Promise<void> | void;
  placeholder: string;
  title?: string;
  submitLabel?: string;
  children?: React.ReactNode;
};

function CustomMessageModal({
  open,
  submitting = false,
  onClose,
  onSubmit,
  placeholder,
  title = 'Add a message',
  submitLabel = 'Submit Application',
  children,
}: CustomMessageModalProps) {
  const form = useForm<CustomMessageFormData>({
    resolver: zodResolver(applyMessageSchema),
    defaultValues: { message: '' },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ message: '' });
    }
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (data) => {
    const trimmedMessage = data.message?.trim();
    await onSubmit(trimmedMessage ? trimmedMessage : undefined);
  });

  const message = useWatch({ control: form.control, name: 'message', defaultValue: '' }) ?? '';
  const remainingCharacters = 350 - message.length;

  return (
    <Modal
      open={open}
      title={title}
      onClose={submitting ? undefined : onClose}
      disableBackdropClose={submitting}
      showCloseButton={!submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          className="textarea textarea-bordered w-full"
          placeholder={placeholder}
          maxLength={350}
          rows={4}
          {...form.register('message')}
        />

        <div className="flex items-center justify-between text-xs">
          <span className="opacity-60">
            {remainingCharacters}
            {' '}
            characters left
          </span>
          {form.formState.errors.message && (
            <span className="text-error">{form.formState.errors.message.message}</span>
          )}
        </div>

        {children && (
          <div className="mt-4 pt-4 border-t border-base-200">
            {children}
          </div>
        )}

        <div className="modal-action">
          <Button
            type="button"
            color="ghost"
            onClick={onClose}
            disabled={submitting}
            Icon={X}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            color="primary"
            loading={submitting}
            Icon={Send}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default CustomMessageModal;

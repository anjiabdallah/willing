import { zodResolver } from '@hookform/resolvers/zod';
import { Send, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import zod from 'zod';

import Button from './Button';
import IconButton from './IconButton';

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
};

function CustomMessageModal({
  open,
  submitting = false,
  onClose,
  onSubmit,
  placeholder,
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
    <div className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg">Add a message</h3>
          <IconButton
            onClick={onClose}
            loading={submitting}
            Icon={X}
          />

        </div>

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
              color="primary"
              onClick={onClose}
              loading={submitting}
              Icon={Send}
            >
              Submit Application
            </Button>
          </div>
        </form>
      </div>
      <div className="modal-backdrop" onClick={submitting ? undefined : onClose}>
        Close
      </div>
    </div>
  );
}

export default CustomMessageModal;

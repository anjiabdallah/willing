import { Flag, X } from 'lucide-react';
import { useWatch, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

import { FormField, FormRootError } from '../../utils/formUtils';
import Button from '../Button';
import IconButton from '../IconButton';
import { REPORT_TYPE_OPTIONS } from './reportType.constants';

type ReportFormProps<TForm extends FieldValues & { title: string; message: string }> = {
  open: boolean;
  heading: string;
  form: UseFormReturn<TForm>;
  onClose: () => void;
  onSubmit: (event?: React.BaseSyntheticEvent) => void | Promise<void>;
  messagePlaceholder: string;
  submitLabel: string;
  submitting?: boolean;
  submitDisabled?: boolean;
  maxMessageLength?: number;
};

function ReportForm<TForm extends FieldValues & { title: string; message: string }>({
  open,
  heading,
  form,
  onClose,
  onSubmit,
  messagePlaceholder,
  submitLabel,
  submitting = false,
  submitDisabled = false,
  maxMessageLength = 1000,
}: ReportFormProps<TForm>) {
  const reportMessage = useWatch({
    control: form.control,
    name: 'message' as Path<TForm>,
  });
  const messageLength = typeof reportMessage === 'string' ? reportMessage.length : 0;

  return (
    <div className={`modal ${open ? 'modal-open' : ''}`}>
      <div className="modal-box border border-base-300">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-lg">{heading}</h3>
          <IconButton
            type="button"
            Icon={X}
            onClick={onClose}
            loading={submitting}
            aria-label="Close report modal"
            title="Close"
          />
        </div>

        <form onSubmit={onSubmit} className="space-y-2">
          <FormField
            form={form}
            name={'title' as Path<TForm>}
            label="Report Type"
            selectOptions={REPORT_TYPE_OPTIONS}
          />

          <FormField
            form={form}
            name={'message' as Path<TForm>}
            label="Message"
            type="textarea"
            placeholder={messagePlaceholder}
          />

          <p className="text-xs opacity-70 text-right px-1">
            {`${messageLength}/${maxMessageLength}`}
          </p>

          <FormRootError form={form} />

          <div className="modal-action">
            <Button
              type="button"
              color="ghost"
              Icon={X}
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="error"
              Icon={Flag}
              loading={submitting}
              disabled={submitDisabled}
            >
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close modal"
        onClick={onClose}
      />
    </div>
  );
}

export default ReportForm;

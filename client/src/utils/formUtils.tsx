import { AlertCircle, type LucideIcon } from 'lucide-react';

import Alert from '../components/Alert';
import CalendarInfo from '../components/CalendarInfo';

import type { HTMLInputTypeAttribute, InputHTMLAttributes } from 'react';
import type { FieldValues, Path, RegisterOptions, UseFormReturn } from 'react-hook-form';

// eslint-disable-next-line react-refresh/only-export-components
export async function executeAndShowError<T extends FieldValues>(
  form: UseFormReturn<T>,
  action: () => Promise<void>,
) {
  form.clearErrors('root');

  try {
    await action();
  } catch (error: unknown) {
    const serverMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';

    form.setError('root', {
      type: 'server',
      message: serverMessage,
    });
  }
}

interface FormSelectOption {
  label: string;
  value: string | number;
}

interface FormFieldProps<T extends FieldValues> {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  placeholder?: string;
  type?: HTMLInputTypeAttribute | 'textarea';
  Icon?: LucideIcon;
  selectOptions?: FormSelectOption[];
  registerOptions?: RegisterOptions<T, Path<T>>;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}

export function FormField<T extends FieldValues>({
  form,
  name,
  label,
  placeholder,
  type = 'text',
  Icon,
  selectOptions,
  registerOptions,
  inputProps,
}: FormFieldProps<T>) {
  const { register, formState: { errors }, clearErrors } = form;
  const error = errors[name];
  const id = `field-${String(name)}`;

  const commonProps = {
    id,
    ...register(name, {
      onChange: () => clearErrors('root'),
      ...registerOptions,
    }),
    placeholder: placeholder || label,
  };

  const statusClass = error ? (type === 'textarea' ? 'textarea-error' : (selectOptions ? 'select-error' : 'input-error')) : '';
  const iconPadding = Icon ? 'pl-10' : '';
  const iconClass = type === 'textarea'
    ? 'absolute left-3 top-3 opacity-50 z-10'
    : 'absolute left-3 top-1/2 -translate-y-1/2 opacity-50 z-10';

  const handleDateTimeInput = (e: React.FormEvent<HTMLInputElement>) => {
    if (type === 'datetime-local') {
      const input = e.currentTarget;
      const yearMatch = input.value.match(/^(\d+)-/);
      if (yearMatch && yearMatch[1].length > 4) {
        input.value = input.value.slice(0, 4) + input.value.slice(yearMatch[1].length);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (type === 'number') {
      e.currentTarget.blur();
    }
    inputProps?.onWheel?.(e);
  };

  return (
    <fieldset className="fieldset w-full">
      {
        type !== 'date'
        && (
          <label className="label" htmlFor={id}>
            <span className="label-text font-medium">{label}</span>
          </label>
        )
      }
      <div className="relative">
        {Icon && type !== 'date' && (
          <Icon
            className={iconClass}
            size={18}
          />
        )}

        {
          selectOptions
            ? (
                <select
                  className={`select select-bordered w-full focus:select-primary ${iconPadding} ${statusClass}`}
                  {...commonProps}
                >
                  {placeholder && <option value="" disabled>{placeholder}</option>}
                  {selectOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )
            : type === 'textarea'
              ? (
                  <textarea
                    className={`textarea textarea-bordered w-full focus:textarea-primary ${iconPadding} ${statusClass}`}
                    rows={6}
                    {...commonProps}
                  />
                )
              : type === 'date'
                ? (
                    <CalendarInfo
                      selectionMode="single"
                      singleLabel={label}
                      showTopLabels={false}
                      singleValue={String(form.watch(name) ?? '')}
                      onSingleChange={(value) => {
                        form.setValue(name, value as never, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                        clearErrors('root');
                      }}
                      {...(placeholder ? { singlePlaceholder: placeholder } : {})}
                    />
                  )
                : (
                    <input
                      type={type}
                      className={`input input-bordered w-full focus:input-primary ${iconPadding} ${statusClass}`}
                      onInput={handleDateTimeInput}
                      onWheel={handleWheel}
                      {...inputProps}
                      {...commonProps}
                    />
                  )
        }
      </div>
      {error?.message && (
        <p className="text-error text-sm mt-1">{error.message as string}</p>
      )}
    </fieldset>
  );
}

interface FormRootErrorProps<T extends FieldValues> {
  form: UseFormReturn<T>;
}

export function FormRootError<T extends FieldValues>({
  form,
}: FormRootErrorProps<T>) {
  const error = form.formState.errors.root;

  if (!error) return null;

  return (
    <Alert
      color="error"
      icon={AlertCircle}
      style="soft"
      className="mt-2 py-3 transition-all animate-in fade-in slide-in-from-top-1"
    >
      {error.message as string}
    </Alert>
  );
}

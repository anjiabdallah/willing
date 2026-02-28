import type { LucideIcon } from 'lucide-react';
import type { FieldValues, UseFormReturn, Path, PathValue } from 'react-hook-form';

interface ToggleOption<T> {
  value: T;
  label: string;
  description?: string;
  Icon?: LucideIcon;
  btnColor?: string;
}

interface ToggleButtonProps<T extends FieldValues, TName extends Path<T>> {
  form: UseFormReturn<T>;
  name: TName;
  label: string;
  options: ToggleOption<PathValue<T, TName>>[];
  disabled?: boolean;
  compact?: boolean;
}

export function ToggleButton<T extends FieldValues, TName extends Path<T>>({
  form,
  name,
  label,
  options,
  disabled = false,
  compact = false,
}: ToggleButtonProps<T, TName>) {
  const currentValue = form.watch(name);

  if (compact) {
    return (
      <fieldset className="fieldset">
        <label className="label">
          <span className="label-text font-medium">{label}</span>
        </label>
        <div className="join">
          {options.map(option => (
            <button
              key={String(option.value)}
              type="button"
              className={`btn btn-sm join-item gap-2 ${
                currentValue === option.value ? (option.btnColor || 'btn-primary') : ''
              }`}
              onClick={() =>
                form.setValue(name, option.value, {
                  shouldDirty: true,
                  shouldTouch: true,
                })}
              disabled={disabled}
            >
              {option.Icon && <option.Icon size={14} />}
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset className="fieldset">
      <label className="label">
        <span className="label-text font-medium">{label}</span>
      </label>

      <div className="join w-full">
        {options.map(option => (
          <button
            key={String(option.value)}
            type="button"
            className={`btn join-item h-auto flex-1 flex-col items-start gap-1 p-4 text-left normal-case ${
              currentValue === option.value
                ? option.btnColor || 'btn-primary'
                : 'bg-base-200 border-base-300'
            }`}
            onClick={() =>
              form.setValue(name, option.value, {
                shouldDirty: true,
                shouldTouch: true,
              })}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 font-bold">
              {option.Icon && <option.Icon size={16} />}
              <span>{option.label}</span>
            </div>
            {option.description && (
              <p
                className={`text-xs font-normal leading-tight ${
                  currentValue === option.value
                    ? 'text-primary-content/80'
                    : 'text-base-content/60'
                }`}
              >
                {option.description}
              </p>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

import { FormField } from '../utils/formUtils';

import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

interface CalendarCommonProps {
  startLabel?: string;
  endLabel?: string;
  className?: string;
  inputType?: 'date' | 'datetime-local';
}

interface CalendarFormProps<T extends FieldValues> extends CalendarCommonProps {
  form: UseFormReturn<T>;
  startName: Path<T>;
  endName: Path<T>;
}

interface CalendarControlledProps extends CalendarCommonProps {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
}

type CalendarProps<T extends FieldValues> = CalendarFormProps<T> | CalendarControlledProps;

export default function CalenderInfo<T extends FieldValues>({
  startLabel = 'Start Date',
  endLabel = 'End Date',
  className = 'grid grid-cols-2 gap-3',
  inputType = 'datetime-local',
  ...props
}: CalendarProps<T>) {
  if ('form' in props) {
    return (
      <div className={className}>
        <FormField
          form={props.form}
          label={startLabel}
          name={props.startName}
          type={inputType}
        />

        <FormField
          form={props.form}
          label={endLabel}
          name={props.endName}
          type={inputType}
        />
      </div>
    );
  }

  const handleInput = (event: FormEvent<HTMLInputElement>) => {
    if (inputType !== 'datetime-local') return;

    const input = event.currentTarget;
    const yearMatch = input.value.match(/^(\d+)-/);
    if (yearMatch && yearMatch[1].length > 4) {
      input.value = input.value.slice(0, 4) + input.value.slice(yearMatch[1].length);
    }
  };

  return (
    <>
      <input
        type={inputType}
        placeholder={props.startPlaceholder ?? startLabel}
        value={props.startValue}
        onInput={handleInput}
        onChange={event => props.onStartChange(event.target.value)}
        className="input input-bordered"
      />

      <input
        type={inputType}
        placeholder={props.endPlaceholder ?? endLabel}
        value={props.endValue}
        onInput={handleInput}
        onChange={event => props.onEndChange(event.target.value)}
        className="input input-bordered"
      />
    </>
  );
}

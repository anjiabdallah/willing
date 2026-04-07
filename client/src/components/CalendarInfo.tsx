import { CalendarDays } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DayButton, DayPicker } from 'react-day-picker';

import type { DateRange, DayButtonProps, Matcher } from 'react-day-picker';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';

import 'react-day-picker/style.css';

interface CalendarCommonProps {
  startLabel?: string;
  endLabel?: string;
  className?: string;
  inputType?: 'date' | 'datetime-local';
  disabledDates?: string[];
  allowedDates?: string[];
  dateDetails?: Record<string, string>;
  showTopLabels?: boolean;
}

type CalendarSelectionMode = 'interval' | 'range' | 'multiple' | 'single';
type PickerPlacement = 'top' | 'bottom';
const POPOVER_ANIMATION_DURATION_MS = 160;

interface CalendarDateRangeValue {
  from: string;
  to: string;
}

interface CalendarFormProps<T extends FieldValues> extends CalendarCommonProps {
  form: UseFormReturn<T>;
  startName: Path<T>;
  endName: Path<T>;
}

interface CalendarFormSingleProps<T extends FieldValues> extends CalendarCommonProps {
  form: UseFormReturn<T>;
  selectionMode: 'single';
  dateName: Path<T>;
  dateLabel?: string;
  datePlaceholder?: string;
}

interface CalendarControlledProps extends CalendarCommonProps {
  selectionMode?: 'interval';
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
}

interface CalendarControlledRangeProps extends CalendarCommonProps {
  selectionMode: 'range';
  rangeValue: CalendarDateRangeValue;
  onRangeChange: (value: CalendarDateRangeValue) => void;
  rangeLabel?: string;
  rangePlaceholder?: string;
}

interface CalendarControlledMultipleProps extends CalendarCommonProps {
  selectionMode: 'multiple';
  selectedDates: string[];
  onSelectedDatesChange: (values: string[]) => void;
  multipleLabel?: string;
  multiplePlaceholder?: string;
}

interface CalendarControlledSingleProps extends CalendarCommonProps {
  selectionMode: 'single';
  singleValue: string;
  onSingleChange: (value: string) => void;
  singleLabel?: string;
  singlePlaceholder?: string;
}

type CalendarProps<T extends FieldValues> = CalendarFormProps<T>
  | CalendarFormSingleProps<T>
  | CalendarControlledProps
  | CalendarControlledRangeProps
  | CalendarControlledMultipleProps
  | CalendarControlledSingleProps;

export default function CalendarInfo<T extends FieldValues>({
  startLabel = 'Start Date',
  endLabel = 'End Date',
  className,
  ...props
}: CalendarProps<T>) {
  if ('form' in props) {
    if ('dateName' in props) {
      const singleFormValue = String(props.form.watch(props.dateName) ?? '');

      return (
        <ControlledCalendarInfo
          className={className}
          startLabel={startLabel}
          endLabel={endLabel}
          selectionMode="single"
          singleValue={singleFormValue}
          onSingleChange={(value) => {
            props.form.setValue(props.dateName, value as never, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            });
          }}
          {...(props.dateLabel ? { singleLabel: props.dateLabel } : {})}
          {...(props.datePlaceholder ? { singlePlaceholder: props.datePlaceholder } : {})}
          {...(props.disabledDates ? { disabledDates: props.disabledDates } : {})}
          {...(props.allowedDates ? { allowedDates: props.allowedDates } : {})}
          {...(props.dateDetails ? { dateDetails: props.dateDetails } : {})}
        />
      );
    }

    const formClassName = className ?? 'grid grid-cols-2 gap-3';
    const formStartValue = String(props.form.watch(props.startName) ?? '');
    const formEndValue = String(props.form.watch(props.endName) ?? '');

    return (
      <ControlledCalendarInfo
        className={formClassName}
        startLabel={startLabel}
        endLabel={endLabel}
        startValue={formStartValue}
        endValue={formEndValue}
        onStartChange={(value) => {
          props.form.setValue(props.startName, value as never, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
        onEndChange={(value) => {
          props.form.setValue(props.endName, value as never, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
          });
        }}
        {...(props.disabledDates ? { disabledDates: props.disabledDates } : {})}
        {...(props.allowedDates ? { allowedDates: props.allowedDates } : {})}
        {...(props.dateDetails ? { dateDetails: props.dateDetails } : {})}
      />
    );
  }

  const controlledModeProps = (() => {
    if (props.selectionMode === 'range') {
      return {
        selectionMode: 'range' as const,
        rangeValue: props.rangeValue,
        onRangeChange: props.onRangeChange,
        ...(props.rangeLabel ? { rangeLabel: props.rangeLabel } : {}),
        ...(props.rangePlaceholder ? { rangePlaceholder: props.rangePlaceholder } : {}),
      };
    }

    if (props.selectionMode === 'multiple') {
      return {
        selectionMode: 'multiple' as const,
        selectedDates: props.selectedDates,
        onSelectedDatesChange: props.onSelectedDatesChange,
        ...(props.multipleLabel ? { multipleLabel: props.multipleLabel } : {}),
        ...(props.multiplePlaceholder
          ? { multiplePlaceholder: props.multiplePlaceholder }
          : {}),
      };
    }

    if (props.selectionMode === 'single') {
      return {
        selectionMode: 'single' as const,
        singleValue: props.singleValue,
        onSingleChange: props.onSingleChange,
        ...(props.singleLabel ? { singleLabel: props.singleLabel } : {}),
        ...(props.singlePlaceholder ? { singlePlaceholder: props.singlePlaceholder } : {}),
      };
    }

    return {
      ...(props.selectionMode ? { selectionMode: props.selectionMode } : {}),
      startValue: props.startValue,
      endValue: props.endValue,
      onStartChange: props.onStartChange,
      onEndChange: props.onEndChange,
      ...(props.startPlaceholder ? { startPlaceholder: props.startPlaceholder } : {}),
      ...(props.endPlaceholder ? { endPlaceholder: props.endPlaceholder } : {}),
    };
  })();

  return (
    <ControlledCalendarInfo
      className={className}
      startLabel={startLabel}
      endLabel={endLabel}
      {...controlledModeProps}
      {...(props.disabledDates ? { disabledDates: props.disabledDates } : {})}
      {...(props.allowedDates ? { allowedDates: props.allowedDates } : {})}
      {...(props.dateDetails ? { dateDetails: props.dateDetails } : {})}
    />
  );
}

function getDatePart(value: string) {
  return value.split('T')[0] ?? '';
}

function parseDatePartToLocalDate(datePart: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return undefined;

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);

  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function parseSelectedDate(value: string) {
  const datePart = getDatePart(value);
  if (!datePart) return undefined;

  return parseDatePartToLocalDate(datePart);
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function buildNextValue(date: Date) {
  return formatInputDate(date);
}

function getSortedRange(from: Date, to: Date): DateRange {
  if (from.getTime() <= to.getTime()) {
    return { from, to };
  }

  return { from: to, to: from };
}

function DayButtonWithDetails({
  detailsByDate,
  children,
  day,
  ...props
}: DayButtonProps & {
  detailsByDate: Record<string, string>;
}) {
  const detail = detailsByDate[formatInputDate(day.date)];

  return (
    <DayButton day={day} {...props}>
      <span className="willing-day-content">
        <span>{children}</span>
        {detail && <span className="willing-day-detail">{detail}</span>}
      </span>
    </DayButton>
  );
}

function ControlledCalendarInfo({
  startLabel,
  endLabel,
  className,
  showTopLabels = true,
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startPlaceholder,
  endPlaceholder,
  selectionMode,
  disabledDates,
  allowedDates,
  dateDetails,
  rangeValue,
  onRangeChange,
  rangeLabel,
  rangePlaceholder,
  selectedDates,
  onSelectedDatesChange,
  multipleLabel,
  multiplePlaceholder,
  singleValue,
  onSingleChange,
  singleLabel,
  singlePlaceholder,
}: {
  selectionMode?: CalendarSelectionMode;
  disabledDates?: string[];
  allowedDates?: string[];
  dateDetails?: Record<string, string>;
  startValue?: string;
  endValue?: string;
  onStartChange?: (value: string) => void;
  onEndChange?: (value: string) => void;
  startPlaceholder?: string;
  endPlaceholder?: string;
  rangeValue?: CalendarDateRangeValue;
  onRangeChange?: (value: CalendarDateRangeValue) => void;
  rangeLabel?: string;
  rangePlaceholder?: string;
  selectedDates?: string[];
  onSelectedDatesChange?: (values: string[]) => void;
  multipleLabel?: string;
  multiplePlaceholder?: string;
  singleValue?: string;
  onSingleChange?: (value: string) => void;
  singleLabel?: string;
  singlePlaceholder?: string;
} & {
  startLabel: string;
  endLabel: string;
  className?: string;
  showTopLabels?: boolean;
}) {
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [closingPicker, setClosingPicker] = useState<'start' | 'end' | null>(null);
  const [rangeHoverDate, setRangeHoverDate] = useState<Date>();
  const [pickerPlacement, setPickerPlacement] = useState<Record<'start' | 'end', PickerPlacement>>({
    start: 'bottom',
    end: 'bottom',
  });
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const startTriggerRef = useRef<HTMLButtonElement>(null);
  const endTriggerRef = useRef<HTMLButtonElement>(null);
  const activePopoverRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const mode = selectionMode ?? 'interval';

  const normalizedDateDetails = useMemo(() => {
    if (!dateDetails) return {};

    return Object.entries(dateDetails).reduce<Record<string, string>>((acc, [date, detail]) => {
      const key = getDatePart(date);
      if (key) {
        acc[key] = detail;
      }
      return acc;
    }, {});
  }, [dateDetails]);

  const disabledDateSet = useMemo(() => {
    return new Set((disabledDates ?? []).map(getDatePart).filter(Boolean));
  }, [disabledDates]);
  const allowedDateSet = useMemo(() => {
    return new Set((allowedDates ?? []).map(getDatePart).filter(Boolean));
  }, [allowedDates]);

  const disabledMatchers: Matcher[] | undefined = disabledDateSet.size > 0 || allowedDateSet.size > 0
    ? [
        (date: Date) => {
          const formattedDate = formatInputDate(date);

          if (disabledDateSet.has(formattedDate)) {
            return true;
          }

          if (allowedDateSet.size > 0 && !allowedDateSet.has(formattedDate)) {
            return true;
          }

          return false;
        },
      ]
    : undefined;

  const dayPickerComponents = Object.keys(normalizedDateDetails).length > 0
    ? {
        DayButton: (dayButtonProps: DayButtonProps) => (
          <DayButtonWithDetails
            {...dayButtonProps}
            detailsByDate={normalizedDateDetails}
          />
        ),
      }
    : undefined;

  const controlledClassName = className ?? 'relative overflow-visible';
  const actionButtonClassName = 'btn btn-sm';
  const secondaryActionButtonClassName = 'btn btn-ghost btn-sm';
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current != null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const beginClosePicker = (picker: 'start' | 'end') => {
    if (activePicker !== picker) return;

    clearCloseTimeout();
    setClosingPicker(picker);
    closeTimeoutRef.current = window.setTimeout(() => {
      setActivePicker(null);
      setClosingPicker(null);
      setRangeHoverDate(undefined);
      closeTimeoutRef.current = null;
    }, POPOVER_ANIMATION_DURATION_MS);
  };

  const openOrTogglePicker = (picker: 'start' | 'end') => {
    if (activePicker === picker && closingPicker !== picker) {
      beginClosePicker(picker);
      return;
    }

    clearCloseTimeout();
    setClosingPicker(null);
    setActivePicker(picker);
  };

  useEffect(() => {
    if (!activePicker) return;

    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!calendarContainerRef.current) return;
      if (calendarContainerRef.current.contains(target)) return;

      if (activePicker) {
        beginClosePicker(activePicker);
      }
    };

    document.addEventListener('pointerdown', handleClickOutside);

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [activePicker]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, []);

  useLayoutEffect(() => {
    if (!activePicker) return;

    const triggerRef = activePicker === 'start' ? startTriggerRef : endTriggerRef;
    const trigger = triggerRef.current;
    const popover = activePopoverRef.current;
    if (!trigger || !popover) return;

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const gap = 8;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    const spaceAbove = triggerRect.top;
    const nextPlacement: PickerPlacement = spaceBelow < popoverRect.height + gap && spaceAbove > spaceBelow
      ? 'top'
      : 'bottom';

    setPickerPlacement((prev) => {
      if (prev[activePicker] === nextPlacement) return prev;
      return {
        ...prev,
        [activePicker]: nextPlacement,
      };
    });
  }, [activePicker]);

  const getPopoverPlacementClass = (picker: 'start' | 'end') => {
    return pickerPlacement[picker] === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';
  };

  const getPopoverAnimationClass = (picker: 'start' | 'end') => {
    const isClosing = closingPicker === picker;

    if (isClosing) {
      return pickerPlacement[picker] === 'top'
        ? 'willing-calendar-popover willing-calendar-popover-closing-top pointer-events-none'
        : 'willing-calendar-popover willing-calendar-popover-closing-bottom pointer-events-none';
    }

    return pickerPlacement[picker] === 'top'
      ? 'willing-calendar-popover willing-calendar-popover-top'
      : 'willing-calendar-popover willing-calendar-popover-bottom';
  };

  if (mode === 'interval') {
    const selectedStartDate = parseSelectedDate(startValue ?? '');
    const selectedEndDate = parseSelectedDate(endValue ?? '');

    const startText = selectedStartDate
      ? dateFormatter.format(selectedStartDate)
      : (startPlaceholder ?? startLabel);

    const endText = selectedEndDate
      ? dateFormatter.format(selectedEndDate)
      : (endPlaceholder ?? endLabel);

    const dateClassName = className ?? 'contents';

    return (
      <div ref={calendarContainerRef} className={dateClassName}>
        <fieldset className="fieldset w-full">
          <div className="relative">
            {showTopLabels && (
              <label className="label mb-1">
                <span className="label-text font-medium">{startLabel}</span>
              </label>
            )}
            <button
              ref={startTriggerRef}
              type="button"
              className="input input-bordered flex w-full items-center justify-between gap-2"
              onClick={() => openOrTogglePicker('start')}
            >
              <span className="truncate text-left">{startText}</span>
              <CalendarDays size={16} className="shrink-0 opacity-70" />
            </button>

            {activePicker === 'start' && (
              <div
                ref={activePopoverRef}
                className={`absolute left-0 z-500 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl ${getPopoverPlacementClass('start')} ${getPopoverAnimationClass('start')}`}
              >
                <DayPicker
                  className="willing-day-picker"
                  mode="single"
                  selected={selectedStartDate}
                  disabled={disabledMatchers}
                  components={dayPickerComponents}
                  onSelect={(date) => {
                    if (!onStartChange) return;

                    onStartChange(date ? buildNextValue(date) : '');
                    if (date) {
                      beginClosePicker('start');
                    }
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className={secondaryActionButtonClassName}
                    onClick={() => onStartChange?.('')}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className={actionButtonClassName}
                    onClick={() => beginClosePicker('start')}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>

        <fieldset className="fieldset w-full">
          <div className="relative">
            {showTopLabels && (
              <label className="label mb-1">
                <span className="label-text font-medium">{endLabel}</span>
              </label>
            )}
            <button
              ref={endTriggerRef}
              type="button"
              className="input input-bordered flex w-full items-center justify-between gap-2"
              onClick={() => openOrTogglePicker('end')}
            >
              <span className="truncate text-left">{endText}</span>
              <CalendarDays size={16} className="shrink-0 opacity-70" />
            </button>

            {activePicker === 'end' && (
              <div
                ref={activePopoverRef}
                className={`absolute left-0 z-500 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl ${getPopoverPlacementClass('end')} ${getPopoverAnimationClass('end')}`}
              >
                <DayPicker
                  className="willing-day-picker"
                  mode="single"
                  selected={selectedEndDate}
                  disabled={disabledMatchers}
                  components={dayPickerComponents}
                  onSelect={(date) => {
                    if (!onEndChange) return;

                    onEndChange(date ? buildNextValue(date) : '');
                    if (date) {
                      beginClosePicker('end');
                    }
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className={secondaryActionButtonClassName}
                    onClick={() => onEndChange?.('')}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className={actionButtonClassName}
                    onClick={() => beginClosePicker('end')}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    );
  }

  if (mode === 'range') {
    const currentRange = rangeValue ?? { from: '', to: '' };
    const selectedFromDate = parseSelectedDate(currentRange.from);
    const selectedToDate = parseSelectedDate(currentRange.to);

    const selectedRange: DateRange | undefined = selectedFromDate || selectedToDate
      ? {
          from: selectedFromDate,
          to: selectedToDate,
        }
      : undefined;

    const hoverPreviewRange = selectedFromDate && !selectedToDate && rangeHoverDate
      ? getSortedRange(selectedFromDate, rangeHoverDate)
      : undefined;

    const hoverRangeModifiers = hoverPreviewRange
      ? {
          hoverRange: hoverPreviewRange,
          hoverRangeStart: hoverPreviewRange.from,
          hoverRangeEnd: hoverPreviewRange.to,
        }
      : undefined;
    const rangeFieldLabel = rangeLabel ?? 'Date Range';

    let valueText = rangePlaceholder ?? 'Select range';
    if (selectedFromDate) {
      valueText = dateFormatter.format(selectedFromDate);

      if (selectedToDate) {
        valueText = `${valueText} -> ${dateFormatter.format(selectedToDate)}`;
      }
    }

    const handleRangePreviewHover = (date: Date, disabled?: boolean) => {
      if (disabled || !selectedFromDate || selectedToDate) return;
      setRangeHoverDate(date);
    };

    return (
      <div ref={calendarContainerRef} className={controlledClassName}>
        <fieldset className="fieldset w-full">
          <div className="relative">
            {showTopLabels && (
              <label className="label mb-1">
                <span className="label-text font-medium">{rangeFieldLabel}</span>
              </label>
            )}
            <button
              ref={startTriggerRef}
              type="button"
              className="input input-bordered flex w-full items-center justify-between gap-2"
              onClick={() => openOrTogglePicker('start')}
            >
              <span className="truncate text-left">{valueText}</span>
              <CalendarDays size={16} className="shrink-0 opacity-70" />
            </button>

            {activePicker === 'start' && (
              <div
                ref={activePopoverRef}
                className={`absolute left-0 z-500 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl ${getPopoverPlacementClass('start')} ${getPopoverAnimationClass('start')}`}
              >
                <DayPicker
                  className="willing-day-picker"
                  style={{ maxHeight: '75vh', overflowY: 'auto' }}
                  mode="range"
                  selected={selectedRange}
                  disabled={disabledMatchers}
                  modifiers={hoverRangeModifiers}
                  modifiersClassNames={{
                    hoverRange: 'willing-hover-range',
                    hoverRangeStart: 'willing-hover-range-start',
                    hoverRangeEnd: 'willing-hover-range-end',
                  }}
                  components={dayPickerComponents}
                  onDayMouseEnter={(date, modifiers) => {
                    handleRangePreviewHover(date, modifiers.disabled);
                  }}
                  onDayMouseLeave={() => setRangeHoverDate(undefined)}
                  onSelect={(range) => {
                    if (!onRangeChange) return;

                    setRangeHoverDate(undefined);

                    const nextFrom = range?.from
                      ? buildNextValue(range.from)
                      : '';
                    const nextTo = range?.to
                      ? buildNextValue(range.to)
                      : '';

                    onRangeChange({
                      from: nextFrom,
                      to: nextTo,
                    });
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className={secondaryActionButtonClassName}
                    onClick={() => onRangeChange?.({ from: '', to: '' })}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className={actionButtonClassName}
                    onClick={() => beginClosePicker('start')}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    );
  }

  const selectedDateValues = selectedDates ?? [];
  const parsedSelectedDates = selectedDateValues
    .map(parseSelectedDate)
    .filter((date): date is Date => Boolean(date));

  if (mode === 'single') {
    const selectedDate = parseSelectedDate(singleValue ?? '');
    const singleFieldLabel = singleLabel ?? startLabel;
    const singleText = selectedDate
      ? dateFormatter.format(selectedDate)
      : (singlePlaceholder ?? singleFieldLabel);

    return (
      <div ref={calendarContainerRef} className={controlledClassName}>
        <fieldset className="fieldset w-full">
          <div className="relative">
            {showTopLabels && (
              <label className="label mb-1">
                <span className="label-text font-medium">{singleFieldLabel}</span>
              </label>
            )}
            <button
              ref={startTriggerRef}
              type="button"
              className="input input-bordered flex w-full items-center justify-between gap-2"
              onClick={() => openOrTogglePicker('start')}
            >
              <span className="truncate text-left">{singleText}</span>
              <CalendarDays size={16} className="shrink-0 opacity-70" />
            </button>

            {activePicker === 'start' && (
              <div
                ref={activePopoverRef}
                className={`absolute left-0 z-500 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl ${getPopoverPlacementClass('start')} ${getPopoverAnimationClass('start')}`}
              >
                <DayPicker
                  className="willing-day-picker"
                  mode="single"
                  selected={selectedDate}
                  disabled={disabledMatchers}
                  components={dayPickerComponents}
                  onSelect={(date) => {
                    if (!onSingleChange) return;

                    onSingleChange(date ? buildNextValue(date) : '');
                    if (date) {
                      beginClosePicker('start');
                    }
                  }}
                />

                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className={secondaryActionButtonClassName}
                    onClick={() => onSingleChange?.('')}
                  >
                    Clear
                  </button>

                  <button
                    type="button"
                    className={actionButtonClassName}
                    onClick={() => beginClosePicker('start')}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    );
  }

  const MAX_DISPLAYED_DATES = 4;
  const allSelectedDateText = parsedSelectedDates.map(date => dateFormatter.format(date)).join(', ');
  const dateListText = parsedSelectedDates.length === 0
    ? (multiplePlaceholder ?? 'Select dates')
    : parsedSelectedDates.length <= MAX_DISPLAYED_DATES
      ? allSelectedDateText
      : `${parsedSelectedDates.slice(0, MAX_DISPLAYED_DATES).map(date => dateFormatter.format(date)).join(', ')} +${parsedSelectedDates.length - MAX_DISPLAYED_DATES} more`;
  const multipleFieldLabel = multipleLabel ?? 'Selected Dates';

  return (
    <div ref={calendarContainerRef} className={controlledClassName}>
      <fieldset className="fieldset w-full">
        <div className="relative">
          {showTopLabels && (
            <label className="label mb-1">
              <span className="label-text font-medium">{multipleFieldLabel}</span>
            </label>
          )}
          <button
            ref={startTriggerRef}
            type="button"
            className="input input-bordered flex w-full items-center justify-between gap-2"
            onClick={() => openOrTogglePicker('start')}
          >
            <span className="truncate overflow-hidden whitespace-nowrap text-ellipsis block max-w-[calc(100%-2.5rem)]" title={allSelectedDateText || dateListText}>{dateListText}</span>
            <CalendarDays size={16} className="shrink-0 opacity-70" />
          </button>

          {activePicker === 'start' && (
            <div
              ref={activePopoverRef}
              className={`absolute left-0 z-500 rounded-box border border-base-300 bg-base-100 p-3 shadow-xl ${getPopoverPlacementClass('start')} ${getPopoverAnimationClass('start')}`}
            >
              <DayPicker
                className="willing-day-picker"
                mode="multiple"
                selected={parsedSelectedDates}
                disabled={disabledMatchers}
                components={dayPickerComponents}
                onSelect={(dates) => {
                  if (!onSelectedDatesChange) return;

                  const nextValues = (dates ?? [])
                    .map(formatInputDate)
                    .sort((left, right) => left.localeCompare(right));

                  onSelectedDatesChange(nextValues);
                }}
              />

              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  className={secondaryActionButtonClassName}
                  onClick={() => onSelectedDatesChange?.([])}
                >
                  Clear
                </button>

                <button
                  type="button"
                  className={actionButtonClassName}
                  onClick={() => beginClosePicker('start')}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </fieldset>
    </div>
  );
}

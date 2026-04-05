import { RotateCcw, Search, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useMemo, useState } from 'react';
import { useForm, useWatch, type DefaultValues, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

import { FormField } from '../../utils/formUtils.tsx';
import Button from '../Button.tsx';
import Card from '../Card.tsx';

type FilterSelectOption = {
  label: string;
  value: string | number;
};

type PostingFiltersCardProps<T extends FieldValues> = {
  defaultValues: T;
  onApply: (values: T) => Promise<void> | void;
  getHasAdvancedFiltersApplied: (values: T) => boolean;
  renderAdvancedFields: (form: UseFormReturn<T>) => ReactNode;
  searchFieldName: Path<T>;
  searchPlaceholder: string;
  sortFieldName: Path<T>;
  sortOptions: FilterSelectOption[];
  organizationSortOptions?: FilterSelectOption[];
  showAdvanced?: boolean;
  title?: string;
  submitLabel?: string;
  submitIcon?: LucideIcon;
  topContent?: ReactNode;
  extraFields?: (form: UseFormReturn<T>) => ReactNode;
};

function PostingFiltersCard<T extends FieldValues>({
  defaultValues,
  onApply,
  getHasAdvancedFiltersApplied,
  renderAdvancedFields,
  searchFieldName,
  searchPlaceholder,
  sortFieldName,
  sortOptions,
  organizationSortOptions,
  showAdvanced = true,
  title = 'Filters',
  submitLabel = 'Search',
  submitIcon = Search,
  topContent,
  extraFields,
}: PostingFiltersCardProps<T>) {
  const form = useForm<T, undefined, T>({
    defaultValues: defaultValues as DefaultValues<T>,
  });

  const [appliedValues, setAppliedValues] = useState<T>(defaultValues);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

  const watchedValues = useWatch({ control: form.control });
  const entityValue = useWatch({
    control: form.control,
    name: 'entity' as Path<T>,
  }) as unknown as 'postings' | 'organizations' | undefined;
  const draftValues = useMemo(() => ({
    ...defaultValues,
    ...(watchedValues ?? {}),
  }) as T, [defaultValues, watchedValues]);

  const defaultSnapshot = JSON.stringify(defaultValues);
  const draftSnapshot = JSON.stringify(draftValues);
  const appliedSnapshot = JSON.stringify(appliedValues);
  const hasPendingChanges = draftSnapshot !== appliedSnapshot;
  const hasAnyChangesFromDefault = draftSnapshot !== defaultSnapshot || appliedSnapshot !== defaultSnapshot;
  const hasAdvancedFiltersApplied = getHasAdvancedFiltersApplied(draftValues);
  const showAdvancedFilters = showAdvanced ?? true;

  const onApplyRef = useRef(onApply);
  useEffect(() => {
    onApplyRef.current = onApply;
  });

  useEffect(() => {
    setAppliedValues(defaultValues);
    form.reset(defaultValues);
    setShowAdvancedSearch(false);
    void onApplyRef.current(defaultValues);
  }, [defaultValues, form]);

  const applyFilters = form.handleSubmit(async (values) => {
    setAppliedValues(values);
    await onApply(values);
  });

  const resetFilters = async () => {
    form.reset(defaultValues);
    setAppliedValues(defaultValues);
    setShowAdvancedSearch(false);
    await onApply(defaultValues);
  };

  const extraFieldsContent = extraFields ? extraFields(form) : null;
  const hasExtraFieldsContent = extraFieldsContent !== null;

  return (
    <Card>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>

      {topContent && (
        <div className="mb-4 w-full">
          {topContent}
        </div>
      )}

      <form className="space-y-4" onSubmit={applyFilters}>
        <div
          className={`grid grid-cols-1 items-end gap-4 ${
            hasExtraFieldsContent
              ? 'md:grid-cols-[minmax(0,1fr)_12rem_12rem]'
              : 'md:grid-cols-[minmax(0,1fr)_16rem]'
          }`}
        >
          <div className="mb-0 min-w-0">

            <FormField
              form={form}
              name={searchFieldName}
              label="Search"
              placeholder={searchPlaceholder}
              Icon={Search}
            />
          </div>

          {hasExtraFieldsContent && (
            <div className="min-w-0">
              {extraFieldsContent}
            </div>
          )}

          <div className="min-w-0">
            <FormField
              form={form}
              name={sortFieldName}
              label="Sort By"
              selectOptions={entityValue === 'organizations' && organizationSortOptions ? organizationSortOptions : sortOptions}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {showAdvancedFilters && (
            <Button
              type="button"
              color={hasAdvancedFiltersApplied || showAdvancedSearch ? 'secondary' : 'ghost'}
              onClick={() => setShowAdvancedSearch(prev => !prev)}
              Icon={SlidersHorizontal}
            >
              Advanced Search
            </Button>
          )}

          <div className="flex-1" />

          <Button
            type="button"
            color="ghost"
            disabled={!hasAnyChangesFromDefault}
            onClick={() => void resetFilters()}
            Icon={RotateCcw}
          >
            Reset
          </Button>

          <Button
            color="primary"
            type="submit"
            disabled={!hasPendingChanges}
            Icon={submitIcon}
            layout="wide"
            className="h-11 w-full"
          >
            {submitLabel}
          </Button>
        </div>

        {showAdvancedFilters && showAdvancedSearch && (
          <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {renderAdvancedFields(form)}
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

export default PostingFiltersCard;

import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Pencil, Pin, PinOff, Plus, RotateCcw, Save, Search, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useForm } from 'react-hook-form';
import zod from 'zod';

import { newCrisisSchema } from '../../../../server/src/db/tables';
import Button from '../../components/Button';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import ColumnLayout from '../../components/layout/ColumnLayout';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import CrisisCard from '../../components/postings/CrisisCard';
import { useModal } from '../../contexts/useModal.ts';
import useNotifications from '../../notifications/useNotifications';
import { executeAndShowError, FormField, FormRootError } from '../../utils/formUtils';
import requestServer from '../../utils/requestServer';
import useAsync from '../../utils/useAsync';

import type {
  AdminCrisisCreateResponse,
  AdminCrisisDeleteResponse,
  AdminCrisisPinResponse,
  AdminCrisisUpdateResponse,
  AdminCrisesResponse,
} from '../../../../server/src/api/types';

const createCrisisFormSchema = zod.object({
  name: newCrisisSchema.shape.name,
  description: zod.string().optional(),
});
const editCrisisFormSchema = createCrisisFormSchema;

type CreateCrisisFormData = zod.infer<typeof createCrisisFormSchema>;

type CrisisSortBy = 'pinned' | 'created_at' | 'name';
type CrisisSortDir = 'asc' | 'desc';
type CrisisSortOptionValue = `${CrisisSortBy}_${CrisisSortDir}`;

type CrisisFilters = {
  search: string;
  sortBy: CrisisSortBy;
  sortDir: CrisisSortDir;
  pinned: 'all' | 'pinned' | 'unpinned';
};

const crisisSortOptions: Array<{ value: CrisisSortOptionValue; label: string; sortBy: CrisisSortBy; sortDir: CrisisSortDir }> = [
  { value: 'pinned_desc', label: 'Pinned first', sortBy: 'pinned', sortDir: 'desc' },
  { value: 'pinned_asc', label: 'Unpinned first', sortBy: 'pinned', sortDir: 'asc' },
  { value: 'created_at_desc', label: 'Newest crises', sortBy: 'created_at', sortDir: 'desc' },
  { value: 'created_at_asc', label: 'Oldest crises', sortBy: 'created_at', sortDir: 'asc' },
  { value: 'name_asc', label: 'Name: A to Z', sortBy: 'name', sortDir: 'asc' },
  { value: 'name_desc', label: 'Name: Z to A', sortBy: 'name', sortDir: 'desc' },
];

const defaultFilters: CrisisFilters = {
  search: '',
  sortBy: 'pinned',
  sortDir: 'desc',
  pinned: 'all',
};
const crisisFiltersStorageKey = 'admin-crises-filters';

function AdminCrises() {
  const initialFilters = useMemo<CrisisFilters>(() => {
    if (typeof window === 'undefined') return defaultFilters;
    const raw = window.sessionStorage.getItem(crisisFiltersStorageKey);
    if (!raw) return defaultFilters;

    try {
      const parsed = JSON.parse(raw) as Partial<CrisisFilters>;
      return { ...defaultFilters, ...parsed };
    } catch {
      return defaultFilters;
    }
  }, []);

  const [filters, setFilters] = useState<CrisisFilters>(initialFilters);
  const [activeFilters, setActiveFilters] = useState<CrisisFilters>(initialFilters);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [isCreatingCrisis, setIsCreatingCrisis] = useState(false);
  const [editingCrisisId, setEditingCrisisId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);
  const notifications = useNotifications();
  const modal = useModal();

  const crisisForm = useForm<CreateCrisisFormData>({
    resolver: zodResolver(createCrisisFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const getCrises = useCallback(async (nextFilters: CrisisFilters) => {
    const query: Record<string, string> = {
      sortBy: nextFilters.sortBy,
      sortDir: nextFilters.sortDir,
    };

    if (nextFilters.search.trim()) {
      query.search = nextFilters.search.trim();
    }

    if (nextFilters.pinned !== 'all') {
      query.pinned = nextFilters.pinned === 'pinned' ? 'true' : 'false';
    }

    const res = await requestServer<AdminCrisesResponse>('/admin/crises', {
      includeJwt: true,
      query,
    });
    return res.crises;
  }, []);

  const {
    data: crises,
    trigger: refreshCrises,
  } = useAsync(getCrises, { immediate: false });

  useEffect(() => {
    void refreshCrises(activeFilters);
  }, [activeFilters, refreshCrises]);

  const refreshCurrentCrises = useCallback(
    async () => refreshCrises(activeFilters),
    [activeFilters, refreshCrises],
  );

  const { trigger: updateCrisis } = useAsync(
    async (
      crisisId: number,
      data: { name: string; description?: string },
    ) => requestServer<AdminCrisisUpdateResponse>(`/admin/crises/${crisisId}`, {
      method: 'PUT',
      includeJwt: true,
      body: {
        name: data.name,
        description: data.description?.trim() ? data.description.trim() : undefined,
      },
    }),
    { notifyOnError: true },
  );

  const { trigger: deleteCrisis } = useAsync(
    async (crisisId: number) => requestServer<AdminCrisisDeleteResponse>(`/admin/crises/${crisisId}`, {
      method: 'DELETE',
      includeJwt: true,
    }),
    { notifyOnError: true },
  );

  const { trigger: toggleCrisisPin } = useAsync(
    async (crisisId: number, pinned: boolean) => requestServer<AdminCrisisPinResponse>(`/admin/crises/${crisisId}/pin`, {
      method: 'PATCH',
      includeJwt: true,
      body: {
        pinned: !pinned,
      },
    }),
    { notifyOnError: true },
  );

  const onCreateCrisis = crisisForm.handleSubmit(async (data) => {
    await executeAndShowError(crisisForm, async () => {
      setIsCreatingCrisis(true);

      await requestServer<AdminCrisisCreateResponse>('/admin/crises', {
        method: 'POST',
        includeJwt: true,
        body: {
          name: data.name,
          description: data.description?.trim() ? data.description.trim() : undefined,
        },
      });

      crisisForm.reset({
        name: '',
        description: '',
      });
      await refreshCurrentCrises();
      notifications.push({
        type: 'success',
        message: 'Crisis created successfully.',
      });
    });

    setIsCreatingCrisis(false);
  });

  const onStartEdit = (crisisId: number, name: string, description?: string | null) => {
    setEditingCrisisId(crisisId);
    setEditingName(name);
    setEditingDescription(description ?? '');
  };

  const onCancelEdit = () => {
    setEditingCrisisId(null);
    setEditingName('');
    setEditingDescription('');
  };

  const onSaveEdit = async (crisisId: number) => {
    const parsed = editCrisisFormSchema.safeParse({
      name: editingName,
      description: editingDescription,
    });

    if (!parsed.success) {
      notifications.push({
        type: 'warning',
        message: parsed.error.issues[0]?.message ?? 'Invalid crisis details',
      });
      return;
    }

    setActionBusyId(crisisId);

    try {
      await updateCrisis(crisisId, parsed.data);

      await refreshCurrentCrises();
      notifications.push({
        type: 'success',
        message: 'Crisis updated successfully.',
      });
      onCancelEdit();
    } finally {
      setActionBusyId(null);
    }
  };

  const onDelete = async (crisisId: number, name: string) => {
    const choice = await modal.promptModal({
      title: 'Delete Crisis',
      content: `Delete crisis "${name}"?`,
      actions: [
        { value: 'cancel', label: 'Cancel', color: 'ghost' },
        { value: 'delete', label: 'Delete crisis', color: 'error' },
      ],
      cancelable: true,
    });

    if (choice !== 'delete') return;

    setActionBusyId(crisisId);

    try {
      await deleteCrisis(crisisId);

      if (editingCrisisId === crisisId) {
        onCancelEdit();
      }

      await refreshCurrentCrises();
      notifications.push({
        type: 'success',
        message: 'Crisis deleted successfully.',
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const onTogglePin = async (crisisId: number, pinned: boolean) => {
    setActionBusyId(crisisId);

    try {
      await toggleCrisisPin(crisisId, pinned);

      await refreshCurrentCrises();
      notifications.push({
        type: 'success',
        message: pinned ? 'Crisis unpinned.' : 'Crisis pinned.',
      });
    } finally {
      setActionBusyId(null);
    }
  };

  const crisisCountBadge = useMemo(() => {
    if (!crises) {
      return <div className="w-18 h-6 skeleton" />;
    }

    return (
      <div className="badge badge-primary">
        {crises.length}
        {' '}
        Total
      </div>
    );
  }, [crises]);

  const hasPendingChanges = useMemo(() => JSON.stringify(filters) !== JSON.stringify(activeFilters), [filters, activeFilters]);
  const hasAnyChangesFromDefault = useMemo(() => (
    JSON.stringify(filters) !== JSON.stringify(defaultFilters)
    || JSON.stringify(activeFilters) !== JSON.stringify(defaultFilters)
  ), [filters, activeFilters]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActiveFilters(filters);
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(crisisFiltersStorageKey, JSON.stringify(filters));
    }
  };

  const resetFilters = () => {
    setFilters(defaultFilters);
    setActiveFilters(defaultFilters);
    setShowAdvancedSearch(false);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(crisisFiltersStorageKey);
    }
  };

  const selectedSortOption = crisisSortOptions.find(option => (
    option.sortBy === filters.sortBy && option.sortDir === filters.sortDir
  )) ?? crisisSortOptions[0];

  const hasAdvancedFiltersApplied = filters.pinned !== 'all';

  const onSortChange = (value: CrisisSortOptionValue) => {
    const nextOption = crisisSortOptions.find(option => option.value === value);
    if (!nextOption) return;

    setFilters(prev => ({
      ...prev,
      sortBy: nextOption.sortBy,
      sortDir: nextOption.sortDir,
    }));
  };

  return (
    <PageContainer>
      <PageHeader
        title="Crisis Management"
        subtitle="Create, edit, delete, and pin crises according to the current situation."
        icon={AlertCircle}
      />

      <ColumnLayout
        stickySidebar
        sidebar={(
          <Card
            title="Create Crisis"
            description="Add a new crisis tag."
          >
            <form className="mt-2 space-y-4" onSubmit={onCreateCrisis}>
              <FormField
                form={crisisForm}
                name="name"
                label="Crisis Name"
                placeholder="Crisis name"
                Icon={AlertCircle}
              />
              <FormField
                form={crisisForm}
                name="description"
                label="Description (Optional)"
                type="textarea"
              />

              <Button
                color="primary"
                type="submit"
                loading={isCreatingCrisis}
                Icon={Plus}
                layout="block"
              >
                Add Crisis
              </Button>
            </form>

            <FormRootError form={crisisForm} />

          </Card>
        )}
      >
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Existing Crises</h3>
            {crisisCountBadge}
          </div>

          <Card
            title="Filters"
          >
            <form className="space-y-4" onSubmit={applyFilters}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                <div className="flex-2">
                  <label className="label" htmlFor="admin-crises-search">
                    <span className="label-text">Search</span>
                  </label>
                  <label className="input input-bordered flex w-full items-center gap-2">
                    <Search className="h-4 w-4 opacity-70" />
                    <input
                      id="admin-crises-search"
                      type="text"
                      className="w-full min-w-0"
                      placeholder="Search crisis name or description"
                      value={filters.search}
                      onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
                    />
                  </label>
                </div>

                <div className="flex-1">
                  <label className="label" htmlFor="admin-crises-sort">
                    <span className="label-text">Sort By</span>
                  </label>
                  <select
                    id="admin-crises-sort"
                    className="select select-bordered w-full"
                    value={selectedSortOption.value}
                    onChange={event => onSortChange(event.target.value as CrisisSortOptionValue)}
                  >
                    {crisisSortOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  color={hasAdvancedFiltersApplied || showAdvancedSearch ? 'secondary' : 'ghost'}
                  onClick={() => setShowAdvancedSearch(prev => !prev)}
                  Icon={SlidersHorizontal}
                >
                  Advanced Search
                </Button>

                <div className="flex-1" />

                <Button type="button" color="ghost" onClick={resetFilters} disabled={!hasAnyChangesFromDefault} Icon={RotateCcw}>Reset</Button>

                <Button
                  color="primary"
                  type="submit"
                  disabled={!hasPendingChanges}
                  layout="wide"
                  Icon={Search}
                >
                  Search
                </Button>
              </div>

              {showAdvancedSearch && (
                <div className="rounded-box border border-base-300 bg-base-200/40 p-4">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <select
                      className="select select-bordered w-full"
                      value={filters.pinned}
                      onChange={event => setFilters(prev => ({
                        ...prev,
                        pinned: event.target.value as CrisisFilters['pinned'],
                      }))}
                    >
                      <option value="all">Pinned State: All</option>
                      <option value="pinned">Pinned State: Pinned</option>
                      <option value="unpinned">Pinned State: Unpinned</option>
                    </select>
                  </div>
                </div>
              )}
            </form>
          </Card>

          {!crises
            ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="skeleton h-24 rounded-box" />
                  <div className="skeleton h-24 rounded-box" />
                </div>
              )
            : crises.length === 0
              ? (
                  <EmptyState
                    Icon={AlertCircle}
                    title="No crises added yet"
                    description="Create a crisis to help organizations tag urgent opportunities."
                  />
                )
              : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {crises.map(crisis => (
                      <CrisisCard
                        key={crisis.id}
                        crisis={crisis}
                        link={undefined}
                        descriptionFallback={editingCrisisId === crisis.id ? '' : 'No description set'}
                        right={
                          crisis.pinned
                          && <span className="badge badge-secondary">Pinned</span>
                        }
                      >

                        {editingCrisisId === crisis.id
                          ? (
                              <div className="">
                                <input
                                  value={editingName}
                                  onChange={event => setEditingName(event.target.value)}
                                  className="input input-bordered w-full"
                                  placeholder="Crisis name"
                                />
                                <textarea
                                  value={editingDescription}
                                  onChange={event => setEditingDescription(event.target.value)}
                                  className="textarea textarea-bordered w-full"
                                  placeholder="Description (optional)"
                                  rows={3}
                                />
                                <div className="flex flex-row-reverse flex-wrap gap-2">
                                  <Button
                                    color="primary"
                                    type="button"
                                    onClick={() => onSaveEdit(crisis.id)}
                                    disabled={actionBusyId === crisis.id}
                                    Icon={Save}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    color="ghost"
                                    onClick={onCancelEdit}
                                    disabled={actionBusyId === crisis.id}
                                    Icon={X}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            )
                          : (
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  style="outline"
                                  size="sm"
                                  onClick={() => onTogglePin(crisis.id, crisis.pinned)}
                                  disabled={actionBusyId === crisis.id}
                                  Icon={crisis.pinned ? PinOff : Pin}
                                >
                                  {crisis.pinned ? 'Unpin' : 'Pin'}
                                </Button>
                                <Button
                                  type="button"
                                  style="outline"
                                  size="sm"
                                  onClick={() => onStartEdit(crisis.id, crisis.name, crisis.description)}
                                  disabled={actionBusyId === crisis.id}
                                  Icon={Pencil}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  style="outline"
                                  color="error"
                                  size="sm"
                                  onClick={() => onDelete(crisis.id, crisis.name)}
                                  disabled={actionBusyId === crisis.id}
                                  Icon={Trash2}
                                >
                                  Delete
                                </Button>
                              </div>
                            )}
                      </CrisisCard>
                    ))}
                  </div>
                )}
        </section>
      </ColumnLayout>
    </PageContainer>
  );
}

export default AdminCrises;

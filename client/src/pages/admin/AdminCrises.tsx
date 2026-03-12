import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, FileText, Pencil, Pin, PinOff, PlusCircle, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import zod from 'zod';

import { newCrisisSchema } from '../../../../server/src/db/tables';
import PageHeader from '../../components/layout/PageHeader';
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

function AdminCrises() {
  const [isCreatingCrisis, setIsCreatingCrisis] = useState(false);
  const [editingCrisisId, setEditingCrisisId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [editingError, setEditingError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const crisisForm = useForm<CreateCrisisFormData>({
    resolver: zodResolver(createCrisisFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const getCrises = useCallback(async () => {
    const res = await requestServer<AdminCrisesResponse>('/admin/crises', { includeJwt: true });
    return res.crises;
  }, []);

  const {
    data: crises,
    trigger: refreshCrises,
  } = useAsync(getCrises, true);

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
      await refreshCrises();
    });

    setIsCreatingCrisis(false);
  });

  const onStartEdit = (crisisId: number, name: string, description?: string) => {
    setEditingCrisisId(crisisId);
    setEditingName(name);
    setEditingDescription(description ?? '');
    setEditingError(null);
  };

  const onCancelEdit = () => {
    setEditingCrisisId(null);
    setEditingName('');
    setEditingDescription('');
    setEditingError(null);
  };

  const onSaveEdit = async (crisisId: number) => {
    const parsed = editCrisisFormSchema.safeParse({
      name: editingName,
      description: editingDescription,
    });

    if (!parsed.success) {
      setEditingError(parsed.error.issues[0]?.message ?? 'Invalid crisis details');
      return;
    }

    setActionBusyId(crisisId);
    setEditingError(null);

    try {
      await requestServer<AdminCrisisUpdateResponse>(`/admin/crises/${crisisId}`, {
        method: 'PUT',
        includeJwt: true,
        body: {
          name: parsed.data.name,
          description: parsed.data.description?.trim() ? parsed.data.description.trim() : undefined,
        },
      });

      await refreshCrises();
      onCancelEdit();
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : 'Failed to update crisis');
    } finally {
      setActionBusyId(null);
    }
  };

  const onDelete = async (crisisId: number, name: string) => {
    const confirmed = window.confirm(`Delete crisis "${name}"?`);
    if (!confirmed) return;

    setActionBusyId(crisisId);
    setEditingError(null);

    try {
      await requestServer<AdminCrisisDeleteResponse>(`/admin/crises/${crisisId}`, {
        method: 'DELETE',
        includeJwt: true,
      });

      if (editingCrisisId === crisisId) {
        onCancelEdit();
      }

      await refreshCrises();
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : 'Failed to delete crisis');
    } finally {
      setActionBusyId(null);
    }
  };

  const onTogglePin = async (crisisId: number, pinned: boolean) => {
    setActionBusyId(crisisId);
    setEditingError(null);

    try {
      await requestServer<AdminCrisisPinResponse>(`/admin/crises/${crisisId}/pin`, {
        method: 'PATCH',
        includeJwt: true,
        body: {
          pinned: !pinned,
        },
      });

      await refreshCrises();
    } catch (error) {
      setEditingError(error instanceof Error ? error.message : 'Failed to update pin status');
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

  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Crisis Management"
          subtitle="Create, edit, delete, and pin crises according to the current situation."
          icon={AlertCircle}
          badge={crisisCountBadge}
          variant="gradient"
        />

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <section className="xl:col-span-4">
            <div className="card border border-primary/20 bg-base-100 shadow-sm xl:sticky xl:top-24">
              <div className="card-body">
                <h3 className="card-title text-base">Create Crisis</h3>
                <p className="text-sm opacity-70">Add a new crisis entry.</p>

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
                    Icon={FileText}
                  />

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={isCreatingCrisis}
                  >
                    <PlusCircle size={16} />
                    {isCreatingCrisis ? 'Adding...' : 'Add Crisis'}
                  </button>
                </form>

                <FormRootError form={crisisForm} />
              </div>
            </div>
          </section>

          <section className="xl:col-span-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold">Existing Crises</h3>
              {crisisCountBadge}
            </div>

            {editingError && (
              <div role="alert" className="alert alert-error mb-3">
                <span>{editingError}</span>
              </div>
            )}

            {!crises
              ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="skeleton h-24 rounded-box" />
                    <div className="skeleton h-24 rounded-box" />
                  </div>
                )
              : crises.length === 0
                ? (
                    <div className="alert alert-soft">
                      <span>No crises added yet.</span>
                    </div>
                  )
                : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {crises.map(crisis => (
                        <div
                          key={crisis.id}
                          className="card border border-base-300 bg-base-100 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="card-body">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                                  <AlertCircle size={16} />
                                </div>
                                <h4 className="font-bold text-lg leading-tight">{crisis.name}</h4>
                              </div>
                              {crisis.pinned && <span className="badge badge-secondary">Pinned</span>}
                            </div>

                            {editingCrisisId === crisis.id
                              ? (
                                  <div className="space-y-3 mt-2">
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
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => onSaveEdit(crisis.id)}
                                        disabled={actionBusyId === crisis.id}
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={onCancelEdit}
                                        disabled={actionBusyId === crisis.id}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )
                              : (
                                  <>
                                    <p className="text-sm opacity-70 mt-2 whitespace-pre-wrap break-words">
                                      {crisis.description || 'No description set'}
                                    </p>
                                    <div className="card-actions justify-end mt-2">
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => onTogglePin(crisis.id, crisis.pinned)}
                                        disabled={actionBusyId === crisis.id}
                                      >
                                        {crisis.pinned
                                          ? <PinOff size={14} />
                                          : <Pin size={14} />}
                                        {crisis.pinned ? 'Unpin' : 'Pin'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-outline btn-sm"
                                        onClick={() => onStartEdit(crisis.id, crisis.name, crisis.description)}
                                        disabled={actionBusyId === crisis.id}
                                      >
                                        <Pencil size={14} />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-error btn-outline btn-sm"
                                        onClick={() => onDelete(crisis.id, crisis.name)}
                                        disabled={actionBusyId === crisis.id}
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminCrises;

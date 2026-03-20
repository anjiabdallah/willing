import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle, LockKeyhole, Save } from 'lucide-react';
import { useContext } from 'react';
import { useForm } from 'react-hook-form';
import zod from 'zod';

import Button from './Button';
import { passwordSchema } from '../../../server/src/db/tables';
import AuthContext from '../auth/AuthContext';
import useNotifications from '../notifications/useNotifications';
import { executeAndShowError, FormField, FormRootError } from '../utils/formUtils';

const passwordResetSchema = zod.object({
  currentPassword: zod.string().nonempty('Current password is required'),
  newPassword: passwordSchema,
  confirmedNewPassword: zod.string(),
}).refine(data => data.newPassword === data.confirmedNewPassword, {
  message: 'Passwords do not match',
  path: ['confirmedNewPassword'],
});

type PasswordResetForm = zod.infer<typeof passwordResetSchema>;

function PasswordResetCard() {
  const auth = useContext(AuthContext);
  const notifications = useNotifications();
  const form = useForm({
    resolver: zodResolver(passwordResetSchema),
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  const onSubmit = form.handleSubmit(async (data: PasswordResetForm) => {
    await executeAndShowError(form, async () => {
      await auth.changePassword(data.currentPassword, data.newPassword);
      form.reset();
      notifications.push({
        type: 'success',
        message: 'Your password was successfully updated.',
      });
    });
  });

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body">
        <form onSubmit={onSubmit}>
          <FormField
            form={form}
            label="Current Password"
            name="currentPassword"
            type="password"
            Icon={LockKeyhole}
          />

          <FormField
            form={form}
            label="New Password"
            name="newPassword"
            type="password"
            Icon={LockKeyhole}
          />

          <FormField
            form={form}
            label="Confirm New Password"
            name="confirmedNewPassword"
            type="password"
            Icon={CheckCircle}
          />

          <FormRootError form={form} />

          <div className="card-actions justify-end mt-6 gap-2">
            <Button
              color="primary"
              type="submit"
              className="btn btn-primary"
              loading={form.formState.isSubmitting}
              Icon={Save}
            >
              Update Password
            </Button>
          </div>

        </form>
      </div>
    </div>
  );
}

export default PasswordResetCard;

import { Settings } from 'lucide-react';

import DeleteAccountCard from '../../components/DeleteAccountCard';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import PasswordResetCard from '../../components/PasswordResetCard';

function VolunteerSettings() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Manage your account security and preferences."
        icon={Settings}
      />
      <div className="space-y-6">
        <PasswordResetCard />
        <DeleteAccountCard
          description="Permanently delete your volunteer account."
          warningText="Your upcoming applications will be withdrawn. You will not be able to sign in or recover this account. Your profile will be hidden from the platform, and you will be signed out immediately."
        />
      </div>
    </PageContainer>
  );
}

export default VolunteerSettings;

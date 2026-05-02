import { Settings } from 'lucide-react';

import DeleteAccountCard from '../../components/DeleteAccountCard';
import PageContainer from '../../components/layout/PageContainer';
import PageHeader from '../../components/layout/PageHeader';
import PasswordResetCard from '../../components/PasswordResetCard';

function OrganizationSettings() {
  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Manage your account's security and preferences."
        icon={Settings}
      />
      <div className="space-y-6">
        <PasswordResetCard />
        <DeleteAccountCard
          description="Permanently delete your organization account."
          warningText="All postings that have not yet started will be permanently deleted. You will not be able to sign in or recover this account. Your organization will be hidden from the platform, and you will be signed out immediately."
        />
      </div>
    </PageContainer>
  );
}

export default OrganizationSettings;

import PageHeader from '../../components/PageHeader';
import PasswordResetCard from '../../components/PasswordResetCard';

function OrganizationSettings() {
  return (
    <div className="grow bg-base-200">
      <div className="p-6 md:container mx-auto">
        <PageHeader
          title="Change Password"
          subtitle="Update your credentials to maintain account security."
        />

        <div className="max-w-xl mx-auto">
          <PasswordResetCard />
        </div>
      </div>
    </div>
  );
}

export default OrganizationSettings;

import { Building2 } from 'lucide-react';

import { SERVER_BASE_URL } from '../utils/requestServer';

interface OrganizationProfilePictureProps {
  organizationName: string;
  organizationId: number;
  logoPath?: string | null;
  size?: number;
  className?: string;
}

function getOrganizationInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'O';

  if (parts.length === 1) {
    const trimmed = parts[0].toUpperCase();
    return trimmed.length > 1 ? trimmed.slice(0, 2) : trimmed;
  }

  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return `${first}${last}`.toUpperCase();
}

export default function OrganizationProfilePicture({
  organizationName,
  organizationId,
  logoPath,
  size = 96,
  className = '',
}: OrganizationProfilePictureProps) {
  const initials = getOrganizationInitials(organizationName);
  const isPng = logoPath?.toLowerCase().endsWith('.png');

  if (logoPath) {
    return (
      <div
        className={`shrink-0 aspect-square rounded-full overflow-hidden ring-1 ring-base-300 flex items-center justify-center ${className}`}
        style={{ width: size, height: size, backgroundColor: isPng ? 'white' : undefined }}
      >
        <img
          src={`${SERVER_BASE_URL}/organization/${organizationId}/logo`}
          alt={`${organizationName} logo`}
          className="h-full w-full object-contain"
        />
      </div>
    );
  }

  const fontSize = Math.max(12, Math.round(size * 0.4));

  return (
    <div
      className={`shrink-0 aspect-square rounded-full overflow-hidden ring-1 ring-base-300 flex items-center justify-center bg-primary text-primary-content ${className}`}
      style={{ width: size, height: size }}
    >
      {initials
        ? (
            <span
              style={{ fontSize, lineHeight: 1 }}
            >
              {initials}
            </span>
          )
        : (
            <Building2 size={size * 0.45} className="text-primary-content" />
          )}
    </div>
  );
}

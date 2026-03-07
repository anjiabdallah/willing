import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  defaultBackTo?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
  badge?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  showBack = false,
  defaultBackTo,
  actions,
  icon: Icon,
  badge,
}: PageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const onBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
      return;
    }

    if (defaultBackTo) {
      navigate(defaultBackTo);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-6 bg-base-200 -mx-6 px-6 py-4">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={onBack}
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex gap-4">
          {Icon && <Icon className="text-primary mt-0.5" size={32} />}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-3xl font-extrabold tracking-tight">{title}</h3>
              {badge && badge}
            </div>
            {subtitle && (
              <p className="opacity-70 mt-1">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div className="flex gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

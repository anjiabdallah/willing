import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import Card from '../Card';
import IconButton from '../IconButton';

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
    const backTo = typeof location.state === 'object'
      && location.state !== null
      && 'backTo' in location.state
      ? (location.state as { backTo?: string }).backTo
      : undefined;

    if (backTo) {
      navigate(backTo);
      return;
    }

    if (location.key !== 'default') {
      navigate(-1);
      return;
    }

    if (defaultBackTo) {
      navigate(defaultBackTo);
    }
  };

  return (
    <Card>
      <div className="flex items-center justify-between gap-4 md:flex-nowrap flex-wrap">
        <div className="flex items-center gap-3">
          {showBack && (
            <IconButton
              onClick={onBack}
              Icon={ArrowLeft}
            />
          )}
          <div className="flex gap-4">
            {Icon && <Icon className="text-primary mt-0.5 shrink-0" size={32} />}
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
    </Card>
  );
}

import {
  AlertCircle,
  BadgeCheck,
  Bell,
  CheckCircle2,
  CircleHelp,
  Info,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { Children } from 'react';

import type { LucideIcon } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';

type AlertColor = 'primary' | 'secondary' | 'accent' | 'neutral' | 'info' | 'success' | 'warning' | 'error';
type AlertStyle = 'normal' | 'soft' | 'outline';

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, 'style'> & {
  color?: AlertColor;
  icon?: LucideIcon;
  style?: AlertStyle;
  children: ReactNode;
};

const defaultIconsByColor: Record<AlertColor, LucideIcon> = {
  primary: Sparkles,
  secondary: Bell,
  accent: BadgeCheck,
  neutral: CircleHelp,
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
};

function Alert({ color, icon: Icon, style = 'soft', role = 'alert', children, className, ...props }: AlertProps) {
  const colorClassName = color ? `alert-${color}` : '';
  const styleClassName = style === 'soft' ? 'alert-soft' : style === 'outline' ? 'alert-outline' : '';
  const alertClassName = ['alert', 'items-start', 'gap-3', 'shadow-sm', 'text-base', colorClassName, styleClassName, className].filter(Boolean).join(' ');
  const ResolvedIcon = Icon ?? (color ? defaultIconsByColor[color] : ShieldAlert);
  const renderedChildren = Children
    .toArray(children)
    .filter(child => !(typeof child === 'string' && child.trim() === ''))
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') {
        return <p key={`alert-text-${String(child)}`}>{child}</p>;
      }

      return child;
    });

  return (
    <div className={alertClassName} role={role} {...props}>
      {ResolvedIcon && <ResolvedIcon size={20} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1 space-y-1">
        {renderedChildren}
      </div>
    </div>
  );
}

export default Alert;

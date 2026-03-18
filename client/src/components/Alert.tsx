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

function Alert({ color, icon: Icon, style = 'soft', role = 'alert', children, className, ...props }: AlertProps) {
  const colorClassName = color ? `alert-${color}` : '';
  const styleClassName = style === 'soft' ? 'alert-soft' : style === 'outline' ? 'alert-outline' : '';
  const alertClassName = ['alert', 'shadow-sm', 'text-base', colorClassName, styleClassName, className].filter(Boolean).join(' ');
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
      {Icon && <Icon size={20} />}
      {renderedChildren}
    </div>
  );
}

export default Alert;

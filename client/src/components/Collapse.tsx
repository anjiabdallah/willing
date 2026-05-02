import type { ReactNode } from 'react';

type CollapseProps = {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  titleClassName?: string;
  contentClassName?: string;
  actionClassName?: string;
  defaultOpen?: boolean;
  withArrow?: boolean;
};

function Collapse({
  title,
  action,
  children,
  className = '',
  titleClassName = '',
  contentClassName = '',
  actionClassName = '',
  defaultOpen = false,
  withArrow = true,
}: CollapseProps) {
  const rootClassName = [
    'collapse',
    withArrow ? 'collapse-arrow' : '',
    'border',
    'border-base-300',
    'bg-base-100',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={rootClassName}>
      <input type="checkbox" defaultChecked={defaultOpen} />
      <div className={['collapse-title', titleClassName].filter(Boolean).join(' ')}>
        <div className="min-w-0 flex-1">{title}</div>
        {action && (
          <div
            className={['hidden sm:flex items-center gap-2 pointer-events-auto', actionClassName].filter(Boolean).join(' ')}
            onClick={event => event.stopPropagation()}
          >
            {action}
          </div>
        )}
      </div>
      <div className={['collapse-content', contentClassName].filter(Boolean).join(' ')}>
        {action && (
          <div
            className={['mb-4 flex sm:hidden items-center gap-2', actionClassName].filter(Boolean).join(' ')}
            onClick={event => event.stopPropagation()}
          >
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export default Collapse;

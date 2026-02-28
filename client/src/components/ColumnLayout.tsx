import type { ReactNode } from 'react';

interface ColumnLayoutProps {
  sidebar: ReactNode;
  children: ReactNode;
  stickySidebar?: boolean;
}

export default function ColumnLayout({ sidebar, children, stickySidebar = false }: ColumnLayoutProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className={`space-y-6 ${stickySidebar ? 'lg:sticky lg:top-24' : ''}`}>
          {sidebar}
        </div>
      </div>
      <div className="lg:col-span-2 space-y-6">
        {children}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';

function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="grow bg-base-200 animate-fade-in-up">
      <div className="sm:p-6 p-2 md:container mx-auto flex flex-col gap-6">
        { children }
      </div>
    </div>
  );
}

export default PageContainer;

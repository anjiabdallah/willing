// Tailwind safelist
// bg-primary/10
// text-primary
// bg-secondary/10
// text-secondary
// bg-success/10
// text-success
// bg-error/10
// text-error
// bg-warning/10
// text-warning
// bg-info/10
// text-info
// bg-accent/10
// text-accent
import { type LucideIcon } from 'lucide-react';

import Card from './Card';

type StatColor = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'accent';

interface StatCardProps {
  text: string;
  content: React.ReactNode;
  icon: LucideIcon;
  color?: StatColor;
}

export default function StatCard({ text, content, icon: Icon, color = 'primary' }: StatCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm opacity-70">{text}</p>
          <p className="text-2xl font-bold mt-1">{content}</p>
        </div>
        <div className={`rounded-full bg-${color}/10 p-2 text-${color}`}>
          <Icon size={18} />
        </div>
      </div>
    </Card>
  );
}

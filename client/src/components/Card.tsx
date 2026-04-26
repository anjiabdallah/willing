import { ExternalLink, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import type { ReactNode } from 'react';

// Tailwind safelists
// text-primary
// text-secondary
// text-accent
// text-neutral
// text-success
// text-error
// text-warning
// text-info

interface CardProps {
  children?: ReactNode;
  title?: string;
  description?: string;
  color?: 'primary' | 'secondary' | 'accent' | 'neutral' | 'success' | 'error' | 'warning' | 'info';
  coloredText?: boolean;
  Icon?: LucideIcon;
  left?: ReactNode;
  right?: ReactNode;
  link?: string;
  padding?: boolean;
  fillHeight?: boolean;
  className?: string;
}

function Card({
  children,
  title,
  description,
  color = 'primary',
  coloredText = false,
  Icon,
  left,
  right,
  link,
  padding = true,
  fillHeight = false,
  className = '',
}: CardProps) {
  return (

    <div className={`card ${fillHeight ? 'h-full fill-height' : ''} flex flex-col bg-base-100 shadow-md border border-base-300 ${className}`.trim()}>
      <div className={`card-body ${fillHeight ? 'flex-1' : ''} flex flex-col ${padding ? 'sm:p-6 p-4' : 'p-0'}`}>
        {title && (
          <div className={`flex items-center gap-2 ${description ? '' : (children ? 'mb-3' : 'mb-0')}`}>
            { left }
            <h5 className={`font-bold text-lg inline-flex items-center gap-2 ${coloredText ? `text-${color}` : ''}`}>
              {Icon && <Icon size={17} className={`text-${color} shrink-0`} />}
              {link
                ? (
                    <Link
                      to={link}
                      className={`inline-flex items-center gap-2 text-${color} hover:underline`}
                    >
                      <span className="inline-flex items-center gap-2">
                        {title}
                        <ExternalLink size={14} className="opacity-60 hover:opacity-100 transition-opacity shrink-0" />
                      </span>
                    </Link>
                  )
                : title}
            </h5>
            <span className="flex-1"></span>
            { right }
          </div>
        )}
        { description && (
          <p className={`text-sm opacity-70 ${children ? 'mb-3' : 'mb-1'}`}>
            {description}
          </p>
        ) }
        { children }
      </div>
    </div>
  );
};

export default Card;

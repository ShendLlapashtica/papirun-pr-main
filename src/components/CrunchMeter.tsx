import { cn } from '@/lib/utils';

interface CrunchMeterProps {
  level: number;
  size?: 'sm' | 'md';
}

const CrunchMeter = ({ level, size = 'sm' }: CrunchMeterProps) => {
  const sizeClasses = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={cn(
            sizeClasses,
            'transition-all duration-200',
            i <= level ? 'text-golden' : 'text-muted/30'
          )}
          fill="currentColor"
        >
          {/* Cornflake shape */}
          <path d="M12 2C7.5 2 4 5.5 4 10c0 3.5 2 6.5 5 8l3 4 3-4c3-1.5 5-4.5 5-8 0-4.5-3.5-8-8-8zm0 12c-2.2 0-4-1.8-4-4s1.8-4 4-4 4 1.8 4 4-1.8 4-4 4z" />
        </svg>
      ))}
    </div>
  );
};

export default CrunchMeter;

import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  reviewCount?: number;
  size?: 'sm' | 'md';
  showCount?: boolean;
}

const StarRating = ({ rating, reviewCount, size = 'sm', showCount = true }: StarRatingProps) => {
  const sizeClasses = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  
  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              sizeClasses,
              'transition-colors',
              i <= Math.floor(rating)
                ? 'fill-golden text-golden'
                : i - 0.5 <= rating
                ? 'fill-golden/50 text-golden'
                : 'fill-muted/20 text-muted/20'
            )}
          />
        ))}
      </div>
      {showCount && reviewCount !== undefined && (
        <span className="text-xs text-muted-foreground">({reviewCount})</span>
      )}
    </div>
  );
};

export default StarRating;

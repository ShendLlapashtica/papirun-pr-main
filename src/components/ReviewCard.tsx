import { Star, Camera } from 'lucide-react';
import type { Review } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { getOptimizedImage } from '@/lib/utils';


interface ReviewCardProps {
  review: Review;
}

const ReviewCard = ({ review }: ReviewCardProps) => {
  const { language } = useLanguage();

  return (
    <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-card">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-base sm:text-lg font-semibold text-primary">
            {review.customerName.charAt(0)}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm sm:text-base truncate">{review.customerName}</h4>
              {review.subtitle && (
                <p className="text-[10px] sm:text-xs text-muted-foreground">{review.subtitle[language]}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{review.date[language]}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`w-3 h-3 ${
                    i < review.rating
                      ? 'fill-golden text-golden'
                      : 'fill-muted text-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{review.dineType[language]}</span>
          </div>
        </div>
      </div>
      <p className="mt-3 sm:mt-4 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        {review.comment[language]}
      </p>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs font-medium text-primary">Food: {review.rating}/5</span>
      </div>
      {review.photos && review.photos.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {review.photos.map((photo, idx) => (
            <img
              key={idx}
              src={getOptimizedImage(photo)}
              alt={`Review photo ${idx + 1}`}
              className="w-[140px] sm:w-[180px] h-[100px] sm:h-[130px] rounded-xl object-contain mix-blend-screen bg-white shrink-0"
            />

          ))}
        </div>
      )}
      {review.photo && !review.photos && (
        <div className="mt-3">
          <img
            src={getOptimizedImage(review.photo)}
            alt="Review photo"
            className="w-full max-w-[200px] h-auto rounded-xl object-contain mix-blend-screen bg-white"
          />

        </div>
      )}
      {review.photoCount && !review.photo && (
        <div className="mt-3 sm:mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Camera className="w-3.5 h-3.5" />
          <span>{review.photoCount} foto</span>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;

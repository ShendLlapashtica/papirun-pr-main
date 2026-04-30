import { Search, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

const SearchBar = ({ value, onChange }: SearchBarProps) => {
  const { t } = useLanguage();

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
      <input
        type="text"
        placeholder={t.hero.searchPlaceholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="search-input w-full pl-10 sm:pl-14 pr-10 sm:pr-12 py-3 sm:py-4 text-sm sm:text-base"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted transition-colors"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};

export default SearchBar;

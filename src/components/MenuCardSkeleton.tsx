const MenuCardSkeleton = () => (
  <div className="menu-card bg-white flex flex-col animate-pulse">
    <div className="h-40 sm:h-48 bg-muted" />
    <div className="p-4 sm:p-5 flex flex-col flex-1">
      <div className="h-5 bg-muted rounded w-3/4" />
      <div className="mt-2 h-3 bg-muted rounded w-full" />
      <div className="mt-1 h-3 bg-muted rounded w-2/3" />
      <div className="flex items-center justify-between pt-2 mt-auto">
        <div className="h-6 w-14 bg-muted rounded" />
        <div className="h-9 w-9 bg-muted rounded-full" />
      </div>
    </div>
  </div>
);

export default MenuCardSkeleton;

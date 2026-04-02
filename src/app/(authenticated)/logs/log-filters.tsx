'use client';

import { clsx } from 'clsx';

const filters = [
  { label: 'All', value: 'ALL' },
  { label: 'Sent', value: 'SENT' },
  { label: 'Failed', value: 'FAILED' },
  { label: 'Queued', value: 'QUEUED' },
  { label: 'Rate Limited', value: 'RATE_LIMITED' },
];

interface LogFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export default function LogFilters({ activeFilter, onFilterChange }: LogFiltersProps) {
  return (
    <div className="flex items-center gap-1 mb-6 p-1 bg-surface-100 rounded-xl w-fit">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={clsx(
            'px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            activeFilter === filter.value
              ? 'bg-white text-surface-900 shadow-sm'
              : 'text-surface-500 hover:text-surface-700'
          )}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

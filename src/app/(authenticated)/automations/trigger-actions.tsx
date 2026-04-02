'use client';

import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pause, Play, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface TriggerActionsProps {
  triggerId: string;
  isActive: boolean;
  onUpdate: () => void;
}

export default function TriggerActions({ triggerId, isActive, onUpdate }: TriggerActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/triggers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: triggerId, isActive: !isActive }),
      });
      if (!res.ok) throw new Error('Failed to toggle trigger');
      toast.success(isActive ? 'Trigger paused' : 'Trigger activated');
      onUpdate();
    } catch {
      toast.error('Failed to update trigger');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this trigger?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/triggers?id=${triggerId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete trigger');
      toast.success('Trigger deleted');
      onUpdate();
    } catch {
      toast.error('Failed to delete trigger');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="btn-icon"
        disabled={loading}
        id={`trigger-actions-${triggerId}`}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl border border-surface-200 shadow-elevated z-10 py-1 animate-scale-in">
          <button
            onClick={handleToggle}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 transition-colors"
            disabled={loading}
          >
            {isActive ? (
              <>
                <Pause className="w-4 h-4 text-amber-500" />
                Pause Trigger
              </>
            ) : (
              <>
                <Play className="w-4 h-4 text-emerald-500" />
                Activate Trigger
              </>
            )}
          </button>
          <div className="border-t border-surface-100 my-1" />
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            disabled={loading}
          >
            <Trash2 className="w-4 h-4" />
            Delete Trigger
          </button>
        </div>
      )}
    </div>
  );
}

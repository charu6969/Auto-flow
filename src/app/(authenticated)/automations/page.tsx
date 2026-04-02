'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Zap,
  MoreHorizontal,
  Hash,
  MessageSquare,
  Image,
  TrendingUp,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
} from 'recharts';
import TriggerActions from './trigger-actions';

interface Trigger {
  id: string;
  keyword: string;
  responseMessage: string;
  isActive: boolean;
  matchCount: number;
  mediaId: string | null;
  createdAt: string;
  _count: { dmLogs: number };
}

interface TriggerDailyStats {
  date: string;
  matches: number;
  sent: number;
  failed: number;
}

interface TriggerStats {
  totals: {
    matches: number;
    sent: number;
    failed: number;
    sentRate: number;
    failRate: number;
  };
  daily: TriggerDailyStats[];
}

export default function AutomationsPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [stats, setStats] = useState<Record<string, TriggerStats>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    try {
      const res = await fetch('/api/triggers');
      const data = await res.json();
      setTriggers(data.triggers || []);

      // Fetch stats for each trigger (Feature #7)
      const statsMap: Record<string, TriggerStats> = {};
      for (const trigger of data.triggers || []) {
        try {
          const statsRes = await fetch(`/api/triggers/${trigger.id}/stats`);
          const statsData = await statsRes.json();
          statsMap[trigger.id] = statsData;
        } catch {
          // Silently fail for individual stats
        }
      }
      setStats(statsMap);
    } catch (err) {
      console.error('Failed to fetch triggers:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton w-48 h-8 mb-2" />
          <div className="skeleton w-72 h-4" />
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Automations</h1>
          <p className="page-subtitle">
            {triggers.length} trigger{triggers.length !== 1 ? 's' : ''} configured
          </p>
        </div>
        <Link href="/automations/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          New Trigger
        </Link>
      </div>

      {/* Trigger Cards */}
      {triggers.length === 0 ? (
        <div className="empty-state">
          <div className="w-20 h-20 rounded-2xl bg-brand-50 flex items-center justify-center mb-4">
            <Zap className="w-10 h-10 text-brand-400" />
          </div>
          <h3 className="empty-state-title">No triggers yet</h3>
          <p className="empty-state-text mb-6">
            Create your first trigger to start auto-replying to Instagram comments with DMs.
          </p>
          <Link href="/automations/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Create First Trigger
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {triggers.map((trigger) => {
            const triggerStats = stats[trigger.id];
            return (
              <div key={trigger.id} className="card-hover p-5">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: Trigger Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                          <Hash className="w-4 h-4 text-brand-600" />
                        </div>
                        <span className="text-lg font-bold text-surface-900">
                          {trigger.keyword}
                        </span>
                      </div>
                      <span
                        className={
                          trigger.isActive ? 'badge-success' : 'badge-neutral'
                        }
                      >
                        {trigger.isActive ? 'Active' : 'Paused'}
                      </span>
                      {trigger.mediaId && (
                        <span className="badge-info">
                          <Image className="w-3 h-3" />
                          Specific Post
                        </span>
                      )}
                    </div>

                    <div className="flex items-start gap-2 mb-3">
                      <MessageSquare className="w-4 h-4 text-surface-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-surface-500 line-clamp-2">
                        {trigger.responseMessage}
                      </p>
                    </div>

                    {/* Stats Row (Feature #7) */}
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-surface-400" />
                        <span className="text-sm font-semibold text-surface-700">
                          {trigger.matchCount}
                        </span>
                        <span className="text-xs text-surface-400">matches</span>
                      </div>
                      {triggerStats && (
                        <>
                          <div className="text-xs">
                            <span className="font-semibold text-emerald-600">
                              {triggerStats.totals.sentRate}%
                            </span>
                            <span className="text-surface-400 ml-1">sent</span>
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold text-red-500">
                              {triggerStats.totals.failRate}%
                            </span>
                            <span className="text-surface-400 ml-1">failed</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Sparkline + Actions */}
                  <div className="flex items-center gap-4">
                    {/* Mini Sparkline (Feature #7) */}
                    {triggerStats && (
                      <div className="w-28 h-12">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={triggerStats.daily}>
                            <defs>
                              <linearGradient id={`spark-${trigger.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotone"
                              dataKey="matches"
                              stroke="#4f46e5"
                              strokeWidth={1.5}
                              fill={`url(#spark-${trigger.id})`}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <TriggerActions
                      triggerId={trigger.id}
                      isActive={trigger.isActive}
                      onUpdate={fetchTriggers}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

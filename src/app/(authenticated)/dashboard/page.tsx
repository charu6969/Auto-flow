'use client';

import { useEffect, useState } from 'react';
import {
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  TrendingUp,
  ArrowUpRight,
  MessageSquare,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { clsx } from 'clsx';

interface Stats {
  totalSent: number;
  totalFailed: number;
  totalQueued: number;
  last24h: number;
  activeTriggers: number;
  successRate: number;
}

interface DailyData {
  date: string;
  sent: number;
  failed: number;
  total: number;
}

interface RecentLog {
  id: string;
  commenterUsername: string;
  commentText: string;
  status: string;
  createdAt: string;
  trigger?: { keyword: string };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/analytics');
      const data = await res.json();
      setStats(data.stats);
      setDailyData(
        data.dailyBreakdown.map((d: DailyData) => ({
          ...d,
          date: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
        }))
      );
      setRecentActivity(data.recentActivity);
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = stats
    ? [
        {
          label: 'DMs Sent',
          value: stats.totalSent.toLocaleString(),
          icon: Send,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50',
          border: 'border-emerald-100',
        },
        {
          label: 'Failed',
          value: stats.totalFailed.toLocaleString(),
          icon: XCircle,
          color: 'text-red-500',
          bg: 'bg-red-50',
          border: 'border-red-100',
        },
        {
          label: 'In Queue',
          value: stats.totalQueued.toLocaleString(),
          icon: Clock,
          color: 'text-amber-500',
          bg: 'bg-amber-50',
          border: 'border-amber-100',
        },
        {
          label: 'Last 24h',
          value: stats.last24h.toLocaleString(),
          icon: Activity,
          color: 'text-brand-600',
          bg: 'bg-brand-50',
          border: 'border-brand-100',
        },
        {
          label: 'Active Triggers',
          value: stats.activeTriggers.toLocaleString(),
          icon: Zap,
          color: 'text-violet-600',
          bg: 'bg-violet-50',
          border: 'border-violet-100',
        },
        {
          label: 'Success Rate',
          value: `${stats.successRate}%`,
          icon: TrendingUp,
          color: 'text-teal-600',
          bg: 'bg-teal-50',
          border: 'border-teal-100',
        },
      ]
    : [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="badge-success"><CheckCircle2 className="w-3 h-3" /> Sent</span>;
      case 'FAILED':
        return <span className="badge-danger"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'QUEUED':
        return <span className="badge-warning"><Clock className="w-3 h-3" /> Queued</span>;
      case 'RATE_LIMITED':
        return <span className="badge-info"><Clock className="w-3 h-3" /> Rate Limited</span>;
      default:
        return <span className="badge-neutral">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div className="skeleton w-48 h-8 mb-2" />
          <div className="skeleton w-72 h-4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
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
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of your DM automation performance</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="live-dot" />
          <span className="text-xs font-medium text-surface-500">Live</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {statCards.map((card, i) => (
          <div
            key={card.label}
            className={clsx('stat-card border', card.border)}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className="flex items-center justify-between">
              <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', card.bg)}>
                <card.icon className={clsx('w-5 h-5', card.color)} />
              </div>
              <ArrowUpRight className="w-4 h-4 text-surface-300" />
            </div>
            <div className="mt-3">
              <p className="stat-value">{card.value}</p>
              <p className="stat-label">{card.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Chart + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-semibold text-surface-900">7-Day Activity</h3>
              <p className="text-xs text-surface-400 mt-0.5">DMs sent over the last week</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-brand-500" />
                <span className="text-surface-500">Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-1 rounded-full bg-red-400" />
                <span className="text-surface-500">Failed</span>
              </div>
            </div>
          </div>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="sentGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="failedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                    fontSize: '13px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sent"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#sentGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  fill="url(#failedGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-surface-900">Recent Activity</h3>
            <MessageSquare className="w-4 h-4 text-surface-400" />
          </div>
          <div className="space-y-3">
            {recentActivity.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-10 h-10 text-surface-300 mx-auto mb-2" />
                <p className="text-sm text-surface-400">No activity yet</p>
              </div>
            ) : (
              recentActivity.slice(0, 8).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-surface-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center flex-shrink-0 text-xs font-bold text-surface-600">
                    {(log.commenterUsername || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">
                      @{log.commenterUsername || 'unknown'}
                    </p>
                    <p className="text-xs text-surface-400 truncate mt-0.5">
                      {log.trigger?.keyword ? `Triggered: ${log.trigger.keyword}` : log.commentText}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

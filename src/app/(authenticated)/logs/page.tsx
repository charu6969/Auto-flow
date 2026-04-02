'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Download,
  Trash2,
  RotateCcw,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';
import LogFilters from './log-filters';

interface DmLog {
  id: string;
  commentId: string;
  commentText: string;
  commenterIgId: string;
  commenterUsername: string;
  mediaId: string;
  dmMessageSent: string;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  sentAt: string | null;
  isTest: boolean;
  createdAt: string;
  trigger?: { keyword: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<DmLog[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchLogs = useCallback(async (page = 1, status = 'ALL') => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'ALL') params.set('status', status);

      const res = await fetch(`/api/logs?${params}`);
      const data = await res.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchLogs(1, activeFilter);
  }, [activeFilter, fetchLogs]);

  // SSE connection (Feature #5)
  useEffect(() => {
    const es = new EventSource('/api/logs/stream');
    eventSourceRef.current = es;

    es.addEventListener('connected', () => {
      setSseConnected(true);
    });

    es.addEventListener('new-log', (event) => {
      const newLog = JSON.parse(event.data) as DmLog;
      setLogs((prev) => {
        // Avoid duplicates
        if (prev.some(l => l.id === newLog.id)) return prev;
        return [newLog, ...prev].slice(0, 20);
      });
    });

    es.addEventListener('heartbeat', () => {
      setSseConnected(true);
    });

    es.onerror = () => {
      setSseConnected(false);
    };

    return () => {
      es.close();
      setSseConnected(false);
    };
  }, []);

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l.id)));
    }
  };

  const handleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk retry (Feature #6)
  const handleBulkRetry = async () => {
    const ids = Array.from(selectedIds);
    setBulkLoading(true);
    try {
      const res = await fetch('/api/logs/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.requeued} log(s) queued for retry`);
        setSelectedIds(new Set());
        fetchLogs(pagination.page, activeFilter);
      } else {
        toast.error(data.error || 'Failed to retry');
      }
    } catch {
      toast.error('Failed to retry logs');
    } finally {
      setBulkLoading(false);
    }
  };

  // Bulk archive (Feature #6)
  const handleBulkArchive = async () => {
    const ids = Array.from(selectedIds);
    if (!confirm(`Archive ${ids.length} log(s)?`)) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/logs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.archived} log(s) archived`);
        setSelectedIds(new Set());
        fetchLogs(pagination.page, activeFilter);
      } else {
        toast.error(data.error || 'Failed to archive');
      }
    } catch {
      toast.error('Failed to archive logs');
    } finally {
      setBulkLoading(false);
    }
  };

  // CSV export (Feature #9)
  const handleExport = () => {
    window.location.href = '/api/logs/export?format=csv';
    toast.success('Downloading CSV export...');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return <span className="badge-success"><CheckCircle2 className="w-3 h-3" /> Sent</span>;
      case 'FAILED':
        return <span className="badge-danger"><XCircle className="w-3 h-3" /> Failed</span>;
      case 'QUEUED':
        return <span className="badge-warning"><Clock className="w-3 h-3" /> Queued</span>;
      case 'SENDING':
        return <span className="badge-info"><RefreshCw className="w-3 h-3 animate-spin" /> Sending</span>;
      case 'RATE_LIMITED':
        return <span className="badge-warning"><AlertCircle className="w-3 h-3" /> Rate Limited</span>;
      default:
        return <span className="badge-neutral">{status}</span>;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title">Activity Logs</h1>
            {sseConnected && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <div className="live-dot" />
                <span className="text-xs font-semibold text-emerald-700">Live</span>
              </div>
            )}
          </div>
          <p className="page-subtitle">
            {pagination.total} total log entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary text-sm" id="export-csv-btn">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button
            onClick={() => fetchLogs(pagination.page, activeFilter)}
            className="btn-icon"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <LogFilters
        activeFilter={activeFilter}
        onFilterChange={(f) => {
          setActiveFilter(f);
          setSelectedIds(new Set());
        }}
      />

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-brand-50 border border-brand-200 rounded-xl animate-slide-up">
          <span className="text-sm font-semibold text-brand-700">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          <button
            onClick={handleBulkRetry}
            className="btn-secondary text-sm py-1.5"
            disabled={bulkLoading}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Failed
          </button>
          <button
            onClick={handleBulkArchive}
            className="btn-danger text-sm py-1.5"
            disabled={bulkLoading}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Archive
          </button>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="table-cell-header w-10">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={selectedIds.size === logs.length && logs.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th className="table-cell-header">User</th>
              <th className="table-cell-header">Comment</th>
              <th className="table-cell-header">Trigger</th>
              <th className="table-cell-header">Status</th>
              <th className="table-cell-header">Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="table-row">
                  <td className="table-cell" colSpan={6}>
                    <div className="skeleton h-5 rounded" />
                  </td>
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td className="table-cell text-center py-12" colSpan={6}>
                  <Search className="w-10 h-10 text-surface-300 mx-auto mb-2" />
                  <p className="text-sm text-surface-400">No logs found</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className={clsx('table-row', selectedIds.has(log.id) && 'bg-brand-50/30')}>
                  <td className="table-cell">
                    <input
                      type="checkbox"
                      className="checkbox"
                      checked={selectedIds.has(log.id)}
                      onChange={() => handleSelect(log.id)}
                    />
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface-100 flex items-center justify-center text-xs font-bold text-surface-600">
                        {(log.commenterUsername || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-surface-800">
                          @{log.commenterUsername || 'unknown'}
                        </p>
                        {log.isTest && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">TEST</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="table-cell">
                    <p className="text-sm text-surface-600 max-w-xs truncate">
                      {log.commentText || '—'}
                    </p>
                  </td>
                  <td className="table-cell">
                    {log.trigger ? (
                      <span className="badge-brand">{log.trigger.keyword}</span>
                    ) : (
                      <span className="text-xs text-surface-400">—</span>
                    )}
                  </td>
                  <td className="table-cell">{getStatusBadge(log.status)}</td>
                  <td className="table-cell">
                    <span className="text-xs text-surface-400">
                      {formatDate(log.createdAt)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-surface-400">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => fetchLogs(pagination.page - 1, activeFilter)}
              className="btn-icon"
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => fetchLogs(pagination.page + 1, activeFilter)}
              className="btn-icon"
              disabled={pagination.page >= pagination.totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

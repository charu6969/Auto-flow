'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FlaskConical,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Send,
  Loader2,
} from 'lucide-react';
import { clsx } from 'clsx';

interface Trigger {
  id: string;
  keyword: string;
  responseMessage: string;
  isActive: boolean;
}

interface SimulationResult {
  matched: boolean;
  message: string;
  trigger?: {
    keyword: string;
    responseMessage: string;
  };
  testedAgainst?: string[];
}

export default function TestTriggerPage() {
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [selectedTriggerId, setSelectedTriggerId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingTriggers, setFetchingTriggers] = useState(true);

  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    try {
      const res = await fetch('/api/triggers');
      const data = await res.json();
      setTriggers(data.triggers || []);
    } catch (err) {
      console.error('Failed to fetch triggers:', err);
    } finally {
      setFetchingTriggers(false);
    }
  };

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/test/simulate-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          triggerId: selectedTriggerId || undefined,
          commentText: commentText.trim(),
        }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        matched: false,
        message: 'Failed to run simulation. Check your connection.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Link>
        <h1 className="page-title">Test Trigger</h1>
        <p className="page-subtitle">
          Simulate a comment to test your automation pipeline without sending a real DM.
        </p>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={handleSimulate} className="space-y-6">
          {/* Select Trigger */}
          <div className="card p-6">
            <label className="label">Select Trigger (optional)</label>
            <select
              value={selectedTriggerId}
              onChange={(e) => setSelectedTriggerId(e.target.value)}
              className="select"
              id="test-trigger-select"
            >
              <option value="">All active triggers</option>
              {triggers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.keyword} — {t.isActive ? 'Active' : 'Paused'}
                </option>
              ))}
            </select>
            <p className="input-helper">
              Leave empty to test against all active triggers
            </p>
          </div>

          {/* Comment Text */}
          <div className="card p-6">
            <label className="label">Simulated Comment</label>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Type a comment as if someone posted it on your Instagram post..."
              className="textarea"
              rows={3}
              required
              id="test-comment-input"
            />
            <p className="input-helper">
              This simulates what a user would comment on your post
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={loading || !commentText.trim()}
            id="test-simulate-btn"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <FlaskConical className="w-4 h-4" />
                Run Simulation
              </>
            )}
          </button>
        </form>

        {/* Result */}
        {result && (
          <div className="mt-6 animate-slide-up">
            <div
              className={clsx(
                'card p-6 border-2',
                result.matched
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-red-200 bg-red-50/30'
              )}
            >
              <div className="flex items-start gap-3">
                {result.matched ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                )}

                <div className="flex-1">
                  <h3
                    className={clsx(
                      'text-base font-semibold',
                      result.matched ? 'text-emerald-800' : 'text-red-800'
                    )}
                  >
                    {result.matched ? 'Match Found!' : 'No Match'}
                  </h3>
                  <p className="text-sm text-surface-600 mt-1">{result.message}</p>

                  {result.trigger && (
                    <div className="mt-4 space-y-3">
                      <div>
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">
                          Matched Trigger
                        </p>
                        <span className="badge-brand text-base px-3 py-1">
                          {result.trigger.keyword}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">
                          DM That Would Be Sent
                        </p>
                        <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-surface-200">
                          <Send className="w-4 h-4 text-brand-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-surface-700">{result.trigger.responseMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {result.testedAgainst && result.testedAgainst.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">
                        Tested Against
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {result.testedAgainst.map((kw) => (
                          <span key={kw} className="badge-neutral">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

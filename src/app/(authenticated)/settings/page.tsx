'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Instagram,
  Shield,
  ShieldCheck,
  ShieldX,
  Clock,
  Unplug,
  Link2,
  Gauge,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { clsx } from 'clsx';

interface Account {
  id: string;
  igUserId: string;
  igUsername: string;
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rateUsage, setRateUsage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Failed to fetch account data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm('Are you sure you want to disconnect this account?')) return;
    setDisconnecting(true);
    try {
      const res = await fetch('/api/triggers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: accountId, isActive: false }),
      });
      toast.success('Account disconnected');
      fetchData();
    } catch {
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleReconnect = () => {
    window.location.href = '/api/auth/instagram';
  };

  const getTokenStatus = (expiresAt: string | null) => {
    if (!expiresAt) return { label: 'Unknown', color: 'text-surface-400', bg: 'bg-surface-50' };
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft <= 0) return { label: 'Expired', color: 'text-red-600', bg: 'bg-red-50', icon: ShieldX };
    if (daysLeft <= 7) return { label: `Expires in ${daysLeft} day(s)`, color: 'text-amber-600', bg: 'bg-amber-50', icon: Shield };
    return { label: `Valid for ${daysLeft} days`, color: 'text-emerald-600', bg: 'bg-emerald-50', icon: ShieldCheck };
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="skeleton w-48 h-8 mb-2" />
        <div className="skeleton w-72 h-4 mb-8" />
        <div className="skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="page-container page-enter">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your connected Instagram account and preferences</p>
      </div>

      <div className="max-w-3xl space-y-6">
        {/* Connected Account */}
        {accounts.map((account) => {
          const tokenStatus = getTokenStatus(account.tokenExpiresAt);
          const TokenIcon = tokenStatus.icon || Shield;

          return (
            <div key={account.id} className="card overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Instagram className="w-5 h-5 text-pink-500" />
                  <h3 className="text-base font-semibold text-surface-900">Connected Account</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Info */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Username</p>
                      <p className="text-lg font-bold text-surface-900">@{account.igUsername}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Status</p>
                      <span className={account.isActive ? 'badge-success' : 'badge-danger'}>
                        {account.isActive ? 'Active' : 'Disconnected'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Connected Since</p>
                      <p className="text-sm text-surface-600">
                        {new Date(account.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Token & Rate Limit */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Access Token</p>
                      <div className={clsx('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg', tokenStatus.bg)}>
                        <TokenIcon className={clsx('w-4 h-4', tokenStatus.color)} />
                        <span className={clsx('text-sm font-medium', tokenStatus.color)}>
                          {tokenStatus.label}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1">Rate Limit</p>
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-surface-400" />
                        <span className="text-sm text-surface-600">
                          {rateUsage !== null ? `${rateUsage}/180 per hour` : '—/180 per hour'}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-surface-100 rounded-full h-2">
                        <div
                          className="bg-brand-500 rounded-full h-2 transition-all duration-500"
                          style={{ width: `${rateUsage ? (rateUsage / 180) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 px-6 py-4 bg-surface-50 border-t border-surface-100">
                {account.isActive ? (
                  <button
                    onClick={() => handleDisconnect(account.id)}
                    className="btn-danger text-sm"
                    disabled={disconnecting}
                  >
                    <Unplug className="w-4 h-4" />
                    Disconnect Account
                  </button>
                ) : (
                  <button
                    onClick={handleReconnect}
                    className="btn-primary text-sm"
                  >
                    <Link2 className="w-4 h-4" />
                    Reconnect Account
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <div className="card p-8 text-center">
            <Instagram className="w-12 h-12 text-surface-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-surface-700 mb-1">No Account Connected</h3>
            <p className="text-sm text-surface-400 mb-4">Connect your Instagram account to start automating DMs.</p>
            <button onClick={handleReconnect} className="btn-primary">
              <Instagram className="w-4 h-4" />
              Connect Instagram
            </button>
          </div>
        )}

        {/* Test Trigger Link */}
        <Link
          href="/settings/test-trigger"
          className="card-interactive p-5 flex items-center justify-between group"
        >
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-surface-900">Test Trigger</p>
              <p className="text-xs text-surface-400">Simulate a comment to test your automation pipeline</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-surface-300 group-hover:text-surface-500 group-hover:translate-x-1 transition-all" />
        </Link>
      </div>
    </div>
  );
}

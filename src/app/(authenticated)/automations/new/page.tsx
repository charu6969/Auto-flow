'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Hash,
  MessageSquare,
  Eye,
  Sparkles,
  Image,
  Globe,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { clsx } from 'clsx';

export default function NewTriggerPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [responseMessage, setResponseMessage] = useState('');
  const [triggerScope, setTriggerScope] = useState<'all' | 'specific'>('all');
  const [mediaId, setMediaId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !responseMessage.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: keyword.trim(),
          responseMessage: responseMessage.trim(),
          mediaId: triggerScope === 'specific' ? mediaId.trim() || null : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trigger');
      }

      toast.success('Trigger created successfully!');
      router.push('/automations');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create trigger');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container page-enter">
      {/* Header */}
      <div className="page-header">
        <Link
          href="/automations"
          className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Automations
        </Link>
        <h1 className="page-title">Create New Trigger</h1>
        <p className="page-subtitle">
          Set up a keyword trigger that auto-replies with a DM when someone comments on your post.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Keyword */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center">
                <Hash className="w-4 h-4 text-brand-600" />
              </div>
              <h3 className="text-sm font-semibold text-surface-900">Trigger Keyword</h3>
            </div>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value.toUpperCase())}
              placeholder="e.g. GUIDE, PRICE, LINK"
              className="input"
              id="trigger-keyword-input"
              required
            />
            <p className="input-helper">
              When someone comments this word, they'll automatically receive your DM.
            </p>
          </div>

          {/* Response Message */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                <MessageSquare className="w-4 h-4 text-violet-600" />
              </div>
              <h3 className="text-sm font-semibold text-surface-900">Auto-Reply Message</h3>
            </div>
            <textarea
              value={responseMessage}
              onChange={(e) => setResponseMessage(e.target.value)}
              placeholder="Hey! 👋 Thanks for your interest. Here's your free guide: https://..."
              className="textarea"
              rows={4}
              id="trigger-response-input"
              required
            />
            <p className="input-helper">{responseMessage.length}/1000 characters</p>
          </div>

          {/* Trigger Scope (Feature #3) */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Image className="w-4 h-4 text-amber-600" />
              </div>
              <h3 className="text-sm font-semibold text-surface-900">Trigger Scope</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                onClick={() => setTriggerScope('all')}
                className={clsx(
                  'flex items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all',
                  triggerScope === 'all'
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                <Globe className={clsx('w-5 h-5', triggerScope === 'all' ? 'text-brand-600' : 'text-surface-400')} />
                <div className="text-left">
                  <p className={clsx('text-sm font-semibold', triggerScope === 'all' ? 'text-brand-700' : 'text-surface-700')}>
                    All Posts
                  </p>
                  <p className="text-xs text-surface-400">Any comment triggers</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setTriggerScope('specific')}
                className={clsx(
                  'flex items-center gap-2.5 p-3.5 rounded-xl border-2 transition-all',
                  triggerScope === 'specific'
                    ? 'border-brand-500 bg-brand-50/50'
                    : 'border-surface-200 hover:border-surface-300'
                )}
              >
                <Image className={clsx('w-5 h-5', triggerScope === 'specific' ? 'text-brand-600' : 'text-surface-400')} />
                <div className="text-left">
                  <p className={clsx('text-sm font-semibold', triggerScope === 'specific' ? 'text-brand-700' : 'text-surface-700')}>
                    Specific Post
                  </p>
                  <p className="text-xs text-surface-400">One post only</p>
                </div>
              </button>
            </div>

            {triggerScope === 'specific' && (
              <div className="animate-slide-up">
                <input
                  type="text"
                  value={mediaId}
                  onChange={(e) => setMediaId(e.target.value)}
                  placeholder="Paste post URL or Media ID"
                  className="input"
                  id="trigger-media-id-input"
                />
                <p className="input-helper">
                  Find the media ID from your post URL or Instagram API
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full py-3"
            disabled={loading}
            id="create-trigger-btn"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Creating...' : 'Create Trigger'}
          </button>
        </form>

        {/* Live Chat Preview */}
        <div className="lg:sticky lg:top-8 h-fit">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-6">
              <Eye className="w-4 h-4 text-surface-400" />
              <h3 className="text-sm font-semibold text-surface-900">Live Preview</h3>
            </div>

            {/* Phone Mockup */}
            <div className="bg-surface-50 rounded-2xl p-4 min-h-[360px]">
              {/* Chat Header */}
              <div className="flex items-center gap-3 pb-4 border-b border-surface-200 mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-white text-sm font-bold">
                  R
                </div>
                <div>
                  <p className="text-sm font-semibold text-surface-900">ReplyBot</p>
                  <p className="text-xs text-surface-400">Instagram Direct</p>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="space-y-3">
                {keyword && (
                  <div className="flex justify-end">
                    <div className="chat-bubble-user">
                      {keyword || 'KEYWORD'}
                    </div>
                  </div>
                )}

                {responseMessage && (
                  <div className="flex justify-start animate-slide-up">
                    <div className="chat-bubble-bot">
                      {responseMessage || 'Your auto-reply message will appear here...'}
                    </div>
                  </div>
                )}

                {!keyword && !responseMessage && (
                  <div className="text-center py-12">
                    <MessageSquare className="w-8 h-8 text-surface-300 mx-auto mb-2" />
                    <p className="text-xs text-surface-400">
                      Start typing to see a preview
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

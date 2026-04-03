import { GRAPH_API_BASE } from '@/lib/constants';
const META_APP_ID = process.env.META_APP_ID!;
const META_APP_SECRET = process.env.META_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface IGPageInfo {
  id: string;
  name: string;
  instagram_business_account?: {
    id: string;
    username: string;
  };
  access_token: string;
}

/**
 * Build the OAuth authorization URL to redirect user to Meta login
 */
export function getOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    scope: 'instagram_basic,instagram_manage_messages,instagram_manage_comments,pages_show_list,pages_manage_metadata,pages_messaging',
    response_type: 'code',
    state: crypto.randomUUID(),
  });
  return `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;
}

/**
 * Exchange authorization code for short-lived access token
 */
export async function exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    code,
  });

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Exchange short-lived token for long-lived token (~60 days)
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: shortLivedToken,
  });

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Refresh an expiring long-lived token (Feature #1)
 */
export async function refreshLongLivedToken(existingToken: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: META_APP_ID,
    client_secret: META_APP_SECRET,
    fb_exchange_token: existingToken,
  });

  const res = await fetch(`${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Get user's Facebook Pages with Instagram Business accounts
 */
export async function getUserPages(accessToken: string): Promise<IGPageInfo[]> {
  const res = await fetch(
    `${GRAPH_API_BASE}/me/accounts?fields=id,name,instagram_business_account{id,username},access_token&access_token=${accessToken}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch pages: ${JSON.stringify(err)}`);
  }
  const data = await res.json();
  return data.data || [];
}

// ─── Graph API Error Parsing ───────────────────────────────────────────

export interface GraphApiError {
  code: number;
  subcode?: number;
  type: string;
  message: string;
  fbtrace_id?: string;
}

export function parseGraphApiError(error: unknown): GraphApiError | null {
  if (!(error instanceof Error)) return null;
  try {
    const match = error.message.match(/DM send failed: (.+)/);
    if (!match) return null;
    const parsed = JSON.parse(match[1]);
    const e = parsed.error || parsed;
    if (typeof e.code !== 'number') return null;
    return {
      code: e.code,
      subcode: e.error_subcode ?? e.subcode,
      type: e.type || 'Unknown',
      message: e.message || error.message,
      fbtrace_id: e.fbtrace_id,
    };
  } catch {
    return null;
  }
}

export function isPrivateReplyError(err: GraphApiError): boolean {
  // Already sent a private reply to this comment
  if (err.code === 10 && err.subcode === 2018278) return true;
  // Comment too old for private reply
  if (err.code === 100 && err.subcode === 2018108) return true;
  // Generic invalid comment for private reply
  if (err.code === 100 && err.message.toLowerCase().includes('comment')) return true;
  return false;
}

export function isPermissionError(err: GraphApiError): boolean {
  // 10 = no permission, 200 = permission denied, 190 = invalid/expired token
  return [10, 200, 190].includes(err.code) && !isPrivateReplyError(err);
}

export function isRateLimitError(err: GraphApiError): boolean {
  // 4 = API too many calls, 32 = rate limit reached
  return err.code === 4 || err.code === 32;
}

// ─── DM Sending ────────────────────────────────────────────────────────

/**
 * Send a Private Reply to a specific comment.
 * Uses POST /me/messages with the Page Access Token.
 */
async function sendPrivateReply(
  message: string,
  accessToken: string,
  commentId: string
): Promise<{ recipient_id: string; message_id: string }> {
  const payload = {
    recipient: { comment_id: commentId },
    message: { text: message },
    access_token: accessToken,
  };

  const res = await fetch(`${GRAPH_API_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`DM send failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Send a standard DM to an Instagram user (requires 24hr messaging window).
 * Uses POST /me/messages with the Page Access Token.
 */
async function sendStandardDM(
  recipientIgId: string,
  message: string,
  accessToken: string
): Promise<{ recipient_id: string; message_id: string }> {
  const payload = {
    recipient: { id: recipientIgId },
    message: { text: message },
    messaging_type: 'RESPONSE',
    access_token: accessToken,
  };

  const res = await fetch(`${GRAPH_API_BASE}/me/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`DM send failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Send a DM to an Instagram user via the Instagram Send API.
 * If commentId is provided, attempts a Private Reply first, then falls back
 * to a standard DM if the Private Reply fails for comment-specific reasons.
 *
 * Uses POST /me/messages with the Page Access Token (NOT /{PAGE_ID}/messages,
 * which is the Facebook Messenger endpoint).
 */
export async function sendInstagramDM(
  _pageId: string,
  recipientIgId: string,
  message: string,
  accessToken: string,
  commentId?: string
): Promise<{ recipient_id: string; message_id: string }> {
  if (commentId) {
    try {
      return await sendPrivateReply(message, accessToken, commentId);
    } catch (error) {
      const graphError = parseGraphApiError(error);
      if (graphError && isPrivateReplyError(graphError)) {
        console.warn(`[instagram] Private Reply failed (code ${graphError.code}, sub ${graphError.subcode}), falling back to standard DM`);
        return await sendStandardDM(recipientIgId, message, accessToken);
      }
      throw error;
    }
  }
  return await sendStandardDM(recipientIgId, message, accessToken);
}

/**
 * Get comment details from the Graph API
 */
export async function getCommentDetails(
  commentId: string,
  accessToken: string
): Promise<{ id: string; text: string; from: { id: string; username: string }; media: { id: string } }> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${commentId}?fields=id,text,from{id,username},media{id}&access_token=${accessToken}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch comment: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Subscribe a Facebook Page to webhooks for feed and messaging events.
 *
 * IMPORTANT: This subscribes to Facebook Page-level webhooks only.
 * Instagram comment webhooks must be configured separately in the
 * Meta App Dashboard: Webhooks product > Instagram object > "comments" field.
 * The callback URL should be: {APP_URL}/api/webhook/instagram
 */
export async function subscribePageToWebhooks(pageId: string, pageAccessToken: string): Promise<void> {
  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscribed_fields: ['feed', 'messages'],
      access_token: pageAccessToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Page subscription failed: ${JSON.stringify(err)}`);
  }
}

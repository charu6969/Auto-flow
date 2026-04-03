import { INSTAGRAM_API_BASE, INSTAGRAM_OAUTH_BASE } from '@/lib/constants';

const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID!;
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  user_id?: string;
}

/**
 * Build the OAuth authorization URL using Instagram Login.
 * Redirects to instagram.com (NOT facebook.com) for authorization.
 */
export function getOAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: `${APP_URL}/api/auth/callback`,
    scope: 'instagram_business_basic,instagram_business_manage_messages,instagram_manage_comments',
    response_type: 'code',
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for short-lived Instagram access token.
 * Uses the Instagram OAuth endpoint (api.instagram.com).
 */
export async function exchangeCodeForToken(code: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: `${APP_URL}/api/auth/callback`,
    code,
  });

  const res = await fetch(`${INSTAGRAM_OAUTH_BASE}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Exchange short-lived token for long-lived Instagram token (~60 days).
 * Uses graph.instagram.com with grant_type ig_exchange_token.
 */
export async function getLongLivedToken(shortLivedToken: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: INSTAGRAM_APP_SECRET,
    access_token: shortLivedToken,
  });

  const res = await fetch(`${INSTAGRAM_API_BASE}/access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Refresh an expiring long-lived Instagram token (Feature #1).
 * Uses graph.instagram.com with grant_type ig_refresh_token.
 */
export async function refreshLongLivedToken(existingToken: string): Promise<OAuthTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'ig_refresh_token',
    access_token: existingToken,
  });

  const res = await fetch(`${INSTAGRAM_API_BASE}/refresh_access_token?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Token refresh failed: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Get the authenticated Instagram user's basic info (id, username).
 * Uses graph.instagram.com/me with the Instagram user access token.
 */
export async function getInstagramUser(
  accessToken: string
): Promise<{ id: string; username: string }> {
  const res = await fetch(
    `${INSTAGRAM_API_BASE}/me?fields=id,username&access_token=${accessToken}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch Instagram user: ${JSON.stringify(err)}`);
  }
  return res.json();
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
 * Uses POST /me/messages on graph.instagram.com with the Instagram user token.
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

  const res = await fetch(`${INSTAGRAM_API_BASE}/me/messages`, {
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
 * Uses POST /me/messages on graph.instagram.com with the Instagram user token.
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

  const res = await fetch(`${INSTAGRAM_API_BASE}/me/messages`, {
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
 * Attempts Private Reply first (if commentId provided), then falls back to
 * standard DM if the Private Reply fails for comment-specific reasons.
 *
 * Uses POST /me/messages on graph.instagram.com with the Instagram user token.
 * Does NOT use graph.facebook.com or require a Facebook Page.
 */
export async function sendInstagramDM(
  _igUserId: string,
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
 * Get comment details from the Instagram Graph API.
 */
export async function getCommentDetails(
  commentId: string,
  accessToken: string
): Promise<{ id: string; text: string; from: { id: string; username: string }; media: { id: string } }> {
  const res = await fetch(
    `${INSTAGRAM_API_BASE}/${commentId}?fields=id,text,from{id,username},media{id}&access_token=${accessToken}`
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to fetch comment: ${JSON.stringify(err)}`);
  }
  return res.json();
}

/**
 * Subscribe the Instagram account to webhook events (comments + messages).
 * Uses graph.instagram.com/me/subscribed_apps with the Instagram user token.
 *
 * NOTE: The webhook callback URL and verify token must also be configured in the
 * Meta App Dashboard under: Use cases > Instagram API > API Setup > Configure webhooks.
 */
export async function subscribeToInstagramWebhooks(accessToken: string): Promise<void> {
  const res = await fetch(`${INSTAGRAM_API_BASE}/me/subscribed_apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscribed_fields: ['comments', 'messages'],
      access_token: accessToken,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Instagram webhook subscription failed: ${JSON.stringify(err)}`);
  }
}

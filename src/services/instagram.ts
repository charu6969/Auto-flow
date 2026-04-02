const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';
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
  return `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
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

/**
 * Send a DM to an Instagram user via the Graph API (using the Facebook Page endpoint).
 * If commentId is provided, it sends a 'Private Reply' to that comment.
 * Otherwise, it attempts a standard DM (requires open 24hr messaging window).
 * 
 * NOTE: Meta requires DMs to be sent via POST /{PAGE_ID}/messages, NOT /{IG_USER_ID}/messages.
 */
export async function sendInstagramDM(
  pageId: string,
  recipientIgId: string,
  message: string,
  accessToken: string,
  commentId?: string
): Promise<{ recipient_id: string; message_id: string }> {
  
  const payload: any = {
    message: { text: message },
    access_token: accessToken,
  };

  // If responding to a comment, Meta REQUIRES using comment_id instead of user id
  if (commentId) {
    payload.recipient = { comment_id: commentId };
  } else {
    payload.recipient = { id: recipientIgId };
  }

  const res = await fetch(`${GRAPH_API_BASE}/${pageId}/messages`, {
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
 * Subscribe a page to webhooks
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

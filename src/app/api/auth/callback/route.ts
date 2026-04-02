import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSession } from '@/lib/session';
import {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserPages,
  subscribePageToWebhooks,
} from '@/services/instagram';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const GRAPH_API_BASE = 'https://graph.facebook.com/v19.0';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('[auth/callback] OAuth error:', error);
    return NextResponse.redirect(`${APP_URL}/login?error=oauth_denied`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}/login?error=no_code`);
  }

  try {
    // 1. Exchange code for short-lived token
    const shortTokenRes = await exchangeCodeForToken(code);
    console.log('[auth/callback] Short-lived token obtained');

    // 2. Get long-lived token
    const longTokenRes = await getLongLivedToken(shortTokenRes.access_token);
    const expiresInSeconds = longTokenRes.expires_in || 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    // 3. Try standard /me/accounts first
    let pages = await getUserPages(longTokenRes.access_token);
    console.log('[auth/callback] Pages from /me/accounts:', JSON.stringify(pages, null, 2));
    let pageWithIG = pages.find((p) => p.instagram_business_account);

    // 4. If /me/accounts returned empty (Facebook Login for Business issue),
    //    extract page ID from token's granular scopes and fetch directly
    if (!pageWithIG) {
      console.log('[auth/callback] /me/accounts empty, trying granular scopes fallback...');

      // Debug token to get granular scopes
      const debugRes = await fetch(
        `${GRAPH_API_BASE}/debug_token?input_token=${shortTokenRes.access_token}&access_token=${shortTokenRes.access_token}`
      );
      const debugData = await debugRes.json();
      console.log('[auth/callback] Token debug:', JSON.stringify(debugData, null, 2));

      // Extract page ID from pages_show_list granular scope
      const granularScopes = debugData?.data?.granular_scopes || [];
      const pagesScope = granularScopes.find(
        (s: any) => s.scope === 'pages_show_list'
      );
      const igBasicScope = granularScopes.find(
        (s: any) => s.scope === 'instagram_basic'
      );

      const pageId = pagesScope?.target_ids?.[0];
      const igUserId = igBasicScope?.target_ids?.[0];

      console.log('[auth/callback] Page ID from scopes:', pageId);
      console.log('[auth/callback] IG User ID from scopes:', igUserId);

      if (pageId) {
        // Fetch the page directly by ID
        const pageRes = await fetch(
          `${GRAPH_API_BASE}/${pageId}?fields=id,name,access_token,instagram_business_account{id,username}&access_token=${longTokenRes.access_token}`
        );
        const pageData = await pageRes.json();
        console.log('[auth/callback] Direct page fetch:', JSON.stringify(pageData, null, 2));

        if (pageData.instagram_business_account) {
          pageWithIG = pageData;
        } else if (igUserId) {
          // If page fetch doesn't return IG account, try fetching IG user directly
          const igRes = await fetch(
            `${GRAPH_API_BASE}/${igUserId}?fields=id,username&access_token=${longTokenRes.access_token}`
          );
          const igData = await igRes.json();
          console.log('[auth/callback] Direct IG fetch:', JSON.stringify(igData, null, 2));

          if (igData.id && igData.username) {
            // Construct the pageWithIG object manually
            pageWithIG = {
              id: pageId,
              name: pageData.name || 'Page',
              access_token: pageData.access_token || longTokenRes.access_token,
              instagram_business_account: {
                id: igData.id,
                username: igData.username,
              },
            };
          }
        }
      }
    }

    if (!pageWithIG || !pageWithIG.instagram_business_account) {
      console.error('[auth/callback] Could not find Instagram Business account after all attempts');
      return NextResponse.redirect(
        `${APP_URL}/login?error=no_ig_business`
      );
    }

    console.log('[auth/callback] Found IG account:', JSON.stringify(pageWithIG.instagram_business_account, null, 2));
    const igAccount = pageWithIG.instagram_business_account;

    // 5. Upsert user
    const user = await prisma.user.upsert({
      where: { email: `${igAccount.username}@instagram.replybot` },
      update: { name: igAccount.username },
      create: {
        email: `${igAccount.username}@instagram.replybot`,
        name: igAccount.username,
      },
    });

    // 6. Upsert Instagram account
    await prisma.instagramAccount.upsert({
      where: { igUserId: igAccount.id },
      update: {
        igUsername: igAccount.username,
        pageId: pageWithIG.id,
        accessToken: pageWithIG.access_token,
        tokenExpiresAt,
        isActive: true,
      },
      create: {
        igUserId: igAccount.id,
        igUsername: igAccount.username,
        pageId: pageWithIG.id,
        accessToken: pageWithIG.access_token,
        tokenExpiresAt,
        isActive: true,
        userId: user.id,
      },
    });

    // 7. Subscribe page to webhooks
    try {
      await subscribePageToWebhooks(pageWithIG.id, pageWithIG.access_token);
    } catch (err) {
      console.warn('[auth/callback] Page subscription warning:', err);
    }

    // 8. Create session
    const account = await prisma.instagramAccount.findUnique({
      where: { igUserId: igAccount.id },
    });

    await createSession({
      userId: user.id,
      email: user.email,
      accountId: account?.id,
    });

    return NextResponse.redirect(`${APP_URL}/dashboard`);
  } catch (error) {
    console.error('[auth/callback] Error:', error);
    return NextResponse.redirect(`${APP_URL}/login?error=auth_failed`);
  }
}

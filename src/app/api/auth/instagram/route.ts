import { NextResponse } from 'next/server';
import { getOAuthUrl } from '@/services/instagram';

export async function GET() {
  const url = getOAuthUrl();
  return NextResponse.redirect(url);
}

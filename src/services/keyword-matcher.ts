import { Trigger } from '@prisma/client';

export interface MatchResult {
  trigger: Trigger;
  matchedKeyword: string;
}

/**
 * Check comment text against a list of active triggers.
 * Uses word-boundary regex for accurate matching.
 * Supports media-specific triggers (Feature #3):
 *   - If trigger.mediaId is null → matches on all posts
 *   - If trigger.mediaId is set → only matches on that specific post
 */
export function findMatchingTrigger(
  commentText: string,
  triggers: Trigger[],
  mediaId?: string
): MatchResult | null {
  const normalizedComment = commentText.toLowerCase().trim();

  for (const trigger of triggers) {
    if (!trigger.isActive) continue;

    // Media-specific check (Feature #3)
    if (trigger.mediaId && trigger.mediaId !== mediaId) {
      continue; // This trigger is scoped to a different post
    }

    const keyword = trigger.keyword.toLowerCase().trim();
    // Word-boundary regex: match the keyword as a standalone word
    const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, 'i');

    if (regex.test(normalizedComment)) {
      return {
        trigger,
        matchedKeyword: trigger.keyword,
      };
    }
  }

  return null;
}

/**
 * Escape special regex characters in keyword
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create a demo user
  const user = await prisma.user.upsert({
    where: { email: 'demo@replybot.io' },
    update: {},
    create: {
      email: 'demo@replybot.io',
      name: 'Demo User',
    },
  });

  console.log(`✅ Created user: ${user.email}`);

  // Create a demo Instagram account
  const account = await prisma.instagramAccount.upsert({
    where: { igUserId: 'demo_ig_123' },
    update: {},
    create: {
      igUserId: 'demo_ig_123',
      igUsername: 'demo_brand',
      pageId: 'demo_page_456',
      accessToken: 'demo_access_token_placeholder',
      tokenExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      isActive: true,
      userId: user.id,
    },
  });

  console.log(`✅ Created Instagram account: @${account.igUsername}`);

  // Create demo triggers
  const triggers = [
    { keyword: 'GUIDE', responseMessage: 'Hey! 👋 Here\'s your free guide: https://example.com/guide' },
    { keyword: 'PRICE', responseMessage: 'Thanks for your interest! Our pricing starts at $29/mo. Check it out: https://example.com/pricing' },
    { keyword: 'INFO', responseMessage: 'Here\'s all the info you need! 📋 https://example.com/info' },
    { keyword: 'LINK', responseMessage: 'Here\'s the link you asked for! 🔗 https://example.com/link' },
  ];

  for (const t of triggers) {
    let trigger = await prisma.trigger.findFirst({
      where: {
        accountId: account.id,
        keyword: t.keyword,
        mediaId: null,
      },
    });

    if (!trigger) {
      trigger = await prisma.trigger.create({
        data: {
          keyword: t.keyword,
          responseMessage: t.responseMessage,
          isActive: true,
          matchCount: Math.floor(Math.random() * 50) + 5,
          accountId: account.id,
        },
      });
    }
    console.log(`✅ Created trigger: "${trigger.keyword}"`);
  }

  // Create demo DM logs
  const statuses: Array<'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED'> = [
    'SENT', 'SENT', 'SENT', 'SENT', 'SENT',
    'FAILED', 'QUEUED', 'SENT', 'RATE_LIMITED', 'SENT',
  ];

  const usernames = [
    'john_designer', 'sarah_photo', 'mike_dev', 'emma_travel',
    'alex_fitness', 'lisa_foodie', 'chris_music', 'anna_art',
    'tom_tech', 'julia_style',
  ];

  const allTriggers = await prisma.trigger.findMany({
    where: { accountId: account.id },
  });

  for (let i = 0; i < 10; i++) {
    const trigger = allTriggers[i % allTriggers.length];
    const status = statuses[i];
    await prisma.dmLog.create({
      data: {
        commentId: `comment_${Date.now()}_${i}`,
        commentText: `I want the ${trigger.keyword}!`,
        commenterIgId: `ig_user_${i}_${Date.now()}`,
        commenterUsername: usernames[i],
        mediaId: `media_${100 + (i % 3)}`,
        dmMessageSent: trigger.responseMessage,
        status,
        errorMessage: status === 'FAILED' ? 'API rate limit exceeded' : null,
        retryCount: status === 'FAILED' ? 3 : 0,
        sentAt: status === 'SENT' ? new Date(Date.now() - i * 3600000) : null,
        accountId: account.id,
        triggerId: trigger.id,
      },
    });
  }

  console.log(`✅ Created 10 demo DM logs`);
  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

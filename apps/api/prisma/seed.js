/* Demo seed: realistic Nigerian savings circles with staggered history.
 * Run: DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
 * Idempotent: wipes the demo accounts first, then recreates them.
 * Log in as any of them via dev-login (googleId is dev:<email>).
 */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient();
const daysAgo = (n, h = 12) => new Date(Date.now() - n * 86400000 - h * 3600000);

const PEOPLE = [
  { email: 'ada@circle.com', name: 'Adaeze Okafor' },
  { email: 'bayo@circle.com', name: 'Bayo Adeyemi' },
  { email: 'chiamaka@circle.com', name: 'Chiamaka Eze' },
  { email: 'emeka@circle.com', name: 'Emeka Obi' },
  { email: 'funmi@circle.com', name: 'Funmi Balogun' },
  { email: 'james@circle.com', name: 'James Cole', password: '12345678' },
  { email: 'jasowills01@gmail.com', name: 'Jason Amadi' },
];

// Leftover demo accounts from earlier seeds (old @example.com family).
const LEGACY = ['ada@circle.com', 'bayo@circle.com', 'chiamaka@circle.com', 'emeka@circle.com', 'funmi@circle.com'];

// [email, daysAgo] — amounts chosen so Circle A lands at 70% of 5,000,000.
const LEDGER_A = [
  ['ada@circle.com', 500000, 44], ['bayo@circle.com', 250000, 43],
  ['chiamaka@circle.com', 300000, 41], ['ada@circle.com', 250000, 35],
  ['bayo@circle.com', 250000, 33], ['emeka@circle.com', 200000, 29],
  ['chiamaka@circle.com', 250000, 25], ['ada@circle.com', 500000, 20],
  ['jasowills01@gmail.com', 150000, 18], ['bayo@circle.com', 300000, 14],
  ['emeka@circle.com', 150000, 10], ['chiamaka@circle.com', 200000, 6],
  ['jasowills01@gmail.com', 100000, 5], ['ada@circle.com', 100000, 2],
];

// Sums to exactly 2,000,000 (goal_reached).
const LEDGER_B = [
  ['bayo@circle.com', 500000, 58], ['ada@circle.com', 500000, 55],
  ['funmi@circle.com', 400000, 50], ['bayo@circle.com', 300000, 40],
  ['ada@circle.com', 300000, 30],
];

async function main() {
  const emails = [...PEOPLE.map((p) => p.email), ...LEGACY];
  const olds = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const uids = olds.map((u) => u.id);
  if (uids.length) {
    const cids = [...new Set((await prisma.circleMembership.findMany({ where: { userId: { in: uids } }, select: { circleId: true } })).map((m) => m.circleId))];
    const own = await prisma.circle.findMany({ where: { createdById: { in: uids } }, select: { id: true } });
    for (const c of own) if (!cids.includes(c.id)) cids.push(c.id);
    if (cids.length) {
      await prisma.ledgerEntry.deleteMany({ where: { circleId: { in: cids } } });
      await prisma.circleMembership.deleteMany({ where: { circleId: { in: cids } } });
      await prisma.circle.deleteMany({ where: { id: { in: cids } } });
    }
    await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
  }

  const users = {};
  for (const p of PEOPLE) {
    users[p.email] = await prisma.user.create({
      data: {
        googleId: p.password ? `pwd:${p.email}` : `dev:${p.email}`,
        email: p.email,
        name: p.name,
        ...(p.password ? { passwordHash: hashSync(p.password, 10) } : {}),
      },
    });
  }
  const uid = (email) => users[email].id;

  async function contribute(circleId, email, amount, ago) {
    await prisma.ledgerEntry.create({
      data: { circleId, userId: uid(email), amount, type: 'contribution', idempotencyKey: randomUUID(), createdAt: daysAgo(ago) },
    });
  }

  // Circle A — active, mid-journey.
  const a = await prisma.circle.create({
    data: { name: 'Lekki Mortgage Deposit', goalAmount: 5000000, currency: 'NGN', status: 'active', createdById: uid('ada@circle.com'), createdAt: daysAgo(45) },
  });
  for (const [email, role, joined] of [['ada@circle.com', 'creator', 45], ['bayo@circle.com', 'member', 44], ['chiamaka@circle.com', 'member', 40], ['emeka@circle.com', 'member', 30], ['jasowills01@gmail.com', 'member', 20]]) {
    await prisma.circleMembership.create({ data: { circleId: a.id, userId: uid(email), role, status: 'active', invitedAt: daysAgo(joined + 1), joinedAt: daysAgo(joined) } });
  }
  for (const [email, amount, ago] of LEDGER_A) await contribute(a.id, email, amount, ago);

  // Circle B — goal reached.
  const b = await prisma.circle.create({
    data: { name: 'Ibeju Land Purchase', goalAmount: 2000000, currency: 'NGN', status: 'goal_reached', createdById: uid('bayo@circle.com'), createdAt: daysAgo(60) },
  });
  for (const [email, role, joined] of [['bayo@circle.com', 'creator', 60], ['ada@circle.com', 'member', 58], ['funmi@circle.com', 'member', 55]]) {
    await prisma.circleMembership.create({ data: { circleId: b.id, userId: uid(email), role, status: 'active', invitedAt: daysAgo(joined + 1), joinedAt: daysAgo(joined) } });
  }
  for (const [email, amount, ago] of LEDGER_B) await contribute(b.id, email, amount, ago);

  // Circle C — still forming, two invites out.
  const c = await prisma.circle.create({
    data: { name: 'Emergency Fund', goalAmount: 500000, currency: 'NGN', status: 'forming', createdById: uid('chiamaka@circle.com'), createdAt: daysAgo(5) },
  });
  await prisma.circleMembership.create({ data: { circleId: c.id, userId: uid('chiamaka@circle.com'), role: 'creator', status: 'active', invitedAt: daysAgo(5), joinedAt: daysAgo(5) } });
  for (const [email, ago] of [['emeka@circle.com', 4], ['funmi@circle.com', 4], ['jasowills01@gmail.com', 2]]) {
    await prisma.circleMembership.create({ data: { circleId: c.id, userId: uid(email), role: 'member', status: 'invited', invitedAt: daysAgo(ago) } });
  }
  await contribute(c.id, 'chiamaka@circle.com', 50000, 4);

  const totalA = LEDGER_A.reduce((s, [, a]) => s + a, 0);
  console.log(`seeded: A=${a.id} (${totalA.toLocaleString()}/5,000,000) B=${b.id} (2,000,000/2,000,000) C=${c.id} (forming)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

/* Demo seed v2: real Ajo rotation circles with funded wallets.
 * Run: DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
 * Idempotent: wipes the demo accounts first, then recreates them.
 *
 * World:
 *  A. "Lekki Mortgage Ajo" — 5 members, ₦20k/day, weekly pots of ₦700k,
 *     cycle 1 collecting mid-way. This is the circle you live in.
 *  B. "Ibeju Land Ajo" — 3 members, one full rotation behind it, completed.
 *  C. "Emergency Fund" — forming, your invite pending.
 *  D. "Saturday Thrift" — forming, 1 seat taken, discoverable.
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

const LEGACY = ['ada@example.com', 'bayo@example.com', 'chiamaka@example.com', 'emeka@example.com', 'funmi@example.com'];

async function wipe(emails) {
  const olds = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const uids = olds.map((u) => u.id);
  if (!uids.length) return;
  const cids = [...new Set((await prisma.circleMembership.findMany({ where: { userId: { in: uids } }, select: { circleId: true } })).map((m) => m.circleId))];
  const own = await prisma.circle.findMany({ where: { createdById: { in: uids } }, select: { id: true } });
  for (const c of own) if (!cids.includes(c.id)) cids.push(c.id);
  if (cids.length) {
    await prisma.ledgerEntry.deleteMany({ where: { circleId: { in: cids } } });
    await prisma.circleMembership.deleteMany({ where: { circleId: { in: cids } } });
    await prisma.circleCycle.deleteMany({ where: { circleId: { in: cids } } });
    await prisma.circle.deleteMany({ where: { id: { in: cids } } });
  }
  await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } });
  const wallets = await prisma.wallet.findMany({ where: { userId: { in: uids } }, select: { id: true } });
  if (wallets.length) await prisma.walletTransaction.deleteMany({ where: { walletId: { in: wallets.map((w) => w.id) } } });
  await prisma.wallet.deleteMany({ where: { userId: { in: uids } } });
  await prisma.user.deleteMany({ where: { id: { in: uids } } });
}

async function main() {
  await wipe([...PEOPLE.map((p) => p.email), ...LEGACY]);

  const users = {};
  for (const p of PEOPLE) {
    const u = await prisma.user.create({
      data: {
        googleId: p.password ? `pwd:${p.email}` : `dev:${p.email}`,
        email: p.email,
        name: p.name,
        ...(p.password ? { passwordHash: hashSync(p.password, 10) } : {}),
      },
    });
    users[p.email] = u.id;
    // Funded wallet with a starting balance for everyone.
    const w = await prisma.wallet.create({ data: { userId: u.id } });
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount: 500000, type: 'demo_fund', idempotencyKey: 'initial-demo-fund' },
    });
  }
  const uid = (email) => users[email];

  async function fundTx(circleId, cycleId, email, amount, ago, type = 'contribution') {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: uid(email) } });
    const key = randomUUID();
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount: -amount, type: 'circle_contribution', relatedCircleId: circleId, relatedCycleId: cycleId, idempotencyKey: `contrib:${key}` },
    });
    await prisma.ledgerEntry.create({
      data: { circleId, userId: uid(email), amount, type, idempotencyKey: key, cycleId, createdAt: daysAgo(ago) },
    });
  }

  async function payoutTx(circleId, cycleId, email, amount, ago) {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: uid(email) } });
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount, type: 'circle_payout', relatedCircleId: circleId, relatedCycleId: cycleId, idempotencyKey: `payout:${cycleId}` },
    });
  }

  async function makeCircle({ name, contrib, members, ago, status, invitees = [] }) {
    const c = await prisma.circle.create({
      data: {
        name, goalAmount: contrib * 7 * members.length, currency: 'NGN', status,
        createdById: uid(members[0][0]),
        contributionAmount: contrib, targetMembers: members.length + invitees.length, cycleLengthDays: 7,
        createdAt: daysAgo(ago),
      },
    });
    for (const [email, role, joined] of members) {
      await prisma.circleMembership.create({
        data: { circleId: c.id, userId: uid(email), role, status: 'active', invitedAt: daysAgo(joined + 1), joinedAt: daysAgo(joined) },
      });
    }
    for (const [email, since] of invitees) {
      await prisma.circleMembership.create({
        data: { circleId: c.id, userId: uid(email), role: 'member', status: 'invited', invitedAt: daysAgo(since) },
      });
    }
    return c;
  }

  async function makeCycles(circleId, order, targetPot, collectedCycle = 0) {
    const ids = [];
    for (let n = 0; n < order.length; n++) {
      const done = n < collectedCycle;
      const current = n === collectedCycle;
      const row = await prisma.circleCycle.create({
        data: {
          circleId, cycleNumber: n + 1, recipientId: uid(order[n]),
          startsAt: done || current ? daysAgo(7 * (order.length - n)) : new Date(0),
          endsAt: done || current ? daysAgo(7 * (order.length - n) - 7) : new Date(0),
          targetPot, status: done ? 'payout_completed' : current ? 'collecting' : 'pending',
        },
      });
      ids.push(row.id);
    }
    await prisma.circle.update({ where: { id: circleId }, data: { rotationOrder: order.map((e) => uid(e)) } });
    return ids;
  }

  // A. Lekki Mortgage Ajo — 5 members, ₦20k/day, ₦700k weekly pots, cycle 1 at ~60%.
  const a = await makeCircle({
    name: 'Lekki Mortgage Ajo', contrib: 20000, ago: 20, status: 'active',
    members: [['ada@circle.com', 'creator', 20], ['bayo@circle.com', 'member', 19], ['chiamaka@circle.com', 'member', 17], ['jasowills01@gmail.com', 'member', 10], ['james@circle.com', 'member', 8]],
  });
  const [a1] = await makeCycles(a.id, ['ada@circle.com', 'bayo@circle.com', 'chiamaka@circle.com', 'jasowills01@gmail.com', 'james@circle.com'], 700000);
  const A1 = [
    ['ada@circle.com', 140000, 6], ['bayo@circle.com', 140000, 6],
    ['chiamaka@circle.com', 140000, 5], ['jasowills01@gmail.com', 60000, 4],
    ['james@circle.com', 40000, 3],
  ];
  for (const [email, amount, ago] of A1) await fundTx(a.id, a1, email, amount, ago);

  // B. Ibeju Land Ajo — finished a full 3-cycle rotation.
  const b = await makeCircle({
    name: 'Ibeju Land Ajo', contrib: 10000, ago: 60, status: 'completed',
    members: [['bayo@circle.com', 'creator', 60], ['ada@circle.com', 'member', 58], ['funmi@circle.com', 'member', 55]],
  });
  const cyclesB = await makeCycles(b.id, ['bayo@circle.com', 'ada@circle.com', 'funmi@circle.com'], 210000, 3);
  const B1 = [
    ['bayo@circle.com', 70000, 52], ['ada@circle.com', 70000, 51], ['funmi@circle.com', 70000, 50],
    ['bayo@circle.com', 70000, 45], ['ada@circle.com', 70000, 44], ['funmi@circle.com', 70000, 43],
    ['bayo@circle.com', 70000, 38], ['ada@circle.com', 70000, 37], ['funmi@circle.com', 70000, 36],
  ];
  for (const [email, amount, ago] of B1) await fundTx(b.id, cyclesB[Math.min(2, Math.floor((52 - ago) / 7))], email, amount, ago);
  await payoutTx(b.id, cyclesB[0], 'bayo@circle.com', 210000, 42);
  await payoutTx(b.id, cyclesB[1], 'ada@circle.com', 210000, 35);
  await payoutTx(b.id, cyclesB[2], 'funmi@circle.com', 210000, 28);

  // C. Emergency Fund — forming, Jason + James invited.
  await makeCircle({
    name: 'Emergency Fund', contrib: 5000, ago: 5, status: 'forming',
    members: [['chiamaka@circle.com', 'creator', 5]],
    invitees: [['jasowills01@gmail.com', 2], ['james@circle.com', 1]],
  });

  // D. Saturday Thrift — forming, discoverable, one seat taken.
  await makeCircle({
    name: 'Saturday Thrift', contrib: 5000, ago: 3, status: 'forming',
    members: [['emeka@circle.com', 'creator', 3]],
    invitees: [['funmi@circle.com', 2]],
  });

  console.log('seeded v2: A (active, cycle 1 collecting) B (completed) C+D (forming). Log in as jasowills01@gmail.com or james@circle.com/12345678.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

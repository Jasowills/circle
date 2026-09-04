/* Demo seed v3: consistent Ajo world. Every contribution is a whole multiple
 * of its circle's daily amount, so the demo never contradicts the app's own
 * fixed-step rule. Wallets open at ₦5M demo credit so all history stays positive.
 * Run: DATABASE_URL="postgresql://circle:circle@localhost:5432/circle" node prisma/seed.js
 *
 * World:
 *  A. "Lekki Mortgage Ajo" — 6 members, ₦20k/day, ₦840k pots, cycle 1 at 60%.
 *  B. "Ibeju Land Ajo" — completed full rotation, payouts in wallets.
 *  C. "Emergency Fund" — forming, Jason + James invited.
 *  D. "Saturday Thrift" — forming, discoverable.
 *  E. "Demo Day Ajo" — 3 members, ₦50k/day, ₦1.05M pot at 1,000,000/1,050,000.
 *     One ₦50k tap from James completes it and pays James live on camera.
 */
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const { hashSync } = require('bcryptjs');

const prisma = new PrismaClient();
const daysAgo = (n, h = 12) => new Date(Date.now() - n * 86400000 - h * 3600000);
const daysOut = (n) => new Date(Date.now() + n * 86400000);

const PEOPLE = [
  { email: 'ada@circle.com', name: 'Adaeze Okafor' },
  { email: 'bayo@circle.com', name: 'Bayo Adeyemi' },
  { email: 'chiamaka@circle.com', name: 'Chiamaka Eze' },
  { email: 'emeka@circle.com', name: 'Emeka Obi' },
  { email: 'funmi@circle.com', name: 'Funmi Balogun' },
  { email: 'tunde@circle.com', name: 'Tunde Bakare' },
  { email: 'amaka@circle.com', name: 'Amaka Nwosu' },
  { email: 'ngozi@circle.com', name: 'Ngozi Eze' },
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
    const w = await prisma.wallet.create({ data: { userId: u.id } });
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount: 5000000, type: 'demo_fund', idempotencyKey: 'initial-demo-fund' },
    });
  }
  const uid = (email) => users[email];

  async function fundTx(circleId, cycleId, email, amount, ago) {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: uid(email) } });
    const key = randomUUID();
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount: -amount, type: 'circle_contribution', relatedCircleId: circleId, relatedCycleId: cycleId, idempotencyKey: `contrib:${key}` },
    });
    await prisma.ledgerEntry.create({
      data: { circleId, userId: uid(email), amount, type: 'contribution', idempotencyKey: key, cycleId, createdAt: daysAgo(ago) },
    });
  }

  async function payoutTx(circleId, cycleId, email, amount, ago) {
    const w = await prisma.wallet.findUniqueOrThrow({ where: { userId: uid(email) } });
    await prisma.walletTransaction.create({
      data: { walletId: w.id, amount, type: 'circle_payout', relatedCircleId: circleId, relatedCycleId: cycleId, idempotencyKey: `payout:${cycleId}` },
    });
  }

  async function makeCircle({ name, contrib, ago, status, members, invitees = [] }) {
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

  async function makeCycles(circleId, order, targetPot, collectedCount, endsInDays) {
    const ids = [];
    for (let n = 0; n < order.length; n++) {
      const done = n < collectedCount;
      const current = n === collectedCount;
      const row = await prisma.circleCycle.create({
        data: {
          circleId, cycleNumber: n + 1, recipientId: uid(order[n]),
          startsAt: done || current ? daysAgo(7) : new Date(0),
          endsAt: done ? daysAgo(1) : current ? daysOut(endsInDays) : new Date(0),
          targetPot, status: done ? 'payout_completed' : current ? 'collecting' : 'pending',
        },
      });
      ids.push(row.id);
    }
    await prisma.circle.update({ where: { id: circleId }, data: { rotationOrder: order.map((e) => uid(e)) } });
    return ids;
  }

  // A. Lekki Mortgage Ajo — cycle 1 at 504,000/840,000 (60%).
  const a = await makeCircle({
    name: 'Lekki Mortgage Ajo', contrib: 20000, ago: 14, status: 'active',
    members: [['ada@circle.com', 'creator', 14], ['bayo@circle.com', 'member', 13], ['chiamaka@circle.com', 'member', 12], ['emeka@circle.com', 'member', 10], ['jasowills01@gmail.com', 'member', 8], ['james@circle.com', 'member', 7]],
  });
  const [a1] = await makeCycles(a.id, ['ada@circle.com', 'bayo@circle.com', 'chiamaka@circle.com', 'emeka@circle.com', 'jasowills01@gmail.com', 'james@circle.com'], 840000, 0, 2);
  const A1 = [
    ['ada@circle.com', 6], ['bayo@circle.com', 5], ['chiamaka@circle.com', 5],
    ['emeka@circle.com', 3], ['jasowills01@gmail.com', 3], ['james@circle.com', 3],
  ];
  let day = 6;
  for (const [email, count] of A1) {
    for (let i = 0; i < count; i++) await fundTx(a.id, a1, email, 20000, day);
    day -= 1;
  }
  // Second wave, days 6-9: the pot climbs toward 660k.
  const A2 = [
    ['ada@circle.com', 2, 9], ['bayo@circle.com', 2, 8], ['chiamaka@circle.com', 1, 9],
    ['emeka@circle.com', 1, 8], ['jasowills01@gmail.com', 1, 7], ['james@circle.com', 1, 6],
  ];
  for (const [email, count, ago] of A2) {
    for (let i = 0; i < count; i++) await fundTx(a.id, a1, email, 20000, ago);
  }

  // B. Ibeju Land Ajo — completed full rotation (70k = 7 daily payments each).
  const b = await makeCircle({
    name: 'Ibeju Land Ajo', contrib: 10000, ago: 60, status: 'completed',
    members: [['bayo@circle.com', 'creator', 60], ['ada@circle.com', 'member', 58], ['funmi@circle.com', 'member', 55]],
  });
  const cyclesB = await makeCycles(b.id, ['bayo@circle.com', 'ada@circle.com', 'funmi@circle.com'], 210000, 3, 0);
  const B1 = [
    ['bayo@circle.com', 70000, 52], ['ada@circle.com', 70000, 51], ['funmi@circle.com', 70000, 50],
    ['bayo@circle.com', 70000, 45], ['ada@circle.com', 70000, 44], ['funmi@circle.com', 70000, 43],
    ['bayo@circle.com', 70000, 38], ['ada@circle.com', 70000, 37], ['funmi@circle.com', 70000, 36],
  ];
  for (const [email, amount, ago] of B1) await fundTx(b.id, cyclesB[Math.min(2, Math.floor((52 - ago) / 7))], email, amount, ago);
  await payoutTx(b.id, cyclesB[0], 'bayo@circle.com', 210000, 42);
  await payoutTx(b.id, cyclesB[1], 'ada@circle.com', 210000, 35);
  await payoutTx(b.id, cyclesB[2], 'funmi@circle.com', 210000, 28);

  // C + D — forming.
  await makeCircle({
    name: 'Emergency Fund', contrib: 5000, ago: 5, status: 'forming',
    members: [['chiamaka@circle.com', 'creator', 5]],
    invitees: [['jasowills01@gmail.com', 2], ['james@circle.com', 1]],
  });
  await makeCircle({
    name: 'Saturday Thrift', contrib: 5000, ago: 3, status: 'forming',
    members: [['emeka@circle.com', 'creator', 3]],
    invitees: [['funmi@circle.com', 2]],
  });

  // F. Rent Save-Up — Jason's own forming circle, two seats to fill.
  await makeCircle({
    name: 'Rent Save-Up', contrib: 10000, ago: 3, status: 'forming',
    members: [['jasowills01@gmail.com', 'creator', 3], ['ada@circle.com', 'member', 2]],
    invitees: [['tunde@circle.com', 1], ['ngozi@circle.com', 1]],
  });

  // G. Owambe Fund — James's fourth circle, mid first cycle.
  const g = await makeCircle({
    name: 'Owambe Fund', contrib: 15000, ago: 9, status: 'active',
    members: [['funmi@circle.com', 'creator', 9], ['james@circle.com', 'member', 8], ['tunde@circle.com', 'member', 7], ['amaka@circle.com', 'member', 6]],
  });
  const [g1] = await makeCycles(g.id, ['funmi@circle.com', 'james@circle.com', 'tunde@circle.com', 'amaka@circle.com'], 420000, 0, 3);
  const G1 = [
    ['funmi@circle.com', 3, 5], ['james@circle.com', 2, 4],
    ['tunde@circle.com', 2, 3], ['amaka@circle.com', 1, 2],
  ];
  for (const [email, count, ago] of G1) {
    for (let i = 0; i < count; i++) await fundTx(g.id, g1, email, 15000, ago);
  }

  // H. December Detty Fund + I. School Fees Pool — forming, discoverable.
  await makeCircle({
    name: 'December Detty Fund', contrib: 10000, ago: 4, status: 'forming',
    members: [['ngozi@circle.com', 'creator', 4]],
    invitees: [['james@circle.com', 2], ['amaka@circle.com', 1]],
  });
  await makeCircle({
    name: 'School Fees Pool', contrib: 25000, ago: 5, status: 'forming',
    members: [['tunde@circle.com', 'creator', 5]],
    invitees: [['emeka@circle.com', 3]],
  });

  // E. Demo Day Ajo — 1,000,000/1,050,000. James's next ₦50k tap completes it
  // and pays the full pot to James, live.
  const e = await makeCircle({
    name: 'Demo Day Ajo', contrib: 50000, ago: 6, status: 'active',
    members: [['ada@circle.com', 'creator', 6], ['bayo@circle.com', 'member', 5], ['james@circle.com', 'member', 4]],
  });
  const [e1] = await makeCycles(e.id, ['james@circle.com', 'ada@circle.com', 'bayo@circle.com'], 1050000, 0, 2);
  for (let i = 0; i < 10; i++) await fundTx(e.id, e1, 'ada@circle.com', 50000, 4);
  for (let i = 0; i < 10; i++) await fundTx(e.id, e1, 'bayo@circle.com', 50000, 3);

  console.log('seeded v3. James: Demo Day Ajo needs exactly one 50k tap to pay out 1.05M.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

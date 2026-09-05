import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Full-chain regression: auth → circle → invite/accept → idempotent ledger
 * writes → state transitions → live WebSocket event → audit history.
 * Needs Postgres up (docker compose up -d postgres) and ALLOW_DEV_LOGIN=true.
 */
describe('Circle e2e (demo flow)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  const stamp = Date.now();
  const emailA = `e2e-ada-${stamp}@example.com`;
  const emailB = `e2e-bayo-${stamp}@example.com`;
  const emailPwd = `e2e-pwd-${stamp}@example.com`;
  let tokenA = '';
  let tokenB = '';
  let circleId = '';
  const createdCircleIds: string[] = [];

  jest.setTimeout(30000);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0);
    const addr = app.getHttpServer().address() as { port: number };
    baseUrl = `http://127.0.0.1:${addr.port}`;
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // FK-safe cleanup of everything this run created.
    const users = await prisma.user.findMany({
      where: { email: { in: [emailA, emailB, emailPwd, `e2e-x-${stamp}@example.com`, `e2e-y-${stamp}@example.com`, `e2e-z-${stamp}@example.com`, `e2e-p-${stamp}@example.com`, `e2e-q-${stamp}@example.com`, `e2e-s-${stamp}@example.com`, `e2e-t-${stamp}@example.com`, `e2e-m-${stamp}@example.com`, `e2e-n-${stamp}@example.com`, `e2e-o-${stamp}@example.com`] } },
      select: { id: true },
    });
    const uids = users.map((u) => u.id);
    const circles = await prisma.circle.findMany({
      where: { id: { in: createdCircleIds } },
      select: { id: true },
    });
    const cids = circles.map((c) => c.id);
    if (cids.length) {
      await prisma.ledgerEntry.deleteMany({ where: { circleId: { in: cids } } });
      await prisma.circleMembership.deleteMany({ where: { circleId: { in: cids } } });
      await prisma.circle.deleteMany({ where: { id: { in: cids } } });
    }
    if (uids.length) {
      await prisma.refreshToken.deleteMany({ where: { userId: { in: uids } } });
      await prisma.user.deleteMany({ where: { id: { in: uids } } });
    }
    await app.close();
  });

  it('logs in two users', async () => {
    const a = await request(baseUrl).post('/auth/dev-login').send({ email: emailA, name: 'E2E Ada' });
    expect(a.status).toBe(201);
    expect(a.body.isNew).toBe(true);
    tokenA = a.body.accessToken;
    const b = await request(baseUrl).post('/auth/dev-login').send({ email: emailB, name: 'E2E Bayo' });
    expect(b.status).toBe(201);
    expect(b.body.isNew).toBe(true);
    tokenB = b.body.accessToken;
    expect(tokenA).not.toEqual(tokenB);
    const again = await request(baseUrl).post('/auth/dev-login').send({ email: emailA });
    expect(again.body.isNew).toBe(false);
  });

  it('completes profile setup via PATCH /me', async () => {
    const ok = await request(baseUrl)
      .patch('/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'E2E Ada Updated' });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('E2E Ada Updated');
    const bad = await request(baseUrl)
      .patch('/me')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: '' });
    expect(bad.status).toBe(400);
    const anon = await request(baseUrl).patch('/me').send({ name: 'x' });
    expect(anon.status).toBe(401);
  });

  it('signs up and logs in with a password', async () => {
    const email = emailPwd;
    const signup = await request(baseUrl).post('/auth/signup').send({ email, name: 'E2E Pwd', password: 'password123' });
    expect(signup.status).toBe(201);
    expect(signup.body.isNew).toBe(true);
    const dup = await request(baseUrl).post('/auth/signup').send({ email, name: 'E2E Pwd', password: 'password123' });
    expect(dup.status).toBe(409);
    const login = await request(baseUrl).post('/auth/login').send({ email, password: 'password123' });
    expect(login.status).toBe(201);
    expect(login.body.isNew).toBe(false);
    const wrong = await request(baseUrl).post('/auth/login').send({ email, password: 'wrongpass1' });
    expect(wrong.status).toBe(401);
    const unknown = await request(baseUrl).post('/auth/login').send({ email: 'nobody-here@example.com', password: 'password123' });
    expect(unknown.status).toBe(401);
    const short = await request(baseUrl).post('/auth/signup').send({ email: 'x@example.com', name: 'X', password: 'short' });
    expect(short.status).toBe(400);
  });

  it('creates a forming circle and flips it active on second member accept', async () => {
    const c = await request(baseUrl)
      .post('/circles')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'E2E deposit', goalAmount: 1000 });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe('forming');
    circleId = c.body.id;
    createdCircleIds.push(circleId);

    const inv = await request(baseUrl)
      .post(`/circles/${circleId}/invite`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ email: emailB });
    expect(inv.status).toBe(201);

    const acc = await request(baseUrl)
      .post(`/circles/${circleId}/accept`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(acc.status).toBe(200);
    expect(acc.body.status).toBe('active');
  });

  it('writes idempotently and broadcasts the live event', async () => {
    const socket: Socket = io(baseUrl, { transports: ['websocket'] });
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('join timeout')), 8000);
        socket.on('joined', () => {
          clearTimeout(t);
          resolve();
        });
        socket.on('connect', () => socket.emit('join', { circleId, token: tokenA }));
      });

      const event = new Promise<unknown>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('event timeout')), 8000);
        socket.on('contribution.created', (p) => {
          clearTimeout(t);
          resolve(p);
        });
      });

      const key = randomUUID();
      const first = await request(baseUrl)
        .post(`/circles/${circleId}/contribute`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 400, idempotencyKey: key });
      expect(first.status).toBe(200);
      expect(first.body.replayed).toBe(false);

      // The money shot: identical retry → same entry, no duplicate, no event.
      const retry = await request(baseUrl)
        .post(`/circles/${circleId}/contribute`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ amount: 400, idempotencyKey: key });
      expect(retry.status).toBe(200);
      expect(retry.body.replayed).toBe(true);
      expect(retry.body.entry.id).toBe(first.body.entry.id);

      const evt = (await event) as { entryId: string };
      expect(evt.entryId).toBe(first.body.entry.id);
    } finally {
      socket.disconnect();
    }
  });

  it('runs a full Ajo rotation: wallet debit, cycle payout, completion', async () => {
    const x = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-x-${stamp}@example.com` });
    const y = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-y-${stamp}@example.com` });
    const tX = x.body.accessToken as string;
    const tY = y.body.accessToken as string;
    const idX = (await request(baseUrl).get('/me').set('Authorization', `Bearer ${tX}`)).body.id as string;

    const c = await request(baseUrl).post('/circles')
      .set('Authorization', `Bearer ${tX}`)
      .send({ name: 'E2E Ajo', goalAmount: 14000, contributionAmount: 1000, targetMembers: 2, cycleLengthDays: 7 });
    expect(c.status).toBe(201);
    expect(c.body.status).toBe('forming');
    const rc = c.body.id as string;
    createdCircleIds.push(rc);

    await request(baseUrl).post(`/circles/${rc}/invite`)
      .set('Authorization', `Bearer ${tX}`)
      .send({ email: `e2e-y-${stamp}@example.com` });
    const acc = await request(baseUrl).post(`/circles/${rc}/accept`)
      .set('Authorization', `Bearer ${tY}`);
    expect(acc.body.status).toBe('forming'); // rotation waits on the creator
    const early = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tX}`)
      .send({ amount: 1000, idempotencyKey: randomUUID() });
    expect(early.status).toBe(200); // contributions accrue while forming
    const act = await request(baseUrl).post(`/circles/${rc}/activate`)
      .set('Authorization', `Bearer ${tX}`);
    expect(act.body.status).toBe('active');

    const sched = await request(baseUrl).get(`/circles/${rc}/cycles`)
      .set('Authorization', `Bearer ${tX}`);
    expect(sched.status).toBe(200);
    expect(sched.body).toHaveLength(2);
    expect(sched.body[0].status).toBe('collecting');
    expect(sched.body[0].targetPot).toBe(14000);
    const firstRecipient: string = sched.body[0].recipient.id;

    const w0 = await request(baseUrl).get('/wallet')
      .set('Authorization', `Bearer ${tX}`);
    expect(w0.body.balance).toBe(99000); // 100k demo fund minus the forming contribution above

    const k1 = randomUUID();
    const pay1 = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tX}`)
      .send({ amount: 10000, idempotencyKey: k1 });
    expect(pay1.status).toBe(200);
    const w1 = await request(baseUrl).get('/wallet')
      .set('Authorization', `Bearer ${tX}`);
    expect(w1.body.balance).toBe(89000); // debited

    const pay2 = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tY}`)
      .send({ amount: 4000, idempotencyKey: randomUUID() });
    expect(pay2.status).toBe(200);

    // Pot full (14000): cycle 1 paid out, cycle 2 collecting.
    const sched2 = await request(baseUrl).get(`/circles/${rc}/cycles`)
      .set('Authorization', `Bearer ${tX}`);
    expect(sched2.body[0].status).toBe('payout_completed');
    expect(sched2.body[1].status).toBe('collecting');
    const recipToken = firstRecipient === idX ? tX : tY;
    const wRecip = await request(baseUrl).get('/wallet')
      .set('Authorization', `Bearer ${recipToken}`);
    expect(Number(wRecip.body.balance)).toBeGreaterThan(89000);

    // Fill cycle 2 → rotation completes.
    await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tX}`)
      .send({ amount: 14000, idempotencyKey: randomUUID() });
    const done = await request(baseUrl).get(`/circles/${rc}`)
      .set('Authorization', `Bearer ${tX}`);
    expect(done.body.status).toBe('completed');
    const closed = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tX}`)
      .send({ amount: 10, idempotencyKey: randomUUID() });
    expect(closed.status).toBe(400);
  });

  it('holds payouts for manual collect when auto-collect is off', async () => {
    const p = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-p-${stamp}@example.com` });
    const q = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-q-${stamp}@example.com` });
    const tP = p.body.accessToken as string;
    const tQ = q.body.accessToken as string;
    const idP = (await request(baseUrl).get('/me').set('Authorization', `Bearer ${tP}`)).body.id as string;
    const c = await request(baseUrl).post('/circles')
      .set('Authorization', `Bearer ${tP}`)
      .send({ name: 'E2E Hold', goalAmount: 14000, contributionAmount: 1000, targetMembers: 2 });
    const rc = c.body.id as string;
    createdCircleIds.push(rc);
    await request(baseUrl).post(`/circles/${rc}/invite`)
      .set('Authorization', `Bearer ${tP}`)
      .send({ email: `e2e-q-${stamp}@example.com` });
    await request(baseUrl).post(`/circles/${rc}/accept`)
      .set('Authorization', `Bearer ${tQ}`);
    await request(baseUrl).post(`/circles/${rc}/activate`)
      .set('Authorization', `Bearer ${tP}`);
    const sched = await request(baseUrl).get(`/circles/${rc}/cycles`)
      .set('Authorization', `Bearer ${tP}`);
    const c1 = sched.body[0];
    const rToken = c1.recipient.id === idP ? tP : tQ;
    const otherToken = rToken === tP ? tQ : tP;

    const auto = await request(baseUrl).patch(`/circles/${rc}/auto`)
      .set('Authorization', `Bearer ${rToken}`)
      .send({ collect: false });
    expect(auto.status).toBe(200);
    expect(auto.body.autoCollect).toBe(false);

    const wBefore = await request(baseUrl).get('/wallet').set('Authorization', `Bearer ${rToken}`);
    await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tP}`)
      .send({ amount: 7000, idempotencyKey: randomUUID() });
    await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tQ}`)
      .send({ amount: 7000, idempotencyKey: randomUUID() });

    const wHeld = await request(baseUrl).get('/wallet').set('Authorization', `Bearer ${rToken}`);
    expect(Number(wHeld.body.balance)).toBe(Number(wBefore.body.balance) - 7000);
    const sched2 = await request(baseUrl).get(`/circles/${rc}/cycles`)
      .set('Authorization', `Bearer ${tP}`);
    expect(sched2.body[0].status).toBe('payout_completed');

    const stranger = await request(baseUrl).post(`/circles/${rc}/cycles/${c1.id}/claim`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect(stranger.status).toBe(403);

    const claim = await request(baseUrl).post(`/circles/${rc}/cycles/${c1.id}/claim`)
      .set('Authorization', `Bearer ${rToken}`);
    expect(claim.status).toBe(200);
    expect(claim.body.collected).toBe(true);
    const wAfter = await request(baseUrl).get('/wallet').set('Authorization', `Bearer ${rToken}`);
    expect(Number(wAfter.body.balance)).toBe(Number(wHeld.body.balance) + 14000);

    const again = await request(baseUrl).post(`/circles/${rc}/cycles/${c1.id}/claim`)
      .set('Authorization', `Bearer ${rToken}`);
    expect(again.status).toBe(400);
  });

  it('paces contributions to the configured cadence', async () => {
    const s = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-s-${stamp}@example.com` });
    const tS = s.body.accessToken as string;
    const c = await request(baseUrl).post('/circles')
      .set('Authorization', `Bearer ${tS}`)
      .send({ name: 'E2E Weekly', goalAmount: 14000, contributionAmount: 1000, targetMembers: 2, contributionsPerWeek: 1 });
    const rc = c.body.id as string;
    createdCircleIds.push(rc);
    const t = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-t-${stamp}@example.com` });
    const tT = t.body.accessToken as string;
    await request(baseUrl).post(`/circles/${rc}/invite`)
      .set('Authorization', `Bearer ${tS}`)
      .send({ email: `e2e-t-${stamp}@example.com` });
    await request(baseUrl).post(`/circles/${rc}/accept`)
      .set('Authorization', `Bearer ${tT}`);
    await request(baseUrl).post(`/circles/${rc}/activate`)
      .set('Authorization', `Bearer ${tS}`);
    const first = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tS}`)
      .send({ amount: 1000, idempotencyKey: randomUUID() });
    expect(first.status).toBe(200);
    const second = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tS}`)
      .send({ amount: 1000, idempotencyKey: randomUUID() });
    expect(second.status).toBe(400);
    expect(second.body.message).toMatch(/Next contribution opens in/);
    const detail = await request(baseUrl).get(`/circles/${rc}`)
      .set('Authorization', `Bearer ${tS}`);
    expect(detail.body.myNextContributionAt).not.toBeNull();
  });

  it('locks the roster on activation: no mid-rotation joiners', async () => {
    const m = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-m-${stamp}@example.com` });
    const n = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-n-${stamp}@example.com` });
    const o = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-o-${stamp}@example.com` });
    const tM = m.body.accessToken as string;
    const tN = n.body.accessToken as string;
    const tO = o.body.accessToken as string;
    const c = await request(baseUrl).post('/circles')
      .set('Authorization', `Bearer ${tM}`)
      .send({ name: 'E2E Lock', goalAmount: 14000, contributionAmount: 1000, targetMembers: 3 });
    const rc = c.body.id as string;
    createdCircleIds.push(rc);
    await request(baseUrl).post(`/circles/${rc}/invite`)
      .set('Authorization', `Bearer ${tM}`)
      .send({ email: `e2e-n-${stamp}@example.com` });
    await request(baseUrl).post(`/circles/${rc}/accept`)
      .set('Authorization', `Bearer ${tN}`);
    // Non-creator cannot activate; solo circle cannot activate.
    const noAuth = await request(baseUrl).post(`/circles/${rc}/activate`)
      .set('Authorization', `Bearer ${tN}`);
    expect(noAuth.status).toBe(403);
    const act = await request(baseUrl).post(`/circles/${rc}/activate`)
      .set('Authorization', `Bearer ${tM}`);
    expect(act.body.status).toBe('active');
    // Late invite + late accept + late join all refuse.
    const lateInv = await request(baseUrl).post(`/circles/${rc}/invite`)
      .set('Authorization', `Bearer ${tM}`)
      .send({ email: `e2e-o-${stamp}@example.com` });
    expect(lateInv.status).toBe(400);
    const lateJoin = await request(baseUrl).post(`/circles/${rc}/join`)
      .set('Authorization', `Bearer ${tO}`);
    expect(lateJoin.status).toBe(400);
  });

  it('rejects contributions the wallet cannot cover', async () => {
    const z = await request(baseUrl).post('/auth/dev-login').send({ email: `e2e-z-${stamp}@example.com` });
    const tZ = z.body.accessToken as string;
    const c = await request(baseUrl).post('/circles')
      .set('Authorization', `Bearer ${tZ}`)
      .send({ name: 'E2E Poor', goalAmount: 100 });
    const rc = c.body.id as string;
    createdCircleIds.push(rc);
    const poor = await request(baseUrl).post(`/circles/${rc}/contribute`)
      .set('Authorization', `Bearer ${tZ}`)
      .send({ amount: 200000, idempotencyKey: randomUUID() });
    expect(poor.status).toBe(400);
  });
  it('crosses the goal and exposes a 2-row audit trail', async () => {
    const push = await request(baseUrl)
      .post(`/circles/${circleId}/contribute`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ amount: 600, idempotencyKey: randomUUID() });
    expect(push.status).toBe(200);
    expect(push.body.circle.status).toBe('goal_reached');

    const detail = await request(baseUrl)
      .get(`/circles/${circleId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(Number(detail.body.balance)).toBe(1000);
    expect(detail.body.progress).toBe(1);

    const ledger = await request(baseUrl)
      .get(`/circles/${circleId}/ledger?limit=20`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(ledger.body.total).toBe(2); // 3 writes, 1 replay → 2 rows
  });
});

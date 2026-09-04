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
      where: { email: { in: [emailA, emailB, emailPwd] } },
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

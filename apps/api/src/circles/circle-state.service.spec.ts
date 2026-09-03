import { CircleStateService } from './circle-state.service';

describe('CircleStateService (spec §7)', () => {
  const svc = new CircleStateService();
  const snap = (status: 'forming' | 'active' | 'goal_reached' | 'closed') => ({
    id: 'c1',
    status,
    goalAmount: 1000,
  });

  it('forming → active once there are ≥2 active members', () => {
    expect(svc.nextStatus(snap('forming'), 1, 0)).toBeNull();
    expect(svc.nextStatus(snap('forming'), 2, 0)).toBe('active');
  });

  it('active → goal_reached when balance crosses the goal', () => {
    expect(svc.nextStatus(snap('active'), 2, 999.99)).toBeNull();
    expect(svc.nextStatus(snap('active'), 2, 1000)).toBe('goal_reached');
  });

  it('goal_reached / closed never auto-transition', () => {
    expect(svc.nextStatus(snap('goal_reached'), 5, 99999)).toBeNull();
    expect(svc.nextStatus(snap('closed'), 5, 99999)).toBeNull();
  });

  it('only active|goal_reached can be closed (creator action)', () => {
    expect(svc.canClose('forming')).toBe(false);
    expect(svc.canClose('active')).toBe(true);
    expect(svc.canClose('goal_reached')).toBe(true);
    expect(svc.canClose('closed')).toBe(false);
  });
});

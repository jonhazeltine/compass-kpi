import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_ROUTES,
  getAdminRouteByPath,
  getInitialAdminRouteKey,
  getSessionRoles,
  hasAnyRole,
  isAdminSession,
  normalizeAdminRole,
} from './adminAuthz.ts';

test('normalizeAdminRole maps aliases to canonical admin roles', () => {
  assert.equal(normalizeAdminRole('admin'), 'platform_admin');
  assert.equal(normalizeAdminRole('platform_admin'), 'platform_admin');
  assert.equal(normalizeAdminRole('super admin'), 'super_admin');
  assert.equal(normalizeAdminRole('SUPER-ADMIN'), 'super_admin');
  assert.equal(normalizeAdminRole('leader'), 'team_leader');
  assert.equal(normalizeAdminRole('member'), 'team_member');
  assert.equal(normalizeAdminRole('coach'), 'coach');
  assert.equal(normalizeAdminRole('challenge_sponsor'), 'challenge_sponsor');
  assert.equal(normalizeAdminRole('sponsor'), 'challenge_sponsor');
});

test('normalizeAdminRole returns unknown for unmapped non-empty strings', () => {
  assert.equal(normalizeAdminRole('mystery_role'), 'unknown');
  assert.equal(normalizeAdminRole(''), null);
  assert.equal(normalizeAdminRole(undefined), null);
});

test('getAdminRouteByPath matches admin paths and trims trailing slash', () => {
  assert.equal(getAdminRouteByPath('/admin')?.key, 'overview');
  assert.equal(getAdminRouteByPath('/admin/')?.key, 'overview');
  assert.equal(getAdminRouteByPath('/admin/authz')?.key, 'authz');
  assert.equal(getAdminRouteByPath('/admin/users/')?.key, 'users');
  assert.equal(getAdminRouteByPath('/coach/uploads')?.key, 'coachingUploads');
  assert.equal(getAdminRouteByPath('/coach/library')?.key, 'coachingLibrary');
  assert.equal(getAdminRouteByPath('/coach/journeys')?.key, 'coachingJourneys');
  assert.equal(getAdminRouteByPath('/coach/channels')?.key, 'coachingChannels');
  assert.equal(getAdminRouteByPath('/admin/coaching/uploads')?.key, 'coachingUploads');
  assert.equal(getAdminRouteByPath('/admin/coaching/library')?.key, 'coachingLibrary');
  assert.equal(getAdminRouteByPath('/admin/coaching/journeys')?.key, 'coachingJourneys');
  assert.equal(getAdminRouteByPath('/admin/nope'), null);
});

test('getInitialAdminRouteKey falls back to overview for invalid route keys', () => {
  assert.equal(getInitialAdminRouteKey('authz'), 'authz');
  assert.equal(getInitialAdminRouteKey('not_a_route'), 'overview');
  assert.equal(getInitialAdminRouteKey(undefined), 'overview');
});

test('getSessionRoles extracts roles from app and user metadata', () => {
  const fakeSession = {
    user: {
      app_metadata: { role: 'admin', roles: ['team_leader'] },
      user_metadata: { role: 'member', roles: ['super_admin'] },
    },
  };

  const roles = getSessionRoles(fakeSession);
  assert.deepEqual(
    [...roles].sort(),
    ['platform_admin', 'super_admin', 'team_leader', 'team_member'].sort()
  );
});

test('isAdminSession and hasAnyRole identify admin access', () => {
  const adminSession = { user: { app_metadata: { role: 'super_admin' }, user_metadata: {} } };
  const nonAdminSession = { user: { app_metadata: {}, user_metadata: { role: 'team_member' } } };

  assert.equal(isAdminSession(adminSession), true);
  assert.equal(isAdminSession(nonAdminSession), false);
  assert.equal(hasAnyRole(['team_member', 'team_leader'], ['platform_admin', 'team_leader']), true);
  assert.equal(hasAnyRole(['team_member'], ['platform_admin', 'super_admin']), false);
});

test('admin routes remain defined for A1 shell placeholders', () => {
  assert.ok(ADMIN_ROUTES.length >= 2);
  assert.ok(ADMIN_ROUTES.some((route) => route.path === '/admin'));
  assert.ok(ADMIN_ROUTES.some((route) => route.path === '/admin/authz'));
  assert.ok(ADMIN_ROUTES.some((route) => route.path === '/coach/uploads'));
  assert.ok(ADMIN_ROUTES.some((route) => route.path === '/coach/journeys'));
  assert.ok(ADMIN_ROUTES.some((route) => route.path === '/coach/channels'));
});

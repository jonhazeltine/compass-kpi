import type { AdminRouteKey } from './adminAuthz';

export type AdminRouteStage = 'A1 now' | 'A2 now' | 'A3 now';

export type AdminRouteStageTone = {
  bg: string;
  text: string;
  border: string;
};

export const ADMIN_UNAUTHORIZED_PATH = '/admin/unauthorized';
export const ADMIN_NOT_FOUND_PATH = '/admin/not-found';

export function getAdminRouteStage(routeKey: AdminRouteKey): AdminRouteStage {
  switch (routeKey) {
    case 'overview':
    case 'authz':
      return 'A1 now';
    case 'kpis':
    case 'challengeTemplates':
      return 'A2 now';
    case 'users':
    case 'reports':
    case 'coachingUploads':
    case 'coachingLibrary':
    case 'coachingCohorts':
    case 'coachingChannels':
    case 'coachingAudit':
      return 'A3 now';
    default:
      return 'A1 now';
  }
}

export function getAdminRouteStageTone(stage: AdminRouteStage): AdminRouteStageTone {
  if (stage === 'A1 now') return { bg: '#E8FFF3', text: '#146C43', border: '#B6E6CB' };
  if (stage === 'A2 now') return { bg: '#EEF3FF', text: '#204ECF', border: '#CEDBFF' };
  return { bg: '#FFF5E6', text: '#9A5A00', border: '#F5D9AA' };
}

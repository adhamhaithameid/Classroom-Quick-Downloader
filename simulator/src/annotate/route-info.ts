/** Annotate-mode view of the current hash route: state id, title, deep link. */

import { getClassroomPage } from '../fixtures/pages';
import { getPopupState } from '../fixtures/states';
import { classroomHash, optionsHash, popupHash, type Route } from '../hash';
import type { SimRouteKind } from './types';

export interface RouteMeta {
  kind: SimRouteKind;
  stateId: string;
  title: string;
  deepLink: string;
}

export function routeMeta(route: Route): RouteMeta {
  switch (route.kind) {
    case 'popup': {
      const state = getPopupState(route.stateId);
      return {
        kind: 'popup',
        stateId: route.stateId,
        title: state?.label ?? route.stateId,
        deepLink: popupHash(route.stateId),
      };
    }
    case 'classroom': {
      const page = getClassroomPage(route.pageId);
      const demo = route.params.get('demo') ?? undefined;
      return {
        kind: 'classroom',
        stateId: route.pageId,
        title: page?.label ?? route.pageId,
        deepLink: window.location.hash || classroomHash(route.pageId, demo),
      };
    }
    case 'options':
      return {
        kind: 'options',
        stateId: route.stateId,
        title: 'Permissions rows',
        deepLink: optionsHash(route.stateId),
      };
    default:
      return { kind: 'map', stateId: 'map', title: 'State map', deepLink: '#/' };
  }
}

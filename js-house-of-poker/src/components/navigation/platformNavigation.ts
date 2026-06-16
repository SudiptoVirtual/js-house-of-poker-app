import { routes } from '../../constants/routes';
import type { RootStackParamList } from '../../types/navigation';

export type PlatformRouteName = 'Home' | 'ChatRooms' | 'Feed' | 'Friends' | 'Profile';

export const platformSwipeRoutes: PlatformRouteName[] = [
  routes.Home,
  routes.ChatRooms,
  routes.Feed,
  routes.Friends,
  routes.Profile,
];

export function getPlatformActiveRoute(
  routeName: keyof RootStackParamList | string,
): PlatformRouteName | null {
  if (routeName === routes.ChatRoomDetail) {
    return routes.ChatRooms;
  }

  return platformSwipeRoutes.includes(routeName as PlatformRouteName)
    ? (routeName as PlatformRouteName)
    : null;
}

export function isPlatformRouteActive(
  currentRouteName: keyof RootStackParamList | string,
  itemRoute: PlatformRouteName,
) {
  return getPlatformActiveRoute(currentRouteName) === itemRoute;
}

export function getAdjacentPlatformRoute(
  currentRouteName: keyof RootStackParamList | string,
  direction: 'next' | 'previous',
): PlatformRouteName | null {
  const currentIndex = platformSwipeRoutes.indexOf(currentRouteName as PlatformRouteName);

  if (currentIndex < 0) {
    return null;
  }

  const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;

  return platformSwipeRoutes[nextIndex] ?? null;
}

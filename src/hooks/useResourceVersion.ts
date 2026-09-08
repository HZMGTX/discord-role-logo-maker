import { useSyncExternalStore } from 'react';
import { resources } from '../render/resources';

/** Re-renders the component whenever an image or font finishes loading. */
export function useResourceVersion(): number {
  return useSyncExternalStore(resources.subscribe, resources.getVersion, resources.getVersion);
}

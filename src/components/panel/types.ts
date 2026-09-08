import type { IconState } from '../../model/types';

export type IconUpdater = (mutate: (draft: IconState) => void) => void;

export interface TabProps {
  icon: IconState;
  updateIcon: IconUpdater;
}

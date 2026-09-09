import { ROLE_COLORS, type FillType } from '../../model/types';
import { FillControls } from '../controls/FillControls';
import { Swatches } from '../controls/Swatches';
import type { TabProps } from './types';

const FIRST_COLOR_LABEL: Record<FillType, string> = {
  solid: 'color',
  linear: 'start color',
  radial: 'center color',
  conic: 'start color',
};

export function FillTab({ icon, updateIcon }: TabProps) {
  const { fill } = icon.background;
  return (
    <>
      <div className="section">
        <h2 className="section__title">Fill</h2>
        <FillControls
          fill={fill}
          patch={(mutate) =>
            updateIcon((draft) => {
              mutate(draft.background.fill);
            })
          }
        />
      </div>
      <div className="section">
        <h2 className="section__title">
          Discord role palette
          <span className="card__hint">sets the {FIRST_COLOR_LABEL[fill.type]}</span>
        </h2>
        <Swatches
          label="Discord role colors"
          colors={ROLE_COLORS}
          value={fill.color1}
          onChange={(hex) =>
            updateIcon((draft) => {
              draft.background.fill.color1 = hex;
            })
          }
        />
      </div>
    </>
  );
}

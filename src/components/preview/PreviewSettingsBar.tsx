import { useId } from 'react';
import { ROLE_COLORS, type PreviewSettings } from '../../model/types';
import { ColorField } from '../controls/ColorField';
import { Field } from '../controls/Field';
import { Swatches } from '../controls/Swatches';

interface PreviewSettingsBarProps {
  preview: PreviewSettings;
  onChange: (patch: Partial<PreviewSettings>) => void;
}

export function PreviewSettingsBar({ preview, onChange }: PreviewSettingsBarProps) {
  const id = useId();
  return (
    <div className="preview-settings">
      <Field label="Username" htmlFor={`${id}-user`}>
        <input
          id={`${id}-user`}
          className="input"
          value={preview.username}
          maxLength={32}
          onChange={(event) => onChange({ username: event.target.value })}
        />
      </Field>
      <Field label="Role name" htmlFor={`${id}-role`}>
        <input
          id={`${id}-role`}
          className="input"
          value={preview.roleName}
          maxLength={100}
          onChange={(event) => onChange({ roleName: event.target.value })}
        />
      </Field>
      <Field label="Message" htmlFor={`${id}-msg`} className="field--wide">
        <input
          id={`${id}-msg`}
          className="input"
          value={preview.message}
          maxLength={200}
          onChange={(event) => onChange({ message: event.target.value })}
        />
      </Field>
      <ColorField
        label="Role color"
        value={preview.roleColor}
        onChange={(roleColor) => onChange({ roleColor })}
      />
      <Field label="Discord palette" className="field--wide">
        <Swatches
          label="Discord role colors"
          colors={ROLE_COLORS}
          value={preview.roleColor}
          onChange={(roleColor) => onChange({ roleColor })}
        />
      </Field>
    </div>
  );
}

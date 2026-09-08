import type { PreviewSettings } from '../../model/types';
import { Avatar } from './Avatar';

interface MockProps {
  theme: 'dark' | 'light';
  iconUrl: string;
  preview: PreviewSettings;
}

const timestamp = (() => {
  const now = new Date();
  return `Today at ${now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
})();

function RoleIcon({ src, size }: { src: string; size: number }) {
  if (!src) return null;
  return <img className="role-icon" src={src} width={size} height={size} alt="Role icon" />;
}

export function ChatMock({ theme, iconUrl, preview }: MockProps) {
  return (
    <div className="mock" data-theme={theme}>
      <div className="mock__label">Chat · {theme}</div>
      <div className="chat">
        <div className="chat__message">
          <span className="chat__avatar">
            <Avatar name={preview.username} size={40} />
          </span>
          <div className="chat__header">
            <span className="chat__username" style={{ color: preview.roleColor }}>
              {preview.username || 'Member'}
            </span>
            <RoleIcon src={iconUrl} size={20} />
            <span className="chat__timestamp">{timestamp}</span>
          </div>
          <div className="chat__body">{preview.message || ' '}</div>
        </div>
        <div className="chat__message">
          <span className="chat__avatar">
            <Avatar name="Milo" size={40} />
          </span>
          <div className="chat__header">
            <span className="chat__username">Milo</span>
            <span className="chat__timestamp">{timestamp}</span>
          </div>
          <div className="chat__body">looks great 🔥</div>
        </div>
      </div>
    </div>
  );
}

export function MemberListMock({ theme, iconUrl, preview }: MockProps) {
  return (
    <div className="mock" data-theme={theme}>
      <div className="mock__label">Member list · {theme}</div>
      <div className="members">
        <div className="members__header">{preview.roleName || 'Role'} — 1</div>
        <div className="members__row">
          <Avatar name={preview.username} size={32} status="online" />
          <span className="members__name" style={{ color: preview.roleColor }}>
            <span>{preview.username || 'Member'}</span>
            <RoleIcon src={iconUrl} size={16} />
          </span>
        </div>
        <div className="members__header">Online — 2</div>
        <div className="members__row">
          <Avatar name="Milo" size={32} status="idle" />
          <span className="members__name">
            <span>Milo</span>
          </span>
        </div>
        <div className="members__row members__row--muted">
          <Avatar name="Sky" size={32} status="dnd" />
          <span className="members__name">
            <span>Sky</span>
          </span>
        </div>
        <div className="role-chip-row">
          <span className="role-chip">
            <span className="role-chip__dot" style={{ background: preview.roleColor }} />
            {preview.roleName || 'Role'}
            {iconUrl && <img src={iconUrl} alt="" />}
          </span>
        </div>
      </div>
    </div>
  );
}

import { ROLE_COLORS } from '../../model/types';

interface AvatarProps {
  name: string;
  size: number;
  status?: 'online' | 'idle' | 'dnd' | null;
}

function hashColor(name: string): string {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return ROLE_COLORS[hash % ROLE_COLORS.length] ?? ROLE_COLORS[0];
}

export function Avatar({ name, size, status = null }: AvatarProps) {
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: hashColor(name), fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initial}
      {status && <span className={`avatar__status${status === 'online' ? '' : ` avatar__status--${status}`}`} />}
    </span>
  );
}

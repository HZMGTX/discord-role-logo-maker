import { useCallback, useEffect, useRef, useState } from 'react';
import type { IconState } from '../model/types';

const HISTORY_LIMIT = 60;
/** Consecutive edits closer together than this collapse into one undo step. */
const COALESCE_MS = 700;

interface History {
  past: IconState[];
  present: IconState;
  future: IconState[];
}

export interface IconHistory {
  icon: IconState;
  /** Records a change. `coalesce` merges rapid edits, so dragging a slider is one step. */
  commit: (next: IconState, coalesce?: boolean) => void;
  /** Replaces the design and clears the history (loading a share link). */
  reset: (next: IconState) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/** Undo and redo for the icon, so deleting a layer is never the end of the world. */
export function useIconHistory(initial: IconState): IconHistory {
  const [state, setState] = useState<History>({ past: [], present: initial, future: [] });
  const lastEditAt = useRef(0);

  const commit = useCallback((next: IconState, coalesce = false) => {
    const now = Date.now();
    const merge = coalesce && now - lastEditAt.current < COALESCE_MS;
    lastEditAt.current = now;
    setState((s) => {
      if (s.present === next) return s;
      return {
        past: merge && s.past.length > 0 ? s.past : [...s.past, s.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const reset = useCallback((next: IconState) => {
    lastEditAt.current = 0;
    setState({ past: [], present: next, future: [] });
  }, []);

  const undo = useCallback(() => {
    lastEditAt.current = 0;
    setState((s) => {
      const previous = s.past[s.past.length - 1];
      if (!previous) return s;
      return {
        past: s.past.slice(0, -1),
        present: previous,
        future: [s.present, ...s.future].slice(0, HISTORY_LIMIT),
      };
    });
  }, []);

  const redo = useCallback(() => {
    lastEditAt.current = 0;
    setState((s) => {
      const next = s.future[0];
      if (!next) return s;
      return {
        past: [...s.past, s.present].slice(-HISTORY_LIMIT),
        present: next,
        future: s.future.slice(1),
      };
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'z') return;
      const target = event.target as HTMLElement | null;
      // Let the browser handle undo inside a field the user is typing in.
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return {
    icon: state.present,
    commit,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

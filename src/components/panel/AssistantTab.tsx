import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EXAMPLE_PROMPTS, generateIdeas, type Idea } from '../../assistant/generate';
import { refineIcon } from '../../assistant/refine';
import { RemoteError, remoteIdeas, remoteStatus, remoteTweak, type RemoteStatus } from '../../assistant/remote';
import type { IconState } from '../../model/types';
import { IconThumb } from '../controls/IconThumb';

interface AssistantTabProps {
  icon: IconState;
  /** How many times the "Ask AI" shortcut was used; focuses the prompt when it changes. */
  focusToken: number;
  onApplyIdea: (idea: Idea) => void;
  onApplyIcon: (icon: IconState, roleName?: string) => void;
}

interface Exchange {
  id: number;
  user: string;
  assistant: string;
}

interface IdeaSet {
  reply: string;
  ideas: Idea[];
  engine: 'claude' | 'local';
}

const QUICK_TWEAKS: readonly string[] = [
  'Darker',
  'Lighter',
  'Bigger',
  'Add a border',
  'Glossy',
  'Hexagon',
  'Swap colors',
  'Surprise me',
];

const TWEAK_HELP =
  "I didn't catch that. Try things like “darker”, “bigger”, “add a border”, “make it a hexagon”, “use a crown”, “make it red” or paste an emoji.";

const FALLBACK_NOTE = ' (Smart mode was unavailable just now, so the built-in engine answered.)';

let exchangeId = 0;

function fallbackNote(error: unknown): string {
  if (error instanceof RemoteError && error.code === 'rate_limited') {
    return ' (Smart mode is taking a short break because of heavy use, so the built-in engine answered.)';
  }
  return FALLBACK_NOTE;
}

export function AssistantTab({ icon, focusToken, onApplyIdea, onApplyIcon }: AssistantTabProps) {
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [tweak, setTweak] = useState('');
  const [seed, setSeed] = useState(0);
  const [result, setResult] = useState<IdeaSet | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<Exchange[]>([]);
  const [remote, setRemote] = useState<RemoteStatus | null>(null);
  const [busy, setBusy] = useState<'ideas' | 'tweak' | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void remoteStatus().then((status) => {
      if (!cancelled) setRemote(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (focusToken > 0) promptRef.current?.focus();
  }, [focusToken]);

  const say = (user: string, assistant: string) => {
    exchangeId += 1;
    setLog((current) => [...current, { id: exchangeId, user, assistant }].slice(-4));
  };

  const showIdeas = (next: IdeaSet, userText: string) => {
    setResult(next.ideas.length > 0 ? next : result);
    const first = next.ideas[0];
    if (first) {
      onApplyIdea(first);
      setSelected(first.id);
    }
    say(userText, next.reply);
  };

  const generate = async (text: string, requestedSeed: number) => {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      if (!trimmed) promptRef.current?.focus();
      return;
    }
    // Asking again for the same prompt should never hand back the same batch.
    const nextSeed = requestedSeed === 0 && trimmed === lastPrompt && result ? seed + 1 : requestedSeed;
    setLastPrompt(trimmed);
    setSeed(nextSeed);
    const userText = nextSeed === 0 ? trimmed : `${trimmed} (more ideas)`;
    if (remote?.enabled) {
      setBusy('ideas');
      try {
        const { reply, ideas } = await remoteIdeas(trimmed, 6, nextSeed);
        showIdeas({ reply, ideas, engine: 'claude' }, userText);
        return;
      } catch (error) {
        const local = generateIdeas(trimmed, nextSeed);
        showIdeas({ reply: local.reply + fallbackNote(error), ideas: local.ideas, engine: 'local' }, userText);
        return;
      } finally {
        setBusy(null);
      }
    }
    const local = generateIdeas(trimmed, nextSeed);
    showIdeas({ reply: local.reply, ideas: local.ideas, engine: 'local' }, userText);
  };

  const applyTweak = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setTweak('');
    if (remote?.enabled) {
      setBusy('tweak');
      try {
        const refined = await remoteTweak(icon, trimmed);
        onApplyIcon(refined.icon, refined.roleName);
        setSelected(null);
        say(trimmed, refined.reply);
        return;
      } catch (error) {
        const refined = refineIcon(icon, trimmed);
        if (refined) {
          onApplyIcon(refined.icon, refined.roleName);
          setSelected(null);
          say(trimmed, refined.reply + fallbackNote(error));
        } else {
          say(trimmed, TWEAK_HELP + fallbackNote(error));
        }
        return;
      } finally {
        setBusy(null);
      }
    }
    const refined = refineIcon(icon, trimmed);
    if (refined) {
      onApplyIcon(refined.icon, refined.roleName);
      setSelected(null);
      say(trimmed, refined.reply);
    } else {
      say(trimmed, TWEAK_HELP);
    }
  };

  const onPromptKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void generate(prompt, 0);
    }
  };

  const engineLabel =
    remote === null ? 'checking…' : remote.enabled ? 'smart mode · Claude' : 'built-in engine';
  const engineTitle =
    remote?.enabled
      ? `A ${remote.model ?? 'Claude'} model reads your description; the built-in engine takes over if it is unavailable.`
      : 'A built-in language engine runs in your browser. Add an API key on the server to turn on smart mode.';

  return (
    <>
      <div className="section">
        <h2 className="section__title">
          AI assistant
          <span className="card__hint" title={engineTitle} data-testid="assistant-engine">
            {engineLabel}
          </span>
        </h2>
        <p className="assistant__intro">
          Tell me who the role is for and I&apos;ll design a few icons. Mention a color, a mood, a
          shape or paste an emoji if you have one in mind.
        </p>
        <label className="visually-hidden" htmlFor="assistant-prompt">
          Describe the role
        </label>
        <textarea
          id="assistant-prompt"
          ref={promptRef}
          className="input input--area"
          rows={3}
          placeholder="e.g. a gold crown for the server owner"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onPromptKey}
          data-testid="assistant-prompt"
        />
        <div className="actions actions--row">
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => void generate(prompt, 0)}
            disabled={busy !== null}
            aria-busy={busy === 'ideas'}
            data-testid="assistant-generate"
          >
            {busy === 'ideas' ? 'Thinking…' : 'Generate ideas'}
          </button>
          {result && lastPrompt && (
            <button
              type="button"
              className="btn"
              onClick={() => void generate(lastPrompt, seed + 1)}
              disabled={busy !== null}
            >
              More ideas
            </button>
          )}
        </div>
        <div className="chip-row" role="group" aria-label="Example prompts">
          {EXAMPLE_PROMPTS.map((example) => (
            <button
              key={example}
              type="button"
              className="chip"
              disabled={busy !== null}
              onClick={() => {
                setPrompt(example);
                void generate(example, 0);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      {log.length > 0 && (
        <div className="chat-log" aria-live="polite">
          {log.map((exchange) => (
            <div key={exchange.id} className="chat-log__exchange">
              <p className="bubble bubble--user">{exchange.user}</p>
              <p className="bubble bubble--assistant">{exchange.assistant}</p>
            </div>
          ))}
          {busy && (
            <div className="chat-log__exchange" aria-hidden="true">
              <p className="bubble bubble--assistant bubble--thinking">
                {busy === 'ideas' ? 'Designing ideas…' : 'Applying your tweak…'}
              </p>
            </div>
          )}
        </div>
      )}

      {result && result.ideas.length > 0 && (
        <div className="section">
          <h2 className="section__title">
            Ideas
            <span className="card__hint">
              {result.engine === 'claude' ? 'designed by Claude · click to load' : 'click to load'}
            </span>
          </h2>
          <div className="ideas" role="group" aria-label="Generated ideas">
            {result.ideas.map((idea, index) => (
              <button
                key={idea.id}
                type="button"
                className="idea"
                aria-pressed={selected === idea.id}
                onClick={() => {
                  onApplyIdea(idea);
                  setSelected(idea.id);
                }}
                data-testid={`idea-${index}`}
              >
                <IconThumb state={idea.icon} size={56} />
                <span className="idea__caption">{idea.caption}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <h2 className="section__title">Tweak the current icon</h2>
        <div className="field__row">
          <label className="visually-hidden" htmlFor="assistant-tweak">
            Tweak instruction
          </label>
          <input
            id="assistant-tweak"
            className="input"
            placeholder="e.g. make it darker, add a border, use a skull"
            value={tweak}
            disabled={busy !== null}
            onChange={(event) => setTweak(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void applyTweak(tweak);
            }}
            data-testid="assistant-tweak"
          />
          <button
            type="button"
            className="btn"
            onClick={() => void applyTweak(tweak)}
            disabled={busy !== null}
            data-testid="assistant-apply"
          >
            {busy === 'tweak' ? 'Thinking…' : 'Apply'}
          </button>
        </div>
        <div className="chip-row" role="group" aria-label="Quick tweaks">
          {QUICK_TWEAKS.map((quick) => (
            <button
              key={quick}
              type="button"
              className="chip"
              disabled={busy !== null}
              onClick={() => void applyTweak(quick)}
            >
              {quick}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

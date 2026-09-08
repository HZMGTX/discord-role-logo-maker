import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { EXAMPLE_PROMPTS, generateIdeas, type AssistantResult, type Idea } from '../../assistant/generate';
import { refineIcon } from '../../assistant/refine';
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

let exchangeId = 0;

export function AssistantTab({ icon, focusToken, onApplyIdea, onApplyIcon }: AssistantTabProps) {
  const [prompt, setPrompt] = useState('');
  const [tweak, setTweak] = useState('');
  const [seed, setSeed] = useState(0);
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [log, setLog] = useState<Exchange[]>([]);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (focusToken > 0) promptRef.current?.focus();
  }, [focusToken]);

  const say = (user: string, assistant: string) => {
    exchangeId += 1;
    setLog((current) => [...current, { id: exchangeId, user, assistant }].slice(-4));
  };

  const generate = (text: string, nextSeed: number) => {
    const trimmed = text.trim();
    if (!trimmed) {
      promptRef.current?.focus();
      return;
    }
    const next = generateIdeas(trimmed, nextSeed);
    setResult(next);
    setSeed(nextSeed);
    const first = next.ideas[0];
    if (first) {
      onApplyIdea(first);
      setSelected(first.id);
    }
    say(nextSeed === 0 ? trimmed : `${trimmed} (more ideas)`, next.reply);
  };

  const applyTweak = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const refined = refineIcon(icon, trimmed);
    if (refined) {
      onApplyIcon(refined.icon, refined.roleName);
      setSelected(null);
      say(trimmed, refined.reply);
    } else {
      say(trimmed, TWEAK_HELP);
    }
    setTweak('');
  };

  const onPromptKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      generate(prompt, 0);
    }
  };

  return (
    <>
      <div className="section">
        <h2 className="section__title">
          AI assistant
          <span className="card__hint">runs in your browser</span>
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
            onClick={() => generate(prompt, 0)}
            data-testid="assistant-generate"
          >
            Generate ideas
          </button>
          {result && (
            <button type="button" className="btn" onClick={() => generate(result.parsed.raw, seed + 1)}>
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
              onClick={() => {
                setPrompt(example);
                generate(example, 0);
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
        </div>
      )}

      {result && (
        <div className="section">
          <h2 className="section__title">
            Ideas
            <span className="card__hint">click to load</span>
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
            onChange={(event) => setTweak(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') applyTweak(tweak);
            }}
            data-testid="assistant-tweak"
          />
          <button type="button" className="btn" onClick={() => applyTweak(tweak)} data-testid="assistant-apply">
            Apply
          </button>
        </div>
        <div className="chip-row" role="group" aria-label="Quick tweaks">
          {QUICK_TWEAKS.map((quick) => (
            <button key={quick} type="button" className="chip" onClick={() => applyTweak(quick)}>
              {quick}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

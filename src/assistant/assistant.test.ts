import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import { luminance } from '../render/color';
import { generateIdeas } from './generate';
import { parsePrompt } from './parse';
import { refineIcon } from './refine';
import { sameWord, stripPlural, tokenize, wordForms } from './tokenize';

describe('tokenize', () => {
  it('splits words, pulls out quotes, hex colors and emoji', () => {
    const t = tokenize('A "VIP" icon in #ff0000 with 🐸, please!');
    expect(t.tokens).toEqual(['a', 'icon', 'in', 'with', 'please']);
    expect(t.quoted).toEqual(['VIP']);
    expect(t.hexes).toEqual(['#ff0000']);
    expect(t.emoji).toEqual(['🐸']);
  });

  it('matches word forms', () => {
    expect(sameWord('coding', 'code')).toBe(true);
    expect(sameWord('gamers', 'game')).toBe(true);
    expect(sameWord('verified', 'verify')).toBe(true);
    expect(sameWord('streamer', 'stream')).toBe(true);
    expect(sameWord('sleepy', 'sleep')).toBe(true);
    expect(sameWord('friendly', 'friend')).toBe(true);
    expect(sameWord('edgy', 'edge')).toBe(false);
    expect(sameWord('better', 'bet')).toBe(false);
    expect(wordForms('king')).toEqual(['king']);
  });

  it('singularizes plurals', () => {
    expect(stripPlural('artists')).toBe('artist');
    expect(stripPlural('parties')).toBe('party');
    expect(stripPlural('boss')).toBe('boss');
    expect(stripPlural('foxes')).toBe('fox');
  });
});

describe('parsePrompt', () => {
  it('finds the role theme and a color', () => {
    const p = parsePrompt('a gold crown for the server owner');
    expect(p.themes[0]?.theme.id).toBe('admin');
    expect(p.contentColor?.name).toBe('gold');
    expect(p.colors).toEqual([]);
    expect(parsePrompt('a gold badge for admins').colors[0]?.name).toBe('gold');
  });

  it('finds styles, colors and plural role words', () => {
    const p = parsePrompt('cute pink icon for the artists');
    expect(p.styles.map((s) => s.id)).toContain('cute');
    expect(p.colors[0]?.name).toBe('pink');
    expect(p.themes[0]?.theme.id).toBe('artist');
  });

  it('treats shield as a shape only with a shape word next to it', () => {
    expect(parsePrompt('blue shield shape for moderators').shape).toBe('shield');
    expect(parsePrompt('a shield for moderators').shape).toBeNull();
    expect(parsePrompt('hexagon for gamers').shape).toBe('hexagon');
  });

  it('extracts text, an icon color, a background color and a style', () => {
    const p = parsePrompt('initials MD in bold white on navy');
    expect(p.text).toBe('MD');
    expect(p.contentColor?.name).toBe('white');
    expect(p.colors.map((c) => c.name)).toEqual(['navy']);
    expect(p.styles.map((s) => s.id)).toContain('bold');
    expect(p.flags.prefer).toBe('text');
  });

  it('uses a pasted emoji and a shape word', () => {
    const p = parsePrompt('🐸 on a green badge');
    expect(p.emoji).toBe('🐸');
    expect(p.shape).toBe('badge');
    expect(p.colors[0]?.name).toBe('green');
  });

  it('understands negation and color modifiers', () => {
    const p = parsePrompt('no border, dark blue hexagon');
    expect(p.flags.border).toBe(false);
    expect(p.shape).toBe('hexagon');
    expect(p.colors[0]?.name).toBe('dark blue');
    expect(luminance(p.colors[0]?.hex ?? '#000000')).toBeLessThan(luminance('#3498db'));
  });

  it('maps nouns to emoji', () => {
    const p = parsePrompt('something for dog lovers');
    expect(p.emojiWords[0]?.word).toBe('dog');
    expect(p.themes[0]?.theme.id).toBe('love');
  });

  it('scopes negation to the clause and stops at conjunctions', () => {
    expect(parsePrompt("don't make it use normal emoji").flags.prefer).toBe('symbol');
    expect(parsePrompt("make it better but don't use emoji").flags.prefer).toBe('symbol');
    expect(parsePrompt('use an emoji instead').flags.prefer).toBe('emoji');
    expect(parsePrompt('no emoji, make it a crown').themes[0]?.theme.id).toBe('admin');
    expect(parsePrompt('not a shield but a star shape').shape).toBe('star');
    expect(parsePrompt('without a border make it blue').colors[0]?.name).toBe('blue');
    expect(parsePrompt('nothing fancy, just a moderator icon').styles).toEqual([]);
    const p = tokenize('no border, dark blue hexagon');
    expect(Array.from(p.boundaries)).toEqual([2]);
  });

  it('falls back to the Unicode emoji annotations for unknown nouns', () => {
    const p = parsePrompt('an icon for the tacos and burritos committee');
    expect(p.emojiWords.map((w) => w.word)).toEqual(['taco', 'burrito']);
    const briefcase = parsePrompt('briefcase for the managers');
    expect(briefcase.emojiWords[0]).toMatchObject({ word: 'briefcase', source: 'unicode' });
    expect(briefcase.themes[0]?.theme.id).toBe('admin');
    expect(parsePrompt('magnifying glass for the detectives').emojiWords[0]?.emoji[0]).toMatch(/🔍|🔎/);
  });

  it('reads transparent backgrounds and fill words', () => {
    const p = parsePrompt('a solid red star with no background');
    expect(p.flags.transparent).toBe(true);
    expect(p.shape).toBe('none');
    expect(p.flags.fill).toBe('solid');
  });
});

describe('generateIdeas', () => {
  it('produces distinct, valid ideas that match the request', () => {
    const { ideas, reply, understood } = generateIdeas('gold crown for the server owner', 0, 6);
    expect(ideas).toHaveLength(6);
    expect(new Set(ideas.map((i) => i.caption)).size).toBe(6);
    expect(understood).toBe(true);
    expect(reply).toContain('crown');
    for (const idea of ideas) {
      expect(sanitizeIcon(JSON.parse(JSON.stringify(idea.icon)))).toEqual(idea.icon);
      expect(idea.roleName).toBe('Admin');
      const c = idea.icon.content;
      expect(c.kind === 'emoji' || c.kind === 'symbol').toBe(true);
      expect(c.kind === 'symbol' ? c.symbol : c.kind === 'emoji' ? c.emoji : '').toMatch(/crown|👑|🫅|🏰/);
    }
    for (const idea of ideas) {
      if (idea.icon.content.kind === 'symbol') expect(idea.icon.content.color).toBe('#f1c40f');
      expect(idea.icon.fill.color1).not.toBe('#f1c40f');
    }
  });

  it('respects a pasted emoji, a shape and a color', () => {
    const { ideas } = generateIdeas('🐸 on a green badge', 3, 4);
    for (const idea of ideas) {
      expect(idea.icon.shape).toBe('badge');
      expect(idea.icon.content).toMatchObject({ kind: 'emoji', emoji: '🐸' });
      expect(idea.icon.fill.color1).toBe('#2ecc71');
    }
  });

  it('puts requested text on every idea, in the requested color', () => {
    const { ideas } = generateIdeas('initials MD in bold white on navy', 0, 4);
    for (const idea of ideas) {
      expect(idea.icon.content).toMatchObject({ kind: 'text', text: 'MD', color: '#f2f3f5' });
      expect(idea.icon.fill.color1).toBe('#1b3b6f');
    }
    expect(new Set(ideas.map((i) => (i.icon.content.kind === 'text' ? i.icon.content.font : ''))).size).toBeGreaterThan(1);
  });

  it('falls back to generic ideas and says so', () => {
    const { ideas, understood, reply } = generateIdeas('asdf qwerty zxcv', 0, 6);
    expect(ideas).toHaveLength(6);
    expect(understood).toBe(false);
    expect(reply).toMatch(/couldn't tell/);
  });

  it('is deterministic for the same prompt and seed', () => {
    const a = generateIdeas('neon hexagon for gamers', 2);
    const b = generateIdeas('neon hexagon for gamers', 2);
    expect(JSON.stringify(a.ideas)).toBe(JSON.stringify(b.ideas));
    for (const idea of a.ideas) {
      expect(idea.icon.shape).toBe('hexagon');
      expect(idea.icon.shadow.enabled).toBe(true);
    }
  });

  it('keeps a shield emoji off a shield shape and names roles after nouns', () => {
    const shield = generateIdeas('shield shape for moderators', 0, 6);
    for (const idea of shield.ideas) {
      expect(idea.icon.content).not.toMatchObject({ kind: 'emoji', emoji: '🛡️' });
      expect(idea.icon.content).not.toMatchObject({ kind: 'symbol', symbol: 'shield' });
    }
    expect(generateIdeas('dog lovers', 0, 2).ideas[0]?.roleName).toBe('Dog');
    const crown = generateIdeas('gold crown on blue', 0, 6);
    const symbols = crown.ideas.filter((i) => i.icon.content.kind === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    for (const idea of symbols) expect(idea.icon.content).toMatchObject({ color: '#f1c40f' });
    for (const idea of crown.ideas) expect(idea.icon.fill.color1).toBe('#3498db');
  });

  it('handles an empty prompt', () => {
    expect(generateIdeas('', 0, 3).ideas).toHaveLength(3);
  });
});

describe('refineIcon', () => {
  it('darkens the fill', () => {
    const result = refineIcon(DEFAULT_ICON, 'make it darker');
    expect(result?.reply).toBe('Made it darker.');
    expect(luminance(result?.icon.fill.color1 ?? '#ffffff')).toBeLessThan(luminance(DEFAULT_ICON.fill.color1));
  });

  it('adds and removes a border', () => {
    const noBorder = { ...DEFAULT_ICON, border: { width: 0, color: '#ffffff' } };
    const added = refineIcon(noBorder, 'add a border');
    expect(added?.icon.border.width).toBeGreaterThan(0);
    const removed = refineIcon(DEFAULT_ICON, 'remove the border');
    expect(removed?.icon.border.width).toBe(0);
  });

  it('changes shapes', () => {
    expect(refineIcon(DEFAULT_ICON, 'hexagon')?.icon.shape).toBe('hexagon');
    expect(refineIcon(DEFAULT_ICON, 'make it a star shape')?.icon.shape).toBe('star');
    expect(refineIcon(DEFAULT_ICON, 'no background')?.icon.shape).toBe('none');
  });

  it('changes the content and colors', () => {
    const skull = refineIcon(DEFAULT_ICON, 'use a skull');
    const c = skull?.icon.content;
    expect(c && (c.kind === 'emoji' ? c.emoji === '💀' : c.kind === 'symbol' && c.symbol === 'skull')).toBe(true);
    expect(refineIcon(DEFAULT_ICON, 'make it red')?.icon.fill.color1).toBe('#e74c3c');
    const text = refineIcon(DEFAULT_ICON, 'use the letters GG');
    expect(text?.icon.content).toMatchObject({ kind: 'text', text: 'GG' });
  });

  it('does not repeat itself and colors the icon separately from the background', () => {
    expect(refineIcon(DEFAULT_ICON, 'bigger and glossy')?.reply).toBe('Made the content bigger and made it glossy.');
    const symbolIcon = { ...DEFAULT_ICON, content: { kind: 'symbol' as const, symbol: 'crown' as const, color: '#ffffff', shadow: false } };
    const recolored = refineIcon(symbolIcon, 'make the icon gold');
    expect(recolored?.icon.content).toMatchObject({ kind: 'symbol', color: '#f1c40f' });
    expect(recolored?.icon.fill.color1).toBe(DEFAULT_ICON.fill.color1);
  });

  it('polishes on "better" and swaps emoji for drawn symbols on request', () => {
    const result = refineIcon(DEFAULT_ICON, "Make it better but don't make it use normal emoji");
    expect(result?.icon.content).toMatchObject({ kind: 'symbol', symbol: 'crown' });
    expect(result?.icon.gloss).toBe(true);
    expect(result?.icon.shadow.enabled).toBe(true);
    expect(result?.reply).toMatch(/^Polished it with .* and swapped the emoji for a drawn crown\.$/);
    const back = refineIcon(result!.icon, 'use an emoji instead');
    expect(back?.icon.content).toMatchObject({ kind: 'emoji', emoji: '👑' });
    const again = refineIcon(result!.icon, 'make it better');
    expect(again?.reply).toMatch(/already has all the finishing touches/);
  });

  it('returns null when nothing is understood', () => {
    expect(refineIcon(DEFAULT_ICON, 'blah blah')).toBeNull();
    expect(refineIcon(DEFAULT_ICON, '')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_ICON } from '../model/defaults';
import { sanitizeIcon } from '../model/serialize';
import { luminance } from '../render/color';
import { generateIdeas, smallTalk } from './generate';
import { extractRoleName, parsePrompt } from './parse';
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

  it('names the role after the prompt and lets the head noun win ties', () => {
    expect(extractRoleName('Make me a icon for staff manager role')).toBe('Staff Manager');
    expect(extractRoleName('gold crown for the server owner')).toBe('Owner');
    expect(extractRoleName('cute pink icon for the artists')).toBe('Artists');
    expect(extractRoleName('blue shield shape for moderators, professional')).toBe('Moderators');
    expect(extractRoleName('something for the minecraft builders')).toBe('Minecraft Builders');
    expect(extractRoleName('a role for people who stream on twitch at night')).toBeNull();
    expect(extractRoleName('🐸 on a green badge')).toBeNull();
    expect(extractRoleName('role called "Night Watch"')).toBe('Night Watch');
    const p = parsePrompt('Make me a icon for staff manager role');
    expect(p.themes[0]?.theme.id).toBe('admin');
    expect(p.themes[1]?.theme.id).toBe('moderator');
    expect(p.emojiWords).toEqual([]);
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
      expect(idea.roleName).toBe('Owner');
      const c = idea.icon.layers[0]?.content;
      expect(c?.kind === 'emoji' || c?.kind === 'symbol').toBe(true);
      const mark = c?.kind === 'symbol' ? c.symbol : c?.kind === 'emoji' ? c.emoji : '';
      expect(mark).toMatch(/crown|👑|🫅|🏰/);
    }
    for (const idea of ideas) {
      const content = idea.icon.layers[0]?.content;
      if (content?.kind === 'symbol') expect(content.color).toBe('#f1c40f');
      expect(idea.icon.background.fill.color1).not.toBe('#f1c40f');
    }
  });

  it('respects a pasted emoji, a shape and a color', () => {
    const { ideas } = generateIdeas('🐸 on a green badge', 3, 4);
    for (const idea of ideas) {
      expect(idea.icon.background.shape).toBe('badge');
      expect(idea.icon.layers[0]?.content).toMatchObject({ kind: 'emoji', emoji: '🐸' });
      expect(idea.icon.background.fill.color1).toBe('#2ecc71');
    }
  });

  it('puts requested text on every idea, in the requested color', () => {
    const { ideas } = generateIdeas('initials MD in bold white on navy', 0, 4);
    for (const idea of ideas) {
      expect(idea.icon.layers[0]?.content).toMatchObject({ kind: 'text', text: 'MD', color: '#f2f3f5' });
      expect(idea.icon.background.fill.color1).toBe('#1b3b6f');
    }
    expect(new Set(ideas.map((i) => (i.icon.layers[0]?.content.kind === 'text' ? i.icon.layers[0]?.content.font : ''))).size).toBeGreaterThan(1);
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
      expect(idea.icon.background.shape).toBe('hexagon');
      expect(idea.icon.background.shadow.enabled).toBe(true);
    }
  });

  it('keeps a shield emoji off a shield shape and names roles after nouns', () => {
    const shield = generateIdeas('shield shape for moderators', 0, 6);
    for (const idea of shield.ideas) {
      expect(idea.icon.layers[0]?.content).not.toMatchObject({ kind: 'emoji', emoji: '🛡️' });
      expect(idea.icon.layers[0]?.content).not.toMatchObject({ kind: 'symbol', symbol: 'shield' });
    }
    expect(generateIdeas('dog lovers', 0, 2).ideas[0]?.roleName).toBe('Dog Lovers');
    const staff = generateIdeas('Make me a icon for staff manager role', 0, 6);
    expect(staff.ideas[0]?.roleName).toBe('Staff Manager');
    expect(staff.reply).toMatch(/^Here are 6 ideas for Staff Manager\./);
    expect(staff.ideas.some((i) => i.icon.layers[0]?.content.kind === 'symbol' && i.icon.layers[0]?.content.symbol === 'crown')).toBe(true);
    const crown = generateIdeas('gold crown on blue', 0, 6);
    const symbols = crown.ideas.filter((i) => i.icon.layers[0]?.content.kind === 'symbol');
    expect(symbols.length).toBeGreaterThan(0);
    for (const idea of symbols) expect(idea.icon.layers[0]?.content).toMatchObject({ color: '#f1c40f' });
    for (const idea of crown.ideas) expect(idea.icon.background.fill.color1).toBe('#3498db');
  });

  it('gives a different batch on later rounds while staying deterministic per round', () => {
    const first = generateIdeas('gold crown for the server owner', 0);
    const second = generateIdeas('gold crown for the server owner', 1);
    const third = generateIdeas('gold crown for the server owner', 2);
    const captions = (r: ReturnType<typeof generateIdeas>) => r.ideas.map((i) => i.caption).join('|');
    expect(captions(first)).not.toBe(captions(second));
    expect(captions(second)).not.toBe(captions(third));
    expect(captions(generateIdeas('gold crown for the server owner', 1))).toBe(captions(second));
    expect(second.reply).toMatch(/^Here are 6 more ideas/);
    for (const idea of [...second.ideas, ...third.ideas]) {
      expect(idea.icon.layers[0]?.content.kind === 'symbol' ? idea.icon.layers[0]?.content.symbol : idea.icon.layers[0]?.content.kind === 'emoji' ? idea.icon.layers[0]?.content.emoji : '').toMatch(/crown|👑|🫅|🏰/);
    }
  });

  it('answers greetings and questions instead of designing', () => {
    const hi = generateIdeas('hi', 0);
    expect(hi.ideas).toEqual([]);
    expect(hi.reply).toMatch(/Tell me who the role is for/);
    expect(generateIdeas('what can you do?', 0).reply).toMatch(/Describe the role/);
    expect(generateIdeas('thanks!', 0).reply).toMatch(/welcome/);
    expect(smallTalk('help me make a hero icon', parsePrompt('help me make a hero icon'))).toBeNull();
    expect(generateIdeas('help me make a hero icon', 0).ideas).toHaveLength(6);
  });

  it('handles an empty prompt', () => {
    expect(generateIdeas('', 0, 3).ideas).toHaveLength(3);
  });
});

describe('refineIcon', () => {
  it('darkens the fill', () => {
    const result = refineIcon(DEFAULT_ICON, 'make it darker');
    expect(result?.reply).toBe('Made it darker.');
    expect(luminance(result?.icon.background.fill.color1 ?? '#ffffff')).toBeLessThan(luminance(DEFAULT_ICON.background.fill.color1));
  });

  it('adds and removes a border', () => {
    const noBorder = {
      ...DEFAULT_ICON,
      background: { ...DEFAULT_ICON.background, border: { width: 0, color: '#ffffff' } },
    };
    const added = refineIcon(noBorder, 'add a border');
    expect(added?.icon.background.border.width).toBeGreaterThan(0);
    const removed = refineIcon(DEFAULT_ICON, 'remove the border');
    expect(removed?.icon.background.border.width).toBe(0);
  });

  it('changes shapes', () => {
    expect(refineIcon(DEFAULT_ICON, 'hexagon')?.icon.background.shape).toBe('hexagon');
    expect(refineIcon(DEFAULT_ICON, 'make it a star shape')?.icon.background.shape).toBe('star');
    expect(refineIcon(DEFAULT_ICON, 'no background')?.icon.background.shape).toBe('none');
  });

  it('changes the content and colors', () => {
    const skull = refineIcon(DEFAULT_ICON, 'use a skull');
    const c = skull?.icon.layers[0]?.content;
    expect(c && (c.kind === 'emoji' ? c.emoji === '💀' : c.kind === 'symbol' && c.symbol === 'skull')).toBe(true);
    expect(refineIcon(DEFAULT_ICON, 'make it red')?.icon.background.fill.color1).toBe('#e74c3c');
    const text = refineIcon(DEFAULT_ICON, 'use the letters GG');
    expect(text?.icon.layers[0]?.content).toMatchObject({ kind: 'text', text: 'GG' });
  });

  it('does not repeat itself and colors the icon separately from the background', () => {
    expect(refineIcon(DEFAULT_ICON, 'bigger and glossy')?.reply).toBe('Made the content bigger and made it glossy.');
    const symbolIcon = {
      ...DEFAULT_ICON,
      layers: [
        {
          ...DEFAULT_ICON.layers[0]!,
          content: { kind: 'symbol' as const, symbol: 'crown' as const, color: '#ffffff', shadow: false },
        },
      ],
    };
    const recolored = refineIcon(symbolIcon, 'make the icon gold');
    expect(recolored?.icon.layers[0]?.content).toMatchObject({ kind: 'symbol', color: '#f1c40f' });
    expect(recolored?.icon.background.fill.color1).toBe(DEFAULT_ICON.background.fill.color1);
  });

  it('polishes on "better" and swaps emoji for drawn symbols on request', () => {
    const result = refineIcon(DEFAULT_ICON, "Make it better but don't make it use normal emoji");
    expect(result?.icon.layers[0]?.content).toMatchObject({ kind: 'symbol', symbol: 'crown' });
    expect(result?.icon.background.gloss).toBe(true);
    expect(result?.icon.background.shadow.enabled).toBe(true);
    expect(result?.reply).toMatch(/^Polished it with .* and swapped the emoji for a drawn crown\.$/);
    const back = refineIcon(result!.icon, 'use an emoji instead');
    expect(back?.icon.layers[0]?.content).toMatchObject({ kind: 'emoji', emoji: '👑' });
    const again = refineIcon(result!.icon, 'make it better');
    expect(again?.reply).toMatch(/already has all the finishing touches/);
  });

  it('returns null when nothing is understood', () => {
    expect(refineIcon(DEFAULT_ICON, 'blah blah')).toBeNull();
    expect(refineIcon(DEFAULT_ICON, '')).toBeNull();
  });
});

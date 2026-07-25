// @vitest-environment node
// The consent gate's decision + queue core (apps/desktop/src/external-consent.ts).
// Wire-level behavior (headers, responses, IPC) is covered in
// fast-paste-bridge.test.ts; this file pins the state machine.
import { describe, expect, it, vi } from 'vitest';
import {
  ConsentGate,
  parseAppId,
  type PromptOutcome,
} from '../../apps/desktop/src/external-consent.js';

function makeGate(outcomes: PromptOutcome[]): {
  gate: ConsentGate;
  prompts: string[];
  seen: string[];
} {
  const prompts: string[] = [];
  const seen: string[] = [];
  const gate = new ConsentGate({
    prompt: (appId) => {
      prompts.push(appId);
      return Promise.resolve(outcomes.shift() ?? 'dismissed');
    },
    recordSeen: (appId) => seen.push(appId),
  });
  return { gate, prompts, seen };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('parseAppId', () => {
  it('accepts well-formed ids and rejects everything else', () => {
    expect(parseAppId('ebb')).toBe('ebb');
    expect(parseAppId('fast-debate-paste')).toBe('fast-debate-paste');
    expect(parseAppId(['ebb', 'other'])).toBe('ebb');
    expect(parseAppId(undefined)).toBeNull();
    expect(parseAppId('')).toBeNull();
    expect(parseAppId('Ebb')).toBeNull();
    expect(parseAppId('-ebb')).toBeNull();
    expect(parseAppId('a'.repeat(65))).toBeNull();
    expect(parseAppId('sp ace')).toBeNull();
  });
});

describe('ConsentGate.check', () => {
  it('maps identity + mirror state to dispositions, side-effect-free', () => {
    const { gate, seen } = makeGate([]);
    gate.setState({ policy: 'ask', apps: { good: 'allow', bad: 'deny' } });
    expect(gate.check(null)).toBe('unidentified');
    expect(gate.check('good')).toBe('allow');
    expect(gate.check('bad')).toBe('deny');
    expect(gate.check('stranger')).toBe('ask');
    gate.setState({ policy: 'off', apps: { good: 'allow' } });
    expect(gate.check('good')).toBe('off');
    expect(gate.check(null)).toBe('off');
    expect(seen).toEqual([]);
  });

  it("policy 'open' allows everyone — even unidentified and denied apps", () => {
    const { gate } = makeGate([]);
    gate.setState({ policy: 'open', apps: { bad: 'deny' } });
    expect(gate.check(null)).toBe('allow');
    expect(gate.check('bad')).toBe('allow');
    expect(gate.check('stranger')).toBe('allow');
  });
});

describe('ConsentGate queue + prompt', () => {
  it('allow-always flushes the queue in order and remembers optimistically', async () => {
    const { gate, prompts, seen } = makeGate(['allow-always']);
    const ran: number[] = [];
    expect(gate.enqueue('newapp', () => ran.push(1))).toBe(true);
    expect(gate.enqueue('newapp', () => ran.push(2))).toBe(true);
    await tick();
    expect(prompts).toEqual(['newapp']); // ONE prompt for both requests
    expect(ran).toEqual([1, 2]);
    expect(seen).toEqual(['newapp']);
    // Optimistic mirror: an immediate next request is allowed without
    // waiting for the renderer's settings sync round trip.
    expect(gate.check('newapp')).toBe('allow');
  });

  it('allow-once flushes but does not remember — next contact asks again', async () => {
    const { gate, prompts } = makeGate(['allow-once', 'deny']);
    const ran: number[] = [];
    gate.enqueue('newapp', () => ran.push(1));
    await tick();
    expect(ran).toEqual([1]);
    expect(gate.check('newapp')).toBe('ask');
    gate.enqueue('newapp', () => ran.push(2));
    await tick();
    expect(prompts).toEqual(['newapp', 'newapp']);
    expect(ran).toEqual([1]); // second batch was denied → discarded
    expect(gate.check('newapp')).toBe('deny');
  });

  it('deny discards the queue and remembers', async () => {
    const { gate, seen } = makeGate(['deny']);
    const ran: number[] = [];
    gate.enqueue('newapp', () => ran.push(1));
    await tick();
    expect(ran).toEqual([]);
    expect(seen).toEqual([]);
    expect(gate.check('newapp')).toBe('deny');
  });

  it('dismissed discards the queue and records nothing', async () => {
    const { gate } = makeGate(['dismissed']);
    const ran: number[] = [];
    gate.enqueue('newapp', () => ran.push(1));
    await tick();
    expect(ran).toEqual([]);
    expect(gate.check('newapp')).toBe('ask'); // asks again next time
  });

  it('caps the per-app queue at 10', async () => {
    const { gate, prompts } = makeGate(['allow-always']);
    const ran: number[] = [];
    for (let i = 0; i < 10; i++) {
      expect(gate.enqueue('newapp', () => ran.push(i))).toBe(true);
    }
    expect(gate.enqueue('newapp', () => ran.push(99))).toBe(false);
    await tick();
    expect(prompts).toEqual(['newapp']);
    expect(ran).toHaveLength(10);
    expect(ran).not.toContain(99);
  });

  it('a throwing queued action does not break the rest of the flush', async () => {
    const { gate } = makeGate(['allow-once']);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ran: number[] = [];
    gate.enqueue('newapp', () => {
      throw new Error('boom');
    });
    gate.enqueue('newapp', () => ran.push(2));
    await tick();
    expect(ran).toEqual([2]);
    errSpy.mockRestore();
  });

  it('a rejecting prompt is treated as dismissed', async () => {
    const gate = new ConsentGate({
      prompt: () => Promise.reject(new Error('window gone')),
      recordSeen: () => {},
    });
    const ran: number[] = [];
    gate.enqueue('newapp', () => ran.push(1));
    await tick();
    expect(ran).toEqual([]);
    expect(gate.check('newapp')).toBe('ask');
  });
});

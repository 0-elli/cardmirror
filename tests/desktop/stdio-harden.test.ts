// @vitest-environment node
/**
 * EPIPE-proof stdio (stdio-harden.ts). Field report 2026-08-06
 * (Linux): with the launching pipe closed, Electron's own
 * console.error inside ipcMain's replyWithError raised EPIPE as an
 * UNCAUGHT exception — the "JavaScript error in the main process"
 * dialog on every refused save, masking the real error. The guard's
 * whole job is: a stream error event must not throw once installed.
 */
import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { swallowStreamErrors } from '../../apps/desktop/src/stdio-harden.js';

function epipe(): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error('write EPIPE');
  err.code = 'EPIPE';
  return err;
}

describe('swallowStreamErrors', () => {
  it("an unhandled 'error' event throws (the failure mode being fixed)", () => {
    const stream = new EventEmitter();
    expect(() => stream.emit('error', epipe())).toThrow(/EPIPE/);
  });

  it('with the guard installed, EPIPE is consumed silently', () => {
    const stream = new EventEmitter();
    swallowStreamErrors(stream);
    expect(() => stream.emit('error', epipe())).not.toThrow();
  });

  it('other stream errors are consumed too — logging never crashes the app', () => {
    const stream = new EventEmitter();
    swallowStreamErrors(stream);
    const err: NodeJS.ErrnoException = new Error('write EIO');
    err.code = 'EIO';
    expect(() => stream.emit('error', err)).not.toThrow();
  });
});

import { describe, it, expect, beforeEach } from 'bun:test';
import { ApiClient } from '../../src/api.js';

describe('ApiClient', () => {
  let client: ApiClient;

  beforeEach(() => {
    client = new ApiClient({ serverUrl: 'http://localhost:3000' });
  });

  it('should create client instance', () => {
    expect(client).toBeDefined();
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should have session methods', () => {
    expect(typeof client.listSessions).toBe('function');
    expect(typeof client.createSession).toBe('function');
    expect(typeof client.getSession).toBe('function');
    expect(typeof client.deleteSession).toBe('function');
    expect(typeof client.renameSession).toBe('function');
  });

  it('should have chat methods', () => {
    expect(typeof client.agentChat).toBe('function');
    expect(typeof client.abortAgent).toBe('function');
  });

  it('should have health check method', () => {
    expect(typeof client.health).toBe('function');
  });
});

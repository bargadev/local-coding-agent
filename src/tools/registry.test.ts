import { describe, it, expect } from 'vitest';
import { parseToolCall, executeTool } from './registry.js';

describe('parseToolCall', () => {
  it('parses a valid tool call', () => {
    const r = parseToolCall('{"tool":"list_files","args":{"path":"."}}');
    expect(r?.tool).toBe('list_files');
    expect(r?.args.path).toBe('.');
  });

  it('returns null for plain text', () => {
    expect(parseToolCall('I will now list the files')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseToolCall('{broken json')).toBeNull();
  });

  it('returns null for JSON without tool field', () => {
    expect(parseToolCall('{"action":"list"}')).toBeNull();
  });
});

describe('executeTool', () => {
  it('returns error for unknown tool', () => {
    const r = executeTool({ tool: 'nonexistent', args: {} });
    expect(r).toContain('Unknown tool');
  });

  it('runs list_files without crashing', () => {
    const r = executeTool({ tool: 'list_files', args: { path: '.' } });
    expect(typeof r).toBe('string');
  });

  it('runs run_command echo', () => {
    const r = executeTool({ tool: 'run_command', args: { command: 'echo ping' } });
    expect(r).toContain('ping');
  });
});

import { z } from 'zod';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

/**
 * Advertise tool schemas as JSON Schema draft-2020-12.
 *
 * The MCP SDK converts our Zod schemas itself, and it labels the result
 * draft-07: `McpServer`'s tools/list handler calls `toJsonSchemaCompat()` without
 * a target, and that helper's `mapMiniTarget(undefined)` falls back to
 * `'draft-7'`. Every version from 1.20 through 1.30 does this — before 1.23 by
 * running everything through `zod-to-json-schema`, after it by asking Zod v4 Mini
 * for the draft-07 target. So the wire always carried
 * `"$schema": "http://json-schema.org/draft-07/schema#"`.
 *
 * Clients that validate a tool's `outputSchema` against a 2020-12-only validator
 * then reject the tool before it is ever called. Claude Code / Cowork does this
 * with Ajv 2020 and fails with:
 *
 *   Tool 'sap_note_fetch' has an invalid outputSchema: JSON Schema declares an
 *   unsupported dialect ("$schema": "http://json-schema.org/draft-07/schema#").
 *
 * The MCP specification says nothing about draft-07, and 2020-12 is what the
 * schema bodies we emit actually conform to, so the fix is to convert them
 * ourselves — Zod v4's `toJSONSchema` targets 2020-12 — and swap them into the
 * tools/list response on the way out. Tool behaviour and the structured content
 * we return are unchanged; only the advertised dialect is.
 *
 * Remove this once the SDK stops defaulting to draft-07; the contract test
 * asserts the dialect, so a regression is visible either way.
 */

export interface ToolSchemaOverride {
  inputSchema?: unknown;
  outputSchema?: unknown;
}

export type ToolSchemaOverrides = Record<string, ToolSchemaOverride>;

/** Convert a Zod raw shape into a draft-2020-12 JSON Schema. */
export function toJsonSchema2020(shape: z.ZodRawShape, io: 'input' | 'output'): unknown {
  return z.toJSONSchema(z.object(shape), { io, target: 'draft-2020-12' });
}

/**
 * Wrap a transport so tools/list responses carry the schemas above.
 *
 * Done at the transport rather than at registration because `registerTool` hands
 * the Zod shapes to the SDK and the conversion happens inside it, out of reach.
 * Unknown tool names are left alone.
 */
export function patchToolSchemas<T extends Transport>(transport: T, overrides: ToolSchemaOverrides): T {
  const originalSend = transport.send.bind(transport);

  transport.send = async (
    message: Parameters<Transport['send']>[0],
    options?: Parameters<Transport['send']>[1]
  ) => {
    const tools = (message as { result?: { tools?: Array<Record<string, unknown>> } })?.result?.tools;
    if (Array.isArray(tools)) {
      for (const tool of tools) {
        const override = overrides[String(tool?.name)];
        if (!override) continue;
        if (override.inputSchema) tool.inputSchema = override.inputSchema;
        if (override.outputSchema) tool.outputSchema = override.outputSchema;
      }
    }
    return originalSend(message, options);
  };

  return transport;
}

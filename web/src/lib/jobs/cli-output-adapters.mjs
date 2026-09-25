/** @typedef {{type: "command", command: unknown} | {type: "tool", name: unknown} | {type: "ready"} | {type: "usage", tokens: number, costUsd?: number} | {type: "text", text: string} | {type: "final-text", text: string}} CliOutputEvent */

/** @param {string} line */
function parseLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

/** Normalize provider-specific stream formats into stable worker events. */
/** @param {string} cliId */
export function createCliOutputAdapter(cliId) {
  let buffer = "";
  let codexFinalText = "";

  /** @param {string} line @returns {CliOutputEvent[]} */
  function consume(line) {
    const value = line.trim();
    if (!value) return [];
    if (cliId === "codex") {
      const event = parseLine(value);
      if (!event) return [];
      if (event.type === "item.started" && event.item?.type === "command_execution") return [{ type: "command", command: event.item.command }];
      if (event.type === "item.completed" && event.item?.type === "agent_message" && typeof event.item.text === "string") {
        codexFinalText = event.item.text;
        return [];
      }
      if (event.type === "turn.completed") {
        const usage = event.usage || {};
        return [{ type: "usage", tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_write_input_tokens || 0) }];
      }
      return [];
    }
    if (cliId !== "claude") return [{ type: "text", text: `${line}\n` }];
    const event = parseLine(value);
    if (!event) return [];
    if (event.type === "stream_event") {
      const inner = event.event;
      if (inner?.type === "content_block_start" && inner.content_block?.type === "tool_use") return [{ type: "tool", name: inner.content_block.name }];
      if (inner?.type === "content_block_delta" && typeof inner.delta?.text === "string") return [{ type: "text", text: inner.delta.text }];
    }
    if (event.type === "system" && event.subtype === "init") return [{ type: "ready" }];
    if (event.type === "result") {
      const usage = event.usage || {};
      return [{ type: "usage", tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) + (usage.cache_creation_input_tokens || 0), costUsd: typeof event.total_cost_usd === "number" ? event.total_cost_usd : undefined }];
    }
    return [];
  }

  return {
    /** @param {string} chunk @returns {CliOutputEvent[]} */
    push(chunk) {
      if (cliId !== "claude" && cliId !== "codex") return [{ type: "text", text: String(chunk) }];
      buffer += String(chunk);
      const events = [];
      let newline;
      while ((newline = buffer.indexOf("\n")) !== -1) {
        events.push(...consume(buffer.slice(0, newline)));
        buffer = buffer.slice(newline + 1);
      }
      return events;
    },
    /** @returns {CliOutputEvent[]} */
    finish() {
      const events = [];
      if ((cliId === "claude" || cliId === "codex") && buffer) events.push(...consume(buffer));
      buffer = "";
      if (cliId === "codex" && codexFinalText) events.push({ type: "final-text", text: codexFinalText });
      return events;
    },
  };
}

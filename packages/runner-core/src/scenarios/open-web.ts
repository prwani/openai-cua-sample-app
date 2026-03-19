import { type ExecutionMode } from "@cua-sample/replay-schema";

import {
  buildOpenWebCodeInstructions,
  buildOpenWebNativeInstructions,
  buildOpenWebRunnerPrompt,
} from "../open-web-plan.js";
import {
  createDefaultResponsesClient,
  runResponsesCodeLoop,
  runResponsesNativeComputerLoop,
} from "../responses-loop.js";
import {
  failLiveResponsesUnavailable,
  runRemoteBrowserFlow,
  type RunExecutionContext,
  type RunExecutor,
} from "../scenario-runtime.js";

const liveOnlyMessage =
  "Open Web Task requires the live Responses API. Deterministic fallback is disabled to keep the operator prompt as the only source of truth.";

class OpenWebCodeExecutor implements RunExecutor {
  async execute(context: RunExecutionContext) {
    const client = createDefaultResponsesClient();

    if (!client) {
      await failLiveResponsesUnavailable(context, liveOnlyMessage);
      return;
    }

    await context.emitEvent({
      detail: context.detail.run.model,
      level: "ok",
      message: "Using the live Responses API code loop for the open web task.",
      type: "run_progress",
    });

    await runRemoteBrowserFlow(context, {
      completedScreenshotLabel: "open-web-completed",
      loadedScreenshotLabel: "open-web-loaded",
      navigationMessage: "Browser navigated to the operator-supplied URL.",
      runner: async ({ session, startUrl }) => {
        const result = await runResponsesCodeLoop(
          {
            context,
            instructions: buildOpenWebCodeInstructions(session.page.url()),
            maxResponseTurns: context.detail.run.maxResponseTurns ?? 24,
            prompt: buildOpenWebRunnerPrompt(context.detail.run.prompt),
            session,
          },
          client,
        );

        return {
          notes: [`Started from ${startUrl}`, ...result.notes],
        };
      },
      sessionLabel: "operator-supplied URL",
    });
  }
}

class OpenWebNativeExecutor implements RunExecutor {
  async execute(context: RunExecutionContext) {
    const client = createDefaultResponsesClient();

    if (!client) {
      await failLiveResponsesUnavailable(context, liveOnlyMessage);
      return;
    }

    await context.emitEvent({
      detail: context.detail.run.model,
      level: "ok",
      message: "Using the live Responses API native computer loop for the open web task.",
      type: "run_progress",
    });

    await runRemoteBrowserFlow(context, {
      completedScreenshotLabel: "open-web-completed",
      loadedScreenshotLabel: "open-web-loaded",
      navigationMessage: "Browser navigated to the operator-supplied URL.",
      runner: async ({ session, startUrl }) => {
        const result = await runResponsesNativeComputerLoop(
          {
            context,
            instructions: buildOpenWebNativeInstructions(session.page.url()),
            maxResponseTurns: context.detail.run.maxResponseTurns ?? 24,
            prompt: buildOpenWebRunnerPrompt(context.detail.run.prompt),
            session,
          },
          client,
        );

        return {
          notes: [`Started from ${startUrl}`, ...result.notes],
        };
      },
      sessionLabel: "operator-supplied URL",
    });
  }
}

export function createOpenWebExecutor(mode: ExecutionMode): RunExecutor {
  switch (mode) {
    case "code":
      return new OpenWebCodeExecutor();
    case "native":
      return new OpenWebNativeExecutor();
  }
}

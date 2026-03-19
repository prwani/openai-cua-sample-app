import { afterEach, describe, expect, it } from "vitest";

import { RunnerCoreError } from "../src/errors.js";
import {
  createDefaultResponsesClient,
  resolveDefaultResponsesClientConfig,
  runResponsesCodeLoop,
  runResponsesNativeComputerLoop,
} from "../src/responses-loop.js";

const originalEnv = {
  AZURE_OPENAI_API_VERSION: process.env.AZURE_OPENAI_API_VERSION,
  AZURE_OPENAI_BASE_URL: process.env.AZURE_OPENAI_BASE_URL,
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_RESPONSES_URL: process.env.AZURE_OPENAI_RESPONSES_URL,
  AZURE_OPENAI_SCOPE: process.env.AZURE_OPENAI_SCOPE,
  CUA_RESPONSES_MODE: process.env.CUA_RESPONSES_MODE,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
  OPENAI_API_VERSION: process.env.OPENAI_API_VERSION,
  VITEST: process.env.VITEST,
};

function restoreEnvVariable(name: keyof typeof originalEnv) {
  const value = originalEnv[name];

  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

afterEach(() => {
  restoreEnvVariable("AZURE_OPENAI_API_VERSION");
  restoreEnvVariable("AZURE_OPENAI_BASE_URL");
  restoreEnvVariable("AZURE_OPENAI_ENDPOINT");
  restoreEnvVariable("AZURE_OPENAI_RESPONSES_URL");
  restoreEnvVariable("AZURE_OPENAI_SCOPE");
  restoreEnvVariable("CUA_RESPONSES_MODE");
  restoreEnvVariable("OPENAI_API_KEY");
  restoreEnvVariable("OPENAI_BASE_URL");
  restoreEnvVariable("OPENAI_API_VERSION");
  restoreEnvVariable("VITEST");
});

function createMockSession() {
  return {
    browser: {},
    context: {},
    mode: "headless" as const,
    page: {
      keyboard: {
        press: async () => undefined,
        type: async () => undefined,
      },
      mouse: {
        click: async () => undefined,
        dblclick: async () => undefined,
        down: async () => undefined,
        move: async () => undefined,
        up: async () => undefined,
        wheel: async () => undefined,
      },
      screenshot: async () => Buffer.from("png"),
      title: async () => "Mock Lab",
      url: () => "http://127.0.0.1:3102",
    },
  };
}

function createMockExecutionContext() {
  const events: Array<{ detail?: string; message: string; type: string }> = [];
  const screenshotArtifact = {
    capturedAt: new Date().toISOString(),
    id: "screenshot-1",
    label: "turn-1",
    mimeType: "image/png" as const,
    pageTitle: "Mock Lab",
    pageUrl: "http://127.0.0.1:3102",
    path: "/tmp/mock-lab.png",
    url: "/artifacts/mock-lab.png",
  };

  return {
    context: {
      captureScreenshot: async () => screenshotArtifact,
      completeRun: async () => undefined,
      detail: {
        scenario: {
          supportsCodeEdits: false,
        },
        run: {
          model: "gpt-5.4",
          prompt: "Finish the browser task and report success.",
        },
      },
      emitEvent: async (input: { detail?: string; message: string; type: string }) => {
        events.push(input);
      },
      screenshotDirectory: "/tmp",
      signal: new AbortController().signal,
      stepDelayMs: 0,
      syncBrowserState: async () => undefined,
    },
    events,
  };
}

function createConfigEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    CUA_RESPONSES_MODE: "live",
    NODE_ENV: "production",
    VITEST: "false",
    ...overrides,
  };
}

function expectRunnerCoreError(
  callback: () => unknown,
  expected: Record<string, unknown>,
) {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(RunnerCoreError);
    expect(error).toMatchObject(expected);
    return;
  }

  throw new Error("Expected RunnerCoreError to be thrown.");
}

describe("default responses client configuration", () => {
  it("returns null in test mode even when an API key exists", () => {
    process.env.CUA_RESPONSES_MODE = "auto";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.VITEST = "true";

    expect(createDefaultResponsesClient()).toBeNull();
  });

  it("returns null in auto mode when NODE_ENV is test", () => {
    expect(
      resolveDefaultResponsesClientConfig(
        createConfigEnv({
          AZURE_OPENAI_API_VERSION: "2025-04-01-preview",
          AZURE_OPENAI_ENDPOINT: "https://pw-sc-foundry.openai.azure.com/",
          CUA_RESPONSES_MODE: "auto",
          NODE_ENV: "test",
        }),
      ),
    ).toBeNull();
  });

  it("preserves the OpenAI API key path when Azure settings are absent", () => {
    expect(
      resolveDefaultResponsesClientConfig(
        createConfigEnv({
          OPENAI_API_KEY: "test-key",
          OPENAI_BASE_URL: "https://api.openai.example/v1",
        }),
      ),
    ).toEqual({
      apiKey: "test-key",
      baseURL: "https://api.openai.example/v1",
      provider: "openai",
    });
  });

  it("selects Azure when OPENAI_BASE_URL targets an Azure /openai base URL", () => {
    expect(
      resolveDefaultResponsesClientConfig(
        createConfigEnv({
          OPENAI_API_VERSION: "2025-04-01-preview",
          OPENAI_BASE_URL: "https://pw-sc-foundry.cognitiveservices.azure.com/openai",
        }),
      ),
    ).toMatchObject({
      apiVersion: "2025-04-01-preview",
      baseURL: "https://pw-sc-foundry.cognitiveservices.azure.com/openai",
      provider: "azure",
      tokenScope: "https://cognitiveservices.azure.com/.default",
    });
  });

  it("prefers Azure config over OPENAI_API_KEY when Azure settings are present", () => {
    expect(
      resolveDefaultResponsesClientConfig(
        createConfigEnv({
          AZURE_OPENAI_ENDPOINT: "https://pw-sc-foundry.openai.azure.com/",
          OPENAI_API_KEY: "test-key",
          OPENAI_API_VERSION: "2025-04-01-preview",
        }),
      ),
    ).toMatchObject({
      apiVersion: "2025-04-01-preview",
      endpoint: "https://pw-sc-foundry.openai.azure.com",
      provider: "azure",
      tokenScope: "https://cognitiveservices.azure.com/.default",
    });
  });

  it("throws a structured missing-api-key error when live mode is forced", () => {
    process.env.CUA_RESPONSES_MODE = "live";
    process.env.VITEST = "false";
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.AZURE_OPENAI_BASE_URL;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_RESPONSES_URL;
    delete process.env.AZURE_OPENAI_SCOPE;
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_VERSION;
    delete process.env.OPENAI_BASE_URL;

    expectRunnerCoreError(() => createDefaultResponsesClient(), {
      code: "missing_api_key",
      hint: expect.stringContaining("Set OPENAI_API_KEY"),
      message:
        "CUA_RESPONSES_MODE=live requires OPENAI_API_KEY or Azure OpenAI environment settings.",
    });
  });

  it("throws a structured invalid-azure-endpoint error when live mode receives a bad Azure URL", () => {
    expectRunnerCoreError(
      () =>
        resolveDefaultResponsesClientConfig(
          createConfigEnv({
            AZURE_OPENAI_ENDPOINT: "not-a-url",
          }),
        ),
      {
        code: "invalid_azure_endpoint",
        hint: expect.stringContaining("Use an HTTPS Azure resource URL"),
        message: "Azure OpenAI endpoint configuration must be a valid URL.",
      },
    );
  });

  it("throws a structured missing-azure-api-version error when live mode has Azure config without a version", () => {
    expectRunnerCoreError(
      () =>
        resolveDefaultResponsesClientConfig(
          createConfigEnv({
            AZURE_OPENAI_ENDPOINT: "https://pw-sc-foundry.openai.azure.com/",
          }),
        ),
      {
        code: "missing_azure_api_version",
        hint: expect.stringContaining(
          "Set AZURE_OPENAI_API_VERSION or OPENAI_API_VERSION",
        ),
        message: "Azure live Responses mode requires an API version.",
      },
    );
  });

  it("resolves Azure Entra config from a resource endpoint without an API key", () => {
    process.env.CUA_RESPONSES_MODE = "live";
    process.env.AZURE_OPENAI_ENDPOINT = "https://pw-sc-foundry.openai.azure.com/";
    process.env.AZURE_OPENAI_API_VERSION = "2025-04-01-preview";
    process.env.VITEST = "false";
    delete process.env.OPENAI_API_KEY;

    expect(resolveDefaultResponsesClientConfig()).toMatchObject({
      apiVersion: "2025-04-01-preview",
      endpoint: "https://pw-sc-foundry.openai.azure.com",
      provider: "azure",
      tokenScope: "https://cognitiveservices.azure.com/.default",
    });
  });

  it("normalizes a full Azure Responses URL into an Azure base URL", () => {
    process.env.CUA_RESPONSES_MODE = "live";
    process.env.AZURE_OPENAI_RESPONSES_URL =
      "https://pw-sc-foundry.cognitiveservices.azure.com/openai/responses?api-version=2025-04-01-preview";
    process.env.VITEST = "false";
    delete process.env.OPENAI_API_KEY;

    expect(resolveDefaultResponsesClientConfig()).toMatchObject({
      apiVersion: "2025-04-01-preview",
      baseURL: "https://pw-sc-foundry.cognitiveservices.azure.com/openai",
      provider: "azure",
    });
  });

  it("creates a live Azure client when Entra configuration is present", () => {
    process.env.CUA_RESPONSES_MODE = "live";
    process.env.AZURE_OPENAI_ENDPOINT = "https://pw-sc-foundry.openai.azure.com/";
    process.env.AZURE_OPENAI_API_VERSION = "2025-04-01-preview";
    process.env.VITEST = "false";
    delete process.env.OPENAI_API_KEY;

    expect(createDefaultResponsesClient()).not.toBeNull();
  });

  it("creates a live OpenAI client when OPENAI_API_KEY is present", () => {
    process.env.CUA_RESPONSES_MODE = "live";
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_BASE_URL = "https://api.openai.example/v1";
    process.env.VITEST = "false";
    delete process.env.AZURE_OPENAI_API_VERSION;
    delete process.env.AZURE_OPENAI_BASE_URL;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    delete process.env.AZURE_OPENAI_RESPONSES_URL;
    delete process.env.AZURE_OPENAI_SCOPE;
    delete process.env.OPENAI_API_VERSION;

    expect(createDefaultResponsesClient()).not.toBeNull();
  });
});

describe("runResponsesCodeLoop", () => {
  it("executes the public exec_js tool path and returns the final assistant message", async () => {
    const requests: Record<string, unknown>[] = [];
    const client = {
      async create(request: Record<string, unknown>) {
        requests.push(request);

        if (requests.length === 1) {
          return {
            id: "resp_code_1",
            output: [
              {
                arguments: JSON.stringify({
                  code: 'console.log("Board updated.");',
                }),
                call_id: "call_exec",
                name: "exec_js",
                type: "function_call" as const,
              },
            ],
          };
        }

        return {
          id: "resp_code_2",
          output: [
            {
              content: [
                {
                  text: "Board matches the requested final state.",
                  type: "output_text",
                },
              ],
              role: "assistant",
              type: "message" as const,
            },
          ],
        };
      },
    };
    const { context, events } = createMockExecutionContext();

    const result = await runResponsesCodeLoop(
      {
        context: context as never,
        instructions: "Use exec_js to update the live board, then summarize.",
        maxResponseTurns: 8,
        session: createMockSession() as never,
      },
      client,
    );

    expect(
      (requests[0]?.tools as Array<{ name?: string }>).map((tool) => tool.name),
    ).toEqual(["exec_js"]);
    expect(result.finalAssistantMessage).toBe(
      "Board matches the requested final state.",
    );
    expect(
      events.some((event) => event.type === "function_call_completed"),
    ).toBe(true);
  });
});

describe("runResponsesNativeComputerLoop", () => {
  it("continues the native loop by returning computer_call_output to the model", async () => {
    const requests: Record<string, unknown>[] = [];
    const client = {
      async create(request: Record<string, unknown>) {
        requests.push(request);

        if (requests.length === 1) {
          return {
            id: "resp_native_1",
            output: [
              {
                actions: [{ type: "screenshot" }],
                call_id: "call_1",
                type: "computer_call" as const,
              },
            ],
          };
        }

        return {
          id: "resp_native_2",
          output: [
            {
              content: [
                {
                  text: "Completed the browser task.",
                  type: "output_text",
                },
              ],
              role: "assistant",
              type: "message" as const,
            },
          ],
        };
      },
    };
    const { context, events } = createMockExecutionContext();

    const result = await runResponsesNativeComputerLoop(
      {
        context: context as never,
        instructions: "Use the computer tool until the task is complete.",
        maxResponseTurns: 8,
        session: createMockSession() as never,
      },
      client,
    );

    expect(requests).toHaveLength(2);
    expect(
      (requests[0]?.tools as Array<{ name?: string; type: string }>).map((tool) =>
        tool.type === "computer" ? "computer" : tool.name,
      ),
    ).toEqual(["computer"]);
    expect(requests[1]?.previous_response_id).toBe("resp_native_1");
    expect(requests[1]?.input).toEqual([
      {
        call_id: "call_1",
        output: {
          image_url: expect.stringContaining("data:image/png;base64,"),
          type: "computer_screenshot",
        },
        type: "computer_call_output",
      },
    ]);
    expect(result.finalAssistantMessage).toBe("Completed the browser task.");
    expect(
      events.some((event) => event.type === "computer_call_output_recorded"),
    ).toBe(true);
  });

  it("throws a stable error when the API asks for a safety acknowledgement", async () => {
    const client = {
      async create() {
        return {
          id: "resp_safety",
          output: [
            {
              actions: [{ type: "screenshot" }],
              call_id: "call_safety",
              pending_safety_checks: [
                {
                  code: "requires_ack",
                  message: "Approve the action before continuing.",
                },
              ],
              type: "computer_call" as const,
            },
          ],
        };
      },
    };
    const { context } = createMockExecutionContext();

    await expect(
      runResponsesNativeComputerLoop(
        {
          context: context as never,
          instructions: "Use the computer tool until the task is complete.",
          maxResponseTurns: 4,
          session: createMockSession() as never,
        },
        client,
      ),
    ).rejects.toMatchObject({
      code: "unsupported_safety_acknowledgement",
      hint: expect.stringContaining("does not implement operator approval"),
      message: expect.stringContaining("Pending computer use safety checks"),
      name: "RunnerCoreError",
    });
  });
});

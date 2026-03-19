export function buildOpenWebRunnerPrompt(prompt: string) {
  return prompt.trim();
}

export function buildOpenWebCodeInstructions(currentUrl: string) {
  return [
    "You are operating a persistent Playwright browser session for a GPT-5.4 CUA demo harness.",
    "You must use the exec_js tool before you answer.",
    `The operator-supplied URL is already open at ${currentUrl}.`,
    "Use only the operator prompt as the source of truth.",
    "Complete the requested browser task using the live website and any navigation you need from the loaded page.",
    "Do not rely on local lab helpers, hidden app state, or workspace files.",
    "Reply briefly once the task is complete.",
  ].join("\n");
}

export function buildOpenWebNativeInstructions(currentUrl: string) {
  return [
    "You are controlling a browser through the built-in computer tool.",
    `The operator-supplied URL is already open at ${currentUrl}.`,
    "Use only the operator prompt as the source of truth.",
    "Complete the requested browser task using the live website and any navigation you need from the loaded page.",
    "Do not rely on local lab helpers, hidden app state, or workspace files.",
    "Reply briefly once the task is complete.",
  ].join("\n");
}

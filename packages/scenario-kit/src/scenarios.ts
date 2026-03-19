import { fileURLToPath } from "node:url";

import {
  scenarioManifestSchema,
  type ScenarioCategory,
  type ScenarioManifest,
} from "@cua-sample/replay-schema";

import { bookingDefaultPrompt } from "./booking.js";
import { kanbanDefaultPrompt } from "./kanban.js";
import { openWebDefaultPrompt } from "./open-web.js";
import { paintDefaultPrompt } from "./paint.js";

const templatePath = (labDirectory: string) =>
  fileURLToPath(new URL(`../../../labs/${labDirectory}`, import.meta.url));

const scenarioCatalog = scenarioManifestSchema.array().parse([
  {
    id: "kanban-reprioritize-sprint",
    labId: "kanban",
    category: "productivity",
    title: "Launch Planner",
    description:
      "Move cards across columns and reorder the sprint board to match the final board state written in the operator prompt.",
    defaultPrompt: kanbanDefaultPrompt,
    workspaceTemplatePath: templatePath("kanban-lab-template"),
    startTarget: {
      kind: "remote_url",
      label: "run-scoped HTTP kanban lab",
      url: "http://127.0.0.1:3102",
    },
    defaultMode: "code",
    requiresStartUrl: false,
    supportsCodeEdits: false,
    verification: [
      {
        id: "kanban-board-state",
        kind: "board_state",
        description:
          "The final board state matches the required card ordering and column placement.",
      },
    ],
    tags: ["hero", "productivity", "drag-drop"],
  },
  {
    id: "paint-draw-poster",
    labId: "paint",
    category: "creativity",
    title: "Sketch Studio",
    description:
      "Use a paint-like interface to create a simple prompt-driven sketch with precise cursor control.",
    defaultPrompt: paintDefaultPrompt,
    workspaceTemplatePath: templatePath("paint-lab-template"),
    startTarget: {
      kind: "remote_url",
      label: "run-scoped HTTP paint lab",
      url: "http://127.0.0.1:3103",
    },
    defaultMode: "code",
    requiresStartUrl: false,
    supportsCodeEdits: false,
    verification: [
      {
        id: "paint-canvas-state",
        kind: "canvas_state",
        description:
          "The saved artwork exists and matches the live canvas state at the end of the run.",
      },
    ],
    tags: ["hero", "creativity", "canvas"],
  },
  {
    id: "booking-complete-reservation",
    labId: "booking",
    category: "commerce",
    title: "Northstar Stays",
    description:
      "Search inventory, apply the requested filters, complete the reservation form, and land on a matching local confirmation using only the operator prompt.",
    defaultPrompt: bookingDefaultPrompt,
    workspaceTemplatePath: templatePath("booking-lab-template"),
    startTarget: {
      kind: "remote_url",
      label: "run-scoped HTTP booking lab",
      url: "http://127.0.0.1:3104",
    },
    defaultMode: "code",
    requiresStartUrl: false,
    supportsCodeEdits: false,
    verification: [
      {
        id: "booking-record",
        kind: "booking_record",
        description:
          "The local confirmation record and applied filters match the hotel, guest, dates, and requirements in the operator prompt.",
      },
    ],
    tags: ["hero", "commerce", "forms"],
  },
  {
    id: "open-web-task",
    labId: "open_web",
    category: "general",
    title: "Open Web Task",
    description:
      "Launch an operator-supplied URL and complete a one-off browser task using only the operator prompt and live page state.",
    defaultPrompt: openWebDefaultPrompt,
    workspaceTemplatePath: templatePath("open-web-template"),
    startTarget: {
      kind: "remote_url",
      label: "operator-supplied URL",
      url: "https://example.com/",
    },
    defaultMode: "code",
    requiresStartUrl: true,
    supportsCodeEdits: false,
    verification: [],
    tags: ["browser", "general", "custom"],
  },
]);

export const heroScenarioIds = scenarioCatalog
  .filter((scenario) => scenario.tags.includes("hero"))
  .map((scenario) => scenario.id);

export function listScenarios(): ScenarioManifest[] {
  return scenarioCatalog.map((scenario) => ({
    ...scenario,
    verification: scenario.verification.map((check) => ({ ...check })),
    tags: [...scenario.tags],
  }));
}

export function getScenarioById(id: string): ScenarioManifest | undefined {
  return listScenarios().find((scenario) => scenario.id === id);
}

export function getScenarioCategories(): ScenarioCategory[] {
  const categories = new Set<ScenarioCategory>();

  for (const scenario of listScenarios()) {
    categories.add(scenario.category);
  }

  return [...categories];
}

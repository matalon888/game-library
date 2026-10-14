#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = path.resolve(HERE, "..");
const MODES = new Set(["clone", "reskin", "original"]);
const DIMENSIONS = new Set(["2d", "3d"]);
const TASK_STATUSES = new Set(["todo", "active", "blocked", "done", "skipped"]);
const GATE_ORDER = ["brief", "prototype", "release", "launch"];

function now() {
  return new Date().toISOString();
}

function slug(value) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "game";
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function requireArg(args, key) {
  if (!args[key] || args[key] === true) throw new Error(`Missing required --${key}`);
  return String(args[key]);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function writeText(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data.replace(/^\n/, ""), "utf8");
}

function projectFiles(projectRoot) {
  return {
    state: path.join(projectRoot, ".game-ai", "state.json"),
    goal: path.join(projectRoot, ".game-ai", "goal.json"),
    tasks: path.join(projectRoot, ".game-ai", "tasks.json"),
    agents: path.join(projectRoot, ".game-ai", "agents.json"),
    adapter: path.join(projectRoot, ".game-ai", "engine-adapter.json")
  };
}

function normalizeEngine(engine) {
  const value = engine.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (["cocos", "cocoscreator"].includes(value)) return "cocos";
  if (["unity", "unity3d"].includes(value)) return "unity";
  if (["unreal", "unrealengine", "ue", "ue5"].includes(value)) return "unreal";
  if (["godot", "godotengine"].includes(value)) return "godot";
  if (["html", "html5", "web", "javascript", "typescript"].includes(value)) return "html5";
  return slug(engine);
}

function engineAdapter(engine, platforms) {
  const id = normalizeEngine(engine);
  const profiles = {
    cocos: {
      displayName: "Cocos Creator",
      projectMarkers: ["project.json", "package.json", "assets"],
      sourceRoots: ["assets", "extensions"],
      generatedDirs: ["library", "temp", "local", "build"],
      artifactDirs: ["build"],
      commands: { discover: "npm run --if-present check:engine", test: "npm test", build: null, preview: null, package: null },
      evidence: { playerVisible: "Cocos Browser Preview or target build", preferredCapture: "browser-or-device" }
    },
    unity: {
      displayName: "Unity",
      projectMarkers: ["Assets", "Packages/manifest.json", "ProjectSettings/ProjectVersion.txt"],
      sourceRoots: ["Assets", "Packages"],
      generatedDirs: ["Library", "Temp", "Logs", "obj", "Build", "Builds"],
      artifactDirs: ["Build", "Builds"],
      commands: { discover: null, test: null, build: null, preview: "Open the approved scene in Unity Play Mode", package: null },
      evidence: { playerVisible: "Play Mode or target build", preferredCapture: "editor-game-view-or-device" }
    },
    unreal: {
      displayName: "Unreal Engine",
      projectMarkers: ["*.uproject", "Content", "Config"],
      sourceRoots: ["Source", "Content", "Config", "Plugins"],
      generatedDirs: ["Binaries", "DerivedDataCache", "Intermediate", "Saved"],
      artifactDirs: ["Build", "Releases"],
      commands: { discover: null, test: null, build: null, preview: "Run the approved map in Play In Editor", package: null },
      evidence: { playerVisible: "PIE or packaged target build", preferredCapture: "editor-viewport-or-device" }
    },
    godot: {
      displayName: "Godot",
      projectMarkers: ["project.godot"],
      sourceRoots: ["."],
      generatedDirs: [".godot", "build", "dist"],
      artifactDirs: ["build", "dist"],
      commands: { discover: "godot --version", test: null, build: null, preview: "godot --editor project.godot", package: null },
      evidence: { playerVisible: "Running project or exported target", preferredCapture: "window-or-device" }
    },
    html5: {
      displayName: "HTML5/Web",
      projectMarkers: ["package.json", "index.html"],
      sourceRoots: ["src", "public"],
      generatedDirs: ["node_modules", "dist", "build", ".cache"],
      artifactDirs: ["dist", "build"],
      commands: { discover: "npm --version", test: "npm test", build: "npm run build", preview: "npm run dev", package: "npm run build" },
      evidence: { playerVisible: "Supported browser", preferredCapture: "browser" }
    }
  };
  const profile = profiles[id];
  if (profile) return { schemaVersion: 1, id, status: "preset", supportedPlatforms: platforms, ...profile };
  return {
    schemaVersion: 1,
    id,
    displayName: engine,
    status: "needs-configuration",
    supportedPlatforms: platforms,
    projectMarkers: ["SET_PROJECT_MARKER"],
    sourceRoots: ["SET_SOURCE_ROOT"],
    generatedDirs: [],
    artifactDirs: [],
    commands: { discover: null, test: null, build: null, preview: null, package: null },
    evidence: { playerVisible: "Configure a truthful engine-specific method", preferredCapture: "configure" }
  };
}

function studioRole(department, id, name, owns, active, coveredBy, triggers) {
  return { department, id, name, owns, active, coveredBy: active ? null : coveredBy, triggers };
}

function buildAgents(mode, engine, dimension, platforms, features) {
  const featureSet = new Set(features);
  const platformSet = new Set(platforms);
  const has = (...names) => names.some((name) => featureSet.has(name));
  const isOnline = has("multiplayer", "online", "backend", "server");
  const hasCommerceOrData = has("iap", "payments", "ads", "analytics", "telemetry", "monetization");
  const hasLocalization = has("localization", "multilanguage", "translation");
  const isMobileOrConsole = ["mobile", "ios", "android", "console", "playstation", "xbox", "switch"].some((item) => platformSet.has(item));
  const engineId = `${normalizeEngine(engine)}-engineer`;
  const roles = [
    studioRole("leadership-product-production", "executive-producer", "Executive Producer", ["business outcome", "budget", "staffing", "external constraints"], has("publisher", "budget", "large-team"), "project-manager", ["publisher", "budget", "large-team"]),
    studioRole("leadership-product-production", "game-director", "Game Director", ["creative vision", "experience coherence", "creative decisions"], true, null, ["always"]),
    studioRole("leadership-product-production", "project-manager", "Producer / Project Manager", ["scope", "schedule", "dependencies", "risk", "gates", "communication"], true, null, ["always"]),
    studioRole("leadership-product-production", "product-analyst", "Product Analyst", ["audience", "requirements", "KPIs", "acceptance traceability"], true, null, ["always"]),
    studioRole("leadership-product-production", "reference-analyst", "Reference Analyst", ["reference map", "provenance", "fidelity", "source conflicts"], ["clone", "reskin"].includes(mode), "product-analyst", ["mode:clone", "mode:reskin"]),

    studioRole("game-design", "lead-game-designer", "Lead Game Designer", ["core loop", "rules", "player experience", "design integration"], true, null, ["always"]),
    studioRole("game-design", "systems-designer", "Systems Designer", ["progression systems", "balance models", "inter-system rules"], has("progression", "economy", "retention", "rpg"), "lead-game-designer", ["progression", "economy", "retention", "rpg"]),
    studioRole("game-design", "level-designer", "Level Designer", ["levels", "encounters", "pacing", "difficulty curve"], has("levels", "level-design", "world", "campaign"), "lead-game-designer", ["levels", "world", "campaign"]),
    studioRole("game-design", "narrative-designer", "Narrative Designer / Writer", ["world", "story", "dialogue", "narrative flow"], has("story", "narrative", "dialogue", "quests"), "lead-game-designer", ["story", "narrative", "dialogue", "quests"]),
    studioRole("game-design", "ux-designer", "UX Designer", ["flows", "controls", "information architecture", "usability"], true, null, ["always"]),
    studioRole("game-design", "accessibility-designer", "Accessibility Designer", ["input accessibility", "readability", "accessibility acceptance"], true, null, ["always"]),
    studioRole("game-design", "economy-designer", "Economy / Monetization Designer", ["sources and sinks", "rewards", "pricing", "ads placement rules"], has("economy", "monetization", "iap", "ads", "retention"), "lead-game-designer", ["economy", "monetization", "iap", "ads", "retention"]),

    studioRole("art-animation", "art-director", "Art Director", ["visual target", "style consistency", "art acceptance"], true, null, ["always"]),
    studioRole("art-animation", "concept-artist", "Concept Artist", ["visual exploration", "characters", "environments", "props"], mode !== "clone" || has("concept-art"), "art-director", ["mode:original", "mode:reskin", "concept-art"]),
    studioRole("art-animation", "2d-artist", "2D Artist", ["sprites", "backgrounds", "illustrations", "icons"], dimension === "2d", "art-director", ["dimension:2d"]),
    studioRole("art-animation", "3d-artist", "3D Artist", ["models", "UVs", "textures", "environments", "props"], dimension === "3d", "art-director", ["dimension:3d"]),
    studioRole("art-animation", "ui-artist", "UI Artist", ["final UI visuals", "asset states", "UI style consistency"], true, null, ["always"]),
    studioRole("art-animation", "animator", "Animator", ["gameplay animation", "UI motion", "character states"], has("animation", "characters", "cinematics"), "art-director", ["animation", "characters", "cinematics"]),
    studioRole("art-animation", "technical-artist", "Technical Artist", ["shaders", "materials", "rigs", "import pipeline", "art performance"], dimension === "3d" || has("shaders", "complex-art", "performance"), "technical-director", ["dimension:3d", "shaders", "complex-art"]),
    studioRole("art-animation", "vfx-artist", "VFX Artist", ["particles", "effects", "readability", "VFX budgets"], has("vfx", "effects", "juice"), "art-director", ["vfx", "effects", "juice"]),

    studioRole("audio", "sound-designer", "Sound Designer", ["SFX", "feedback timing", "mix", "audio implementation requirements"], true, null, ["always"]),
    studioRole("audio", "composer", "Composer / Music Designer", ["music direction", "loops", "transitions", "adaptive music"], has("music", "adaptive-music", "soundtrack"), "sound-designer", ["music", "adaptive-music", "soundtrack"]),
    studioRole("audio", "voice-producer", "Voice / Dialogue Producer", ["casting", "recording", "editing", "dialogue delivery"], has("voice", "voiceover", "dialogue"), "sound-designer", ["voice", "voiceover", "dialogue"]),

    studioRole("engineering", "technical-director", "Technical Director", ["architecture", "technical risk", "standards", "performance strategy"], true, null, ["always"]),
    studioRole("engineering", "gameplay-engineer", "Gameplay Engineer", ["mechanics", "controls", "simulation", "gameplay state"], true, null, ["always"]),
    studioRole("engineering", engineId, `${engine} Adapter Engineer`, ["engine adapter", "editor and build tooling", `${dimension} runtime integration`], true, null, [`engine:${normalizeEngine(engine)}`]),
    studioRole("engineering", "ui-engineer", "UI Engineer", ["UI behavior", "binding", "responsiveness", "accessibility implementation"], true, null, ["always"]),
    studioRole("engineering", "tools-engineer", "Tools / Pipeline Engineer", ["import tools", "content tools", "developer productivity"], has("content-pipeline", "large-team", "procedural-content"), "technical-director", ["content-pipeline", "large-team", "procedural-content"]),
    studioRole("engineering", "ai-programmer", "AI Programmer", ["NPC behavior", "navigation", "decision systems"], has("ai", "npc", "enemies", "bots"), "gameplay-engineer", ["ai", "npc", "enemies", "bots"]),
    studioRole("engineering", "network-engineer", "Network / Backend Engineer", ["multiplayer", "services", "authority", "resilience"], isOnline, "technical-director", ["multiplayer", "online", "backend", "server"]),
    studioRole("engineering", "platform-engineer", "Platform Integration Engineer", ["SDKs", "platform input/services", "achievements", "IAP/ads plumbing"], isMobileOrConsole || hasCommerceOrData, "build-release-engineer", ["mobile", "console", "IAP", "ads", "analytics"]),
    studioRole("engineering", "build-release-engineer", "Build / Release Engineer", ["CI", "builds", "signing", "packaging", "version identity"], true, null, ["always"]),
    studioRole("engineering", "devops-sre", "DevOps / SRE", ["hosting", "deployment", "monitoring", "rollback", "incident readiness"], isOnline || has("liveops"), "technical-director", ["online", "backend", "server", "liveops"]),

    studioRole("quality-assurance", "quality-controller", "QA Lead / Quality Controller", ["test strategy", "independent verdicts", "gate evidence"], true, null, ["always"]),
    studioRole("quality-assurance", "functional-qa", "Functional / Playtest QA", ["gameplay flows", "edge cases", "exploratory playtesting"], true, null, ["always"]),
    studioRole("quality-assurance", "qa-automation", "QA Automation Engineer", ["regression automation", "integration automation", "test reliability"], has("automation", "large-team", "online"), "quality-controller", ["automation", "large-team", "online"]),
    studioRole("quality-assurance", "performance-qa", "Performance QA", ["frame time", "memory", "load time", "thermal and network budgets"], isMobileOrConsole || has("performance", "vr", "xr"), "quality-controller", ["mobile", "console", "performance", "VR/XR"]),
    studioRole("quality-assurance", "compatibility-qa", "Compatibility / Device QA", ["device", "OS", "input", "resolution", "browser and platform matrix"], platforms.length > 1 || isMobileOrConsole, "quality-controller", ["multi-platform", "mobile", "console"]),
    studioRole("quality-assurance", "localization-qa", "Localization QA", ["text", "fonts", "layout", "locale and cultural checks"], hasLocalization, "quality-controller", ["localization"]),
    studioRole("quality-assurance", "security-abuse-qa", "Security / Abuse QA", ["cheating", "unsafe input", "auth", "payment and service abuse"], isOnline || hasCommerceOrData, "quality-controller", ["online", "payment", "analytics", "ads"]),

    studioRole("data-growth-liveops", "data-analyst", "Data Analyst", ["event plan", "dashboards", "experiments", "health interpretation"], has("analytics", "telemetry", "experiments", "liveops", "retention"), "product-analyst", ["analytics", "telemetry", "experiments", "liveops"]),
    studioRole("data-growth-liveops", "liveops-producer", "LiveOps Producer", ["content and event cadence", "operational dependencies", "rollback"], has("liveops", "seasonal", "events"), "project-manager", ["liveops", "seasonal", "events"]),
    studioRole("data-growth-liveops", "marketing-producer", "Publishing / Marketing Producer", ["positioning", "campaign assets", "release calendar"], true, null, ["always"]),
    studioRole("data-growth-liveops", "user-acquisition", "User Acquisition Marketer", ["acquisition creatives", "channels", "campaign measurement"], isMobileOrConsole || has("f2p", "ads", "user-acquisition"), "marketing-producer", ["mobile", "F2P", "ads"]),
    studioRole("data-growth-liveops", "store-aso-manager", "Store / ASO Manager", ["store listing", "metadata", "screenshots", "conversion assets"], isMobileOrConsole, "marketing-producer", ["mobile", "console", "store"]),
    studioRole("data-growth-liveops", "community-manager", "Community Manager", ["community communication", "feedback loop", "community events"], has("community", "liveops", "multiplayer"), "marketing-producer", ["community", "liveops", "multiplayer"]),
    studioRole("data-growth-liveops", "player-support", "Player Support", ["support playbooks", "known issues", "escalation", "response"], true, null, ["always"]),

    studioRole("governance-delivery", "legal-ip-owner", "Legal / IP / Licensing Owner", ["reference rights", "asset licenses", "attribution", "contracts"], true, null, ["always"]),
    studioRole("governance-delivery", "privacy-security-owner", "Privacy / Security Owner", ["privacy", "data minimization", "consent", "threat review"], isOnline || hasCommerceOrData, "technical-director", ["online", "payments", "ads", "analytics", "personal data"]),
    studioRole("governance-delivery", "localization-manager", "Localization Manager", ["locale scope", "translation workflow", "terminology and vendor control"], hasLocalization, "project-manager", ["localization"]),
    studioRole("governance-delivery", "certification-manager", "Certification Manager", ["platform requirements", "store compliance", "submission evidence"], isMobileOrConsole, "build-release-engineer", ["mobile", "console", "store"])
  ];
  return {
    schemaVersion: 1,
    model: "complete-virtual-game-studio",
    policy: {
      everyRoleCovered: true,
      oneAccountableOwnerPerTask: true,
      qaIndependent: true,
      ownerApprovalsExternal: true,
      rightsApprovalIndependent: true,
      securityPrivacyReviewIndependentWhenTriggered: true,
      parallelWritesMustNotOverlap: true
    },
    departments: [...new Set(roles.map((role) => role.department))],
    agents: roles
  };
}

function estimate(minHours, maxHours, confidence = "medium") {
  return { minHours, maxHours, confidence };
}

function task(id, title, owner, range, acceptance, dependencies = []) {
  return { id, title, owner, estimate: range, dependencies, acceptance, status: "todo", notes: "" };
}

function nextWork(stage, mode, adapter, features) {
  if (stage === "pre-production") {
    const modeTask = mode === "original"
      ? task("PRE-001", "Finalize the one-page GDD and prototype hypothesis", "lead-game-designer", estimate(2, 5), "Concept, core loop, required mechanics, and prototype success signal are explicit")
      : task("PRE-001", mode === "clone" ? "Map authorized reference behavior and fidelity" : "Freeze the keep/change reskin matrix", "reference-analyst", estimate(3, 8), mode === "clone" ? "Required behavior is traceable to independent reference evidence" : "Core behavior and reskin boundaries are owner-reviewable");
    return [
      modeTask,
      task("PRE-002", "Verify the engine adapter and run a technical spike", `${adapter.id}-engineer`, estimate(2, 8), "Project opens and one representative build/test/preview path is proven", ["PRE-001"]),
      task("PRE-003", "Build the smallest playable core-loop prototype", "gameplay-engineer", estimate(4, 24), "Player can enter, act, receive feedback, finish/fail, and retry", ["PRE-001", "PRE-002"]),
      task("PRE-004", "Run prototype QA and owner playtest", "quality-controller", estimate(2, 5), "Core acceptance results, risks, and feel feedback are recorded", ["PRE-003"]),
      task("PRE-005", "Prepare the production slice plan and revised estimate", "project-manager", estimate(1, 3), "Ordered production slices have owners, dependencies, estimates, and acceptance", ["PRE-004"])
    ];
  }
  if (stage === "production") {
    const referenceAcceptance = mode === "original" ? "Core loop remains consistent with the approved prototype" : "Independent reference regression checkpoints pass";
    const list = [
      task("PROD-001", "Implement the complete approved gameplay flow in playable slices", "gameplay-engineer", estimate(12, 80, "low"), `All required gameplay acceptance criteria pass; ${referenceAcceptance}`),
      task("PROD-002", "Create and integrate approved art, UI, animation, audio, and feedback", "art-director", estimate(8, 60, "low"), "Player-facing presentation meets the approved direction without breaking core behavior", ["PROD-001"]),
      task("PROD-003", "Implement required levels, progression, persistence, services, and platform features", "technical-director", estimate(8, 80, "low"), "Every in-scope feature has success, failure, and save/reload coverage", ["PROD-001"]),
      task("PROD-004", "Run continuous regression, playtest, balance, and performance QA", "quality-controller", estimate(6, 30, "low"), "No unresolved critical/high findings; target scenarios and platforms are covered", ["PROD-002", "PROD-003"]),
      task("PROD-005", "Package and smoke-test the release candidate", "build-release-engineer", estimate(2, 12), "Versioned candidate installs/opens and completes the accepted flow", ["PROD-004"]),
      task("PROD-006", "Prepare release notes, limitations, marketing/certification checklist, and gate summary", "project-manager", estimate(2, 6), "Owner can make the Release Candidate decision from concise evidence", ["PROD-005"])
    ];
    if (adapter.status === "needs-configuration") list.unshift(task("PROD-000", "Configure and verify the unsupported-engine adapter", `${adapter.id}-engineer`, estimate(2, 8), "Discovery, test, build, preview, package, roots, and generated directories are truthful"));
    if (features.includes("multiplayer")) list.splice(3, 0, task("PROD-NET", "Verify multiplayer authority, reconnect, latency, and failure behavior", "network-engineer", estimate(8, 40, "low"), "Approved multiplayer scenarios pass under normal and degraded conditions", ["PROD-001"]));
    return list;
  }
  if (stage === "launch") {
    return [
      task("LAUNCH-001", "Freeze and publish the approved artifact", "build-release-engineer", estimate(1, 8), "Published artifact identity matches the approved release candidate"),
      task("LAUNCH-002", "Run production smoke tests on each target platform", "quality-controller", estimate(1, 8), "Install/open/core-flow/telemetry checks pass", ["LAUNCH-001"]),
      task("LAUNCH-003", "Enable monitoring, support, rollback, and day-one hotfix readiness", "project-manager", estimate(2, 8), "Named owners, signals, thresholds, and rollback/hotfix steps are ready", ["LAUNCH-001"])
    ];
  }
  if (stage === "liveops") {
    return [
      task("LIVE-001", "Review launch metrics, crashes, feedback, and support load", "quality-controller", estimate(2, 6), "Evidence-backed launch health summary is complete"),
      task("LIVE-002", "Prioritize patches, balance changes, content, and community actions", features.includes("liveops") ? "liveops-producer" : "project-manager", estimate(2, 6), "Next cadence has a bounded goal, tasks, owners, and rollback criteria", ["LIVE-001"])
    ];
  }
  return [];
}

function goalFor(stage, gate, tasks) {
  const outcomes = {
    "pre-production": "Prove the core loop and reduce the largest design/technical risks",
    production: "Complete, integrate, test, and package the approved game scope",
    launch: "Publish the approved build safely and verify production readiness",
    liveops: "Use launch evidence to plan the first bounded improvement cycle"
  };
  return {
    schemaVersion: 1,
    id: `goal-${stage}-${Date.now()}`,
    stage,
    sourceApprovalGate: gate,
    outcome: outcomes[stage],
    createdAt: now(),
    status: tasks.length ? "active" : "complete",
    taskIds: tasks.map((item) => item.id)
  };
}

function briefDoc(project) {
  const modeLine = project.mode === "original" ? "Describe the new game idea below." : `Reference: ${project.reference || "TODO"}`;
  const rightsLine = project.mode === "original" ? "Not applicable." : `${project.rights}. Confirm permitted source/asset use before analysis.`;
  return `# Project brief\n\n## Identity\n\n- Name: ${project.name}\n- Mode: ${project.mode}\n- Engine: ${project.engine}\n- Dimension: ${project.dimension}\n- Platforms: ${project.platforms.join(", ")}\n- Features: ${project.features.length ? project.features.join(", ") : "none declared"}\n\n## Source and rights\n\n${modeLine}\n\nRights status: ${rightsLine}\n\n## One-sentence pitch\n\nTODO\n\n## Target player and player fantasy\n\nTODO\n\n## Core loop\n\n1. TODO: enter/prepare.\n2. TODO: core action and challenge.\n3. TODO: feedback/reward/failure.\n4. TODO: finish and retry/continue.\n\n## In scope\n\n- TODO\n\n## Out of scope\n\n- TODO\n\n## Success criteria\n\n- TODO: observable player outcome.\n- TODO: quality/performance target.\n- TODO: delivery target.\n\n## Constraints and open questions\n\n- TODO\n`;
}

function gddDoc(project) {
  const modeSection = project.mode === "reskin" ? "## Keep/change matrix\n\n| Area | Keep | Change |\n| --- | --- | --- |\n| Core rules | TODO | TODO |\n| Controls/timing | TODO | TODO |\n| Progression | TODO | TODO |\n| Art/UI/audio/narrative | TODO | TODO |\n\n" : project.mode === "clone" ? "## Fidelity contract\n\n- Level: TODO (core-loop, functional, exact-observable)\n- Authoritative reference: TODO\n- Observed vs inferred behavior: TODO\n- Deliberate changes: TODO\n\n" : "## Prototype hypothesis\n\n- We believe: TODO\n- It succeeds when: TODO\n- It fails when: TODO\n\n";
  return `# GDD-lite\n\n${modeSection}## Rules and mechanics\n\n| ID | Trigger/input | State change | Observable feedback | Edge cases |\n| --- | --- | --- | --- | --- |\n| MEC-001 | TODO | TODO | TODO | TODO |\n\n## Player flow\n\n| Step | Entry state | Action | Result | Acceptance ID |\n| --- | --- | --- | --- | --- |\n| 1 | TODO | TODO | TODO | ACC-001 |\n\n## Features and data\n\n| Feature | Required? | Owned state | Dependencies | Save/version notes |\n| --- | --- | --- | --- | --- |\n| Core gameplay | yes | run-local facts | none | TODO |\n\n## UI, art, audio, and accessibility\n\n- Visual direction: TODO\n- Screens/HUD: TODO\n- Feedback/audio/VFX: TODO\n- Input/accessibility/localization: TODO\n\n## Levels and balance\n\n- Difficulty/tuning variables: TODO\n- Fixed test scenarios/seeds: TODO\n- Level/content plan: TODO\n\n## Acceptance\n\n- ACC-001: TODO\n- ACC-002: invalid/failure/retry behavior is explicit.\n- ACC-003: target platform performance and input are acceptable.\n`;
}

function planDoc() {
  return `# Delivery plan\n\nEstimates are initial ranges for a small game and must be revised after each approval.\n\n| Stage | Small stages | Default estimate | Gate |\n| --- | --- | --- | --- |\n| Intake | mode, engine/platform, constraints, reference/rights | 0.5-1.5 h | - |\n| Planning and Concept | pitch, audience/theme, core loop, scope, risks | 1-4 h | Brief |\n| Pre-production | GDD-lite, spike, prototype, asset/level plan | 0.5-3 d | Prototype |\n| Production | playable slices, assets, levels, systems, integration | 2 d-8 wk | - |\n| Testing and Pre-launch | regression, playtest, balance, performance, packaging, release prep | 0.5-5 d | Release Candidate |\n| Launch | publish, smoke test, monitor, hotfix readiness | 2 h-3 d | Launch |\n| LiveOps (optional) | patches, balance/content/community cadence | recurring | cadence review |\n\nThe current detailed goal and tasks live in \`.game-ai/goal.json\` and \`.game-ai/tasks.json\`.\n`;
}

function qualityDoc(mode) {
  return `# Quality policy\n\n- Independent QA owner: quality-controller.\n- Prototype evidence is lightweight but runnable.\n- Production player-visible work requires repeatable scenario/build evidence.\n- Game-feel and balance require owner playtest plus fixed scenarios when possible.\n- Critical/high findings block Release Candidate approval.\n- QA reports findings; the producer owns fixes.\n${mode === "original" ? "" : "- Reference and implementation evidence must remain independent.\n"}- Final handoff records version/artifact identity, smoke test, known limitations, and external asset/reference rights.\n`;
}

export function initProject(options) {
  const name = options.name?.trim();
  const mode = options.mode?.toLowerCase();
  const engine = options.engine?.trim();
  const dimension = (options.dimension || "2d").toLowerCase();
  const platforms = String(options.platforms || "web").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const features = String(options.features || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const output = path.resolve(options.output);
  if (!name) throw new Error("Project name is required");
  if (!MODES.has(mode)) throw new Error("Mode must be clone, reskin, or original");
  if (!engine) throw new Error("Engine is required");
  if (!DIMENSIONS.has(dimension)) throw new Error("Dimension must be 2d or 3d");
  if (["clone", "reskin"].includes(mode) && !options.reference) throw new Error(`${mode} mode requires --reference`);
  const rights = mode === "original" ? "not-applicable" : String(options.rights || "unknown").toLowerCase();
  if (!["not-applicable", "unknown", "confirmed", "restricted"].includes(rights)) throw new Error("Rights must be unknown, confirmed, or restricted");
  if (fs.existsSync(output) && fs.readdirSync(output).length > 0) throw new Error(`Output must be empty: ${output}`);
  fs.mkdirSync(output, { recursive: true });

  const project = { id: slug(name), name, mode, engine, dimension, platforms, reference: options.reference || null, rights, features, createdAt: now() };
  const adapter = engineAdapter(engine, platforms);
  const gates = Object.fromEntries(GATE_ORDER.map((gate, index) => [gate, { status: index === 0 ? "open" : "locked", approvalId: null }]));
  const state = { schemaVersion: 1, project, current: { stage: "planning", gate: "brief", status: "awaiting-approval" }, gates, approvals: [], changes: [] };
  const files = projectFiles(output);
  writeJson(files.state, state);
  writeJson(files.goal, { schemaVersion: 1, id: "goal-planning", stage: "planning", outcome: "Agree the game brief and success criteria", createdAt: now(), status: "active", taskIds: [] });
  writeJson(files.tasks, { schemaVersion: 1, stage: "planning", tasks: [] });
  writeJson(files.agents, buildAgents(mode, engine, dimension, platforms, features));
  writeJson(files.adapter, adapter);
  writeText(path.join(output, "docs", "BRIEF.md"), briefDoc(project));
  writeText(path.join(output, "docs", "GDD-LITE.md"), gddDoc(project));
  writeText(path.join(output, "docs", "PLAN.md"), planDoc());
  writeText(path.join(output, "docs", "DECISIONS.md"), "# Decision log\n\nRecord date, decision, owner, reason, affected acceptance, and follow-up.\n");
  writeText(path.join(output, "docs", "QUALITY.md"), qualityDoc(mode));
  fs.copyFileSync(path.join(FRAMEWORK_ROOT, "docs", "TEAM.md"), path.join(output, "docs", "TEAM.md"));
  writeText(path.join(output, "inputs", "reference", "README.md"), `# Reference input\n\nMode: ${mode}\nReference pointer: ${project.reference || "not applicable"}\nRights status: ${rights}\n\nKeep raw reference material immutable. Store only authorized inputs here and record provenance in the brief/GDD.\n`);
  fs.copyFileSync(path.join(FRAMEWORK_ROOT, "templates", "project", "AGENTS.md"), path.join(output, "AGENTS.md"));
  fs.cpSync(path.join(FRAMEWORK_ROOT, ".agents", "skills", "build-game-lean"), path.join(output, ".agents", "skills", "build-game-lean"), { recursive: true });
  fs.mkdirSync(path.join(output, "tools"), { recursive: true });
  fs.copyFileSync(path.join(FRAMEWORK_ROOT, "tools", "gameflow.mjs"), path.join(output, "tools", "gameflow.mjs"));
  return { output, state, adapter };
}

function loadProject(projectRoot) {
  const root = path.resolve(projectRoot);
  const files = projectFiles(root);
  if (!fs.existsSync(files.state)) throw new Error(`Not an initialized project: ${root}`);
  return { root, files, state: readJson(files.state), goal: readJson(files.goal), taskList: readJson(files.tasks), agents: readJson(files.agents), adapter: readJson(files.adapter) };
}

function assertCurrentTasksComplete(taskList, allowIncomplete) {
  const incomplete = taskList.tasks.filter((item) => !["done", "skipped"].includes(item.status));
  if (incomplete.length && !allowIncomplete) throw new Error(`Incomplete tasks block approval: ${incomplete.map((item) => item.id).join(", ")}. Finish them or pass --allow-incomplete with an owner-approved exception.`);
}

export function approveGate(projectRoot, gate, by, notes = "", allowIncomplete = false) {
  const data = loadProject(projectRoot);
  if (!GATE_ORDER.includes(gate)) throw new Error(`Unknown gate: ${gate}`);
  if (data.state.current.gate !== gate) throw new Error(`Current gate is ${data.state.current.gate}, not ${gate}`);
  if (!by?.trim()) throw new Error("Approval requires --by");
  if (allowIncomplete && !notes.trim()) throw new Error("An incomplete-task exception requires --notes explaining the owner decision");
  if (["clone", "reskin"].includes(data.state.project.mode) && gate === "brief" && data.state.project.rights !== "confirmed") throw new Error("Clone/reskin Brief Gate requires rights=confirmed in .game-ai/state.json");
  if (gate !== "brief") assertCurrentTasksComplete(data.taskList, allowIncomplete);

  const approval = { id: `approval-${gate}-${Date.now()}`, gate, by: by.trim(), notes, approvedAt: now(), incompleteException: Boolean(allowIncomplete) };
  data.state.approvals.push(approval);
  data.state.gates[gate] = { status: "approved", approvalId: approval.id };
  const mapping = {
    brief: { stage: "pre-production", nextGate: "prototype" },
    prototype: { stage: "production", nextGate: "release" },
    release: { stage: "launch", nextGate: "launch" },
    launch: { stage: data.state.project.features.includes("liveops") ? "liveops" : "complete", nextGate: "none" }
  };
  const next = mapping[gate];
  const tasks = next.stage === "complete" ? [] : nextWork(next.stage, data.state.project.mode, data.adapter, data.state.project.features);
  data.state.current = { stage: next.stage, gate: next.nextGate, status: next.stage === "complete" ? "complete" : "active" };
  if (next.nextGate !== "none") data.state.gates[next.nextGate] = { status: "open", approvalId: null };
  writeJson(data.files.state, data.state);
  writeJson(data.files.goal, next.stage === "complete" ? { schemaVersion: 1, id: "goal-complete", stage: "complete", outcome: "Game launched and baseline delivery is complete", createdAt: now(), status: "complete", taskIds: [] } : goalFor(next.stage, gate, tasks));
  writeJson(data.files.tasks, { schemaVersion: 1, stage: next.stage, tasks });
  return { approval, next: data.state.current, tasks };
}

export function updateTask(projectRoot, id, status, notes = "") {
  if (!TASK_STATUSES.has(status)) throw new Error(`Invalid task status: ${status}`);
  const data = loadProject(projectRoot);
  const item = data.taskList.tasks.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Task not found: ${id}`);
  if (status === "active") {
    const unmet = item.dependencies.filter((dependency) => data.taskList.tasks.find((candidate) => candidate.id === dependency)?.status !== "done");
    if (unmet.length) throw new Error(`Task ${id} has unmet dependencies: ${unmet.join(", ")}`);
  }
  item.status = status;
  item.notes = notes || item.notes;
  item.updatedAt = now();
  writeJson(data.files.tasks, data.taskList);
  const remaining = data.taskList.tasks.filter((candidate) => !["done", "skipped"].includes(candidate.status));
  if (!remaining.length) {
    data.state.current.status = data.state.current.gate === "none" ? "complete" : "awaiting-approval";
    writeJson(data.files.state, data.state);
    data.goal.status = "complete";
    data.goal.completedAt = now();
    writeJson(data.files.goal, data.goal);
  }
  return item;
}

function defaultReopenGate(stage) {
  if (stage === "planning" || stage === "pre-production") return "brief";
  if (stage === "production") return "prototype";
  if (stage === "launch") return "release";
  return "release";
}

export function recordChange(projectRoot, summary, impact, by, reopenGate) {
  if (!summary?.trim() || !by?.trim()) throw new Error("Change requires --summary and --by");
  if (!["small", "large"].includes(impact)) throw new Error("Impact must be small or large");
  const data = loadProject(projectRoot);
  const change = { id: `change-${Date.now()}`, summary: summary.trim(), impact, by: by.trim(), requestedAt: now(), previousStage: data.state.current.stage };
  data.state.changes.push(change);
  const changeTask = task(`CHG-${data.state.changes.length.toString().padStart(3, "0")}`, `Assess and implement change: ${summary.trim()}`, "project-manager", impact === "small" ? estimate(1, 4) : estimate(2, 12, "low"), "Affected scope, acceptance, estimate, implementation, and regression evidence are updated");
  data.taskList.tasks.unshift(changeTask);
  if (impact === "small" && data.state.current.stage === "complete") {
    data.state.current = { stage: "liveops", gate: "none", status: "active" };
    data.taskList.stage = "liveops";
    writeJson(data.files.goal, goalFor("liveops", "launch", [changeTask]));
  }
  if (impact === "large") {
    const gate = reopenGate || defaultReopenGate(data.state.current.stage);
    if (!GATE_ORDER.includes(gate)) throw new Error(`Invalid --reopen gate: ${gate}`);
    const stageByGate = { brief: "planning", prototype: "pre-production", release: "production", launch: "launch" };
    data.state.current = { stage: stageByGate[gate], gate, status: "active" };
    data.state.gates[gate] = { status: "reopened", approvalId: null, reasonChangeId: change.id };
    for (const later of GATE_ORDER.slice(GATE_ORDER.indexOf(gate) + 1)) {
      if (data.state.gates[later].status === "approved") data.state.gates[later] = { status: "invalidated", approvalId: data.state.gates[later].approvalId, reasonChangeId: change.id };
      else data.state.gates[later] = { status: "locked", approvalId: null };
    }
    change.reopenedGate = gate;
  }
  writeJson(data.files.state, data.state);
  writeJson(data.files.tasks, data.taskList);
  return change;
}

export function validateProject(projectRoot) {
  const errors = [];
  const warnings = [];
  let data;
  try { data = loadProject(projectRoot); }
  catch (error) { return { ok: false, errors: [error.message], warnings }; }
  const requiredFiles = ["AGENTS.md", "docs/BRIEF.md", "docs/GDD-LITE.md", "docs/PLAN.md", "docs/DECISIONS.md", "docs/QUALITY.md", "docs/TEAM.md", ".agents/skills/build-game-lean/SKILL.md"];
  for (const relative of requiredFiles) if (!fs.existsSync(path.join(data.root, relative))) errors.push(`Missing ${relative}`);
  if (data.state.schemaVersion !== 1) errors.push("Unsupported state schemaVersion");
  if (!MODES.has(data.state.project.mode)) errors.push("Invalid project mode");
  if (!DIMENSIONS.has(data.state.project.dimension)) errors.push("Invalid project dimension");
  if (!Array.isArray(data.state.project.platforms) || !data.state.project.platforms.length) errors.push("At least one platform is required");
  if (["clone", "reskin"].includes(data.state.project.mode) && !data.state.project.reference) errors.push("Reference is required for clone/reskin");
  if (["clone", "reskin"].includes(data.state.project.mode) && data.state.project.rights !== "confirmed") warnings.push("Reference rights are not confirmed; Brief Gate will remain blocked");
  if (data.adapter.schemaVersion !== 1 || !data.adapter.id || !data.adapter.commands) errors.push("Invalid engine adapter");
  if (data.adapter.status === "needs-configuration") warnings.push("Engine adapter needs configuration before implementation");
  const expectedDepartments = ["leadership-product-production", "game-design", "art-animation", "audio", "engineering", "quality-assurance", "data-growth-liveops", "governance-delivery"];
  const agentIds = new Set();
  for (const role of data.agents.agents || []) {
    if (agentIds.has(role.id)) errors.push(`Duplicate studio role: ${role.id}`);
    agentIds.add(role.id);
  }
  for (const department of expectedDepartments) if (!data.agents.departments?.includes(department)) errors.push(`Missing studio department: ${department}`);
  for (const id of ["game-director", "project-manager", "lead-game-designer", "art-director", "sound-designer", "technical-director", "gameplay-engineer", "build-release-engineer", "quality-controller", "legal-ip-owner", "player-support"]) {
    if (!agentIds.has(id)) errors.push(`Missing required studio role: ${id}`);
  }
  for (const role of data.agents.agents || []) {
    if (!role.active) {
      const covering = (data.agents.agents || []).find((candidate) => candidate.id === role.coveredBy);
      if (!covering) errors.push(`Role ${role.id} has no valid coverage owner`);
      else if (!covering.active) errors.push(`Role ${role.id} is covered by inactive role ${role.coveredBy}`);
    }
  }
  if (!(data.agents.agents || []).find((role) => role.id === "quality-controller" && role.active)) errors.push("Independent quality-controller is missing or inactive");
  const taskIds = new Set();
  for (const item of data.taskList.tasks || []) {
    if (taskIds.has(item.id)) errors.push(`Duplicate task ID: ${item.id}`);
    taskIds.add(item.id);
    if (!TASK_STATUSES.has(item.status)) errors.push(`Invalid status for ${item.id}`);
    if (!agentIds.has(item.owner)) warnings.push(`Task ${item.id} owner is not in the active roster: ${item.owner}`);
    for (const dependency of item.dependencies || []) if (!(data.taskList.tasks || []).some((candidate) => candidate.id === dependency)) errors.push(`Task ${item.id} has missing dependency ${dependency}`);
    if (!item.estimate || item.estimate.minHours > item.estimate.maxHours) errors.push(`Invalid estimate for ${item.id}`);
  }
  return { ok: errors.length === 0, errors, warnings, summary: { project: data.state.project.name, mode: data.state.project.mode, engine: data.adapter.displayName, stage: data.state.current.stage, gate: data.state.current.gate, tasks: data.taskList.tasks.length } };
}

export function projectStatus(projectRoot) {
  const data = loadProject(projectRoot);
  const counts = Object.fromEntries([...TASK_STATUSES].map((status) => [status, data.taskList.tasks.filter((item) => item.status === status).length]));
  return { project: data.state.project.name, mode: data.state.project.mode, engine: data.adapter.displayName, adapterStatus: data.adapter.status, stage: data.state.current.stage, gate: data.state.current.gate, workflowStatus: data.state.current.status, goal: data.goal.outcome, taskCounts: counts, nextTasks: data.taskList.tasks.filter((item) => ["todo", "active", "blocked"].includes(item.status)).slice(0, 5).map((item) => ({ id: item.id, title: item.title, owner: item.owner, estimate: `${item.estimate.minHours}-${item.estimate.maxHours}h`, status: item.status })) };
}

export function projectTeam(projectRoot) {
  const data = loadProject(projectRoot);
  const active = data.agents.agents.filter((role) => role.active);
  const covered = data.agents.agents.filter((role) => !role.active);
  return {
    project: data.state.project.name,
    model: data.agents.model,
    summary: { departments: data.agents.departments.length, totalRoles: data.agents.agents.length, activeSpecialists: active.length, coveredRoles: covered.length, uncoveredRoles: covered.filter((role) => !role.coveredBy).length },
    departments: data.agents.departments.map((department) => ({ department, active: active.filter((role) => role.department === department).map((role) => ({ id: role.id, name: role.name })), covered: covered.filter((role) => role.department === department).map((role) => ({ id: role.id, name: role.name, coveredBy: role.coveredBy })) })),
    independence: data.agents.policy
  };
}

function printUsage() {
  console.log(`Lean Game AI Framework\n\nCommands:\n  init --name <name> --mode <clone|reskin|original> --engine <engine> --output <path> [--dimension 2d|3d] [--platforms web,mobile] [--features csv] [--reference path-or-url] [--rights confirmed]\n  status --project <path>\n  team --project <path>\n  validate --project <path>\n  approve --project <path> --gate <brief|prototype|release|launch> --by <owner> [--notes text] [--allow-incomplete]\n  task --project <path> --id <task-id> --status <todo|active|blocked|done|skipped> [--notes text]\n  change --project <path> --summary <text> --impact <small|large> --by <name> [--reopen gate]\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.command || args.command === "help" || args.help) return printUsage();
  let result;
  if (args.command === "init") result = initProject({ name: requireArg(args, "name"), mode: requireArg(args, "mode"), engine: requireArg(args, "engine"), output: requireArg(args, "output"), dimension: args.dimension, platforms: args.platforms, features: args.features, reference: args.reference, rights: args.rights });
  else if (args.command === "status") result = projectStatus(requireArg(args, "project"));
  else if (args.command === "team") result = projectTeam(requireArg(args, "project"));
  else if (args.command === "validate") result = validateProject(requireArg(args, "project"));
  else if (args.command === "approve") result = approveGate(requireArg(args, "project"), requireArg(args, "gate"), requireArg(args, "by"), args.notes ? String(args.notes) : "", Boolean(args["allow-incomplete"]));
  else if (args.command === "task") result = updateTask(requireArg(args, "project"), requireArg(args, "id"), requireArg(args, "status"), args.notes ? String(args.notes) : "");
  else if (args.command === "change") result = recordChange(requireArg(args, "project"), requireArg(args, "summary"), requireArg(args, "impact"), requireArg(args, "by"), args.reopen ? String(args.reopen) : undefined);
  else throw new Error(`Unknown command: ${args.command}`);
  console.log(JSON.stringify(result, null, 2));
  if (args.command === "validate" && !result.ok) process.exitCode = 1;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ERROR: ${error.message}`);
    process.exitCode = 1;
  });
}

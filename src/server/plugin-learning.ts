import type { PluginGraphFileData, PluginLearningData, PluginPermission } from "../core/plugins.ts";
import { PLUGIN_PERMISSIONS } from "../core/plugins.ts";
import type { ChatStore, GraphStore } from "../core/ports.ts";
import { graphSnapshot } from "../core/graph.ts";

export interface PluginLearningDeps {
	directory: string;
	chatStore: ChatStore;
	graphStore: GraphStore;
	isBusy(id: string): boolean;
	isCompacting(id: string): boolean;
	readMetadata(name: "render-settings.json" | "format.json"): unknown;
}

/** A deliberately thin, read-only facade. Every read is fresh; this is not a
 * transaction spanning several files. Native transcript content is preserved.
 * Raw ledgers use the same version guards and validation as the core store. */
export function createPluginLearningData(deps: PluginLearningDeps): PluginLearningData {
	const readers: { [K in keyof PluginGraphFileData]: () => PluginGraphFileData[K] } = {
		"nodes.jsonl": () => deps.graphStore.readNodes(),
		"chains.jsonl": () => deps.graphStore.readChains(),
		"sessions.jsonl": () => deps.graphStore.readCheckpoints(),
		"coverage.jsonl": () => deps.graphStore.readCoverage(),
		"sources.json": () => deps.graphStore.readSources(),
		"positions.json": () => deps.graphStore.readPositions(),
		"render-settings.json": () => deps.readMetadata("render-settings.json"),
		"format.json": () => deps.readMetadata("format.json"),
	};
	return {
		directory: deps.directory,
		listSessions: () => deps.chatStore.listChats().map((s) => ({ ...s, busy: deps.isBusy(s.id), compacting: deps.isCompacting(s.id) })),
		getSession: (id) => {
			if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) throw new Error("Invalid learning session id");
			return deps.chatStore.getChat(id);
		},
		graph: () => graphSnapshot({ chatStore: deps.chatStore, graphStore: deps.graphStore }),
		readGraphFile: (name) => {
			if (!Object.hasOwn(readers, name)) throw new Error("Unknown learning-data file");
			return readers[name]();
		},
	};
}

const denied = (permission: PluginPermission) => () => {
	throw new Error(`This plugin did not request the '${permission}' permission.`);
};

/** Scope the learning facade to a plugin's declared data permissions. A
 * manifest without `permissions` keeps the historical full access; the
 * empty array opts out of both. This is a host-facade boundary, not a
 * sandbox: plugin code itself is trusted local Node/browser code. */
export function scopedPluginLearning(learning: PluginLearningData, permissions?: readonly PluginPermission[]): PluginLearningData {
	const allowed = new Set<PluginPermission>(permissions ?? PLUGIN_PERMISSIONS);
	if (PLUGIN_PERMISSIONS.every((permission) => allowed.has(permission))) return learning;
	return {
		...learning,
		...(allowed.has("chats.read") ? {} : { listSessions: denied("chats.read"), getSession: denied("chats.read") }),
		...(allowed.has("graph.read") ? {} : { graph: denied("graph.read"), readGraphFile: denied("graph.read") }),
	};
}

/** Plugin manifest permissions and the scoped learning facade. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePluginManifest, type PluginLearningData } from "../src/core/plugins.ts";
import { scopedPluginLearning } from "../src/server/plugin-learning.ts";

const manifest = (extra: Record<string, unknown> = {}) => ({
	apiVersion: 1, id: "fixture", name: "Fixture", version: "1.0.0", minAppVersion: "0.3.7",
	main: "main.js", ...extra,
});

function learningStub() {
	const calls: string[] = [];
	const stub = {
		directory: "/data",
		listSessions: () => { calls.push("sessions"); return []; },
		getSession: (_id: string) => { calls.push("session"); return null; },
		graph: () => { calls.push("graph"); return {}; },
		readGraphFile: (_name: "nodes.jsonl") => { calls.push("file"); return []; },
	};
	return { stub: stub as unknown as PluginLearningData, calls };
}

describe("manifest permissions", () => {
	it("defaults to absent (full legacy access) and accepts known values", () => {
		assert.equal(parsePluginManifest(manifest(), "fixture", "0.6.1").permissions, undefined);
		assert.deepEqual(parsePluginManifest(manifest({ permissions: ["chats.read"] }), "fixture", "0.6.1").permissions, ["chats.read"]);
	});

	it("refuses unknown or duplicated permissions", () => {
		for (const permissions of [["chats.write"], ["chats.read", "chats.read"], "chats.read", [1]]) {
			assert.throws(() => parsePluginManifest(manifest({ permissions }), "fixture", "0.6.1"), /permissions/);
		}
	});
});

describe("scoped learning facade", () => {
	it("an unmarked manifest keeps full access (no breaking change)", () => {
		const { stub } = learningStub();
		assert.equal(scopedPluginLearning(stub), stub, "full access returns the shared facade unchanged");
	});

	it("an empty list denies both data domains", () => {
		const { stub } = learningStub();
		const scoped = scopedPluginLearning(stub, []);
		assert.throws(() => scoped.listSessions(), /chats\.read/);
		assert.throws(() => scoped.getSession("chat_1"), /chats\.read/);
		assert.throws(() => scoped.graph(), /graph\.read/);
		assert.throws(() => scoped.readGraphFile("nodes.jsonl"), /graph\.read/);
		assert.equal(scoped.directory, "/data", "the path string alone is not data access");
	});

	it("chats-only plugins can read sessions but not the graph", () => {
		const { stub, calls } = learningStub();
		const scoped = scopedPluginLearning(stub, ["chats.read"]);
		assert.doesNotThrow(() => scoped.listSessions());
		assert.doesNotThrow(() => scoped.getSession("chat_1"));
		assert.throws(() => scoped.graph(), /graph\.read/);
		assert.deepEqual(calls, ["sessions", "session"]);
	});

	it("graph-only plugins can read graph files but not transcripts", () => {
		const { stub, calls } = learningStub();
		const scoped = scopedPluginLearning(stub, ["graph.read"]);
		assert.doesNotThrow(() => scoped.readGraphFile("nodes.jsonl"));
		assert.throws(() => scoped.listSessions(), /chats\.read/);
		assert.deepEqual(calls, ["file"]);
	});
});

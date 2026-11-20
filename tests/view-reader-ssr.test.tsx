/**
 * SSR safety for the session view readers (2026-11-20). The server renderer
 * seals the object useRef returns, so `useRef(...) as ViewReaderRef` crashes
 * when a component assigns `reader.changed = …` during render — a hard load of
 * /chat/<id> returned 500. useViewReader stores an extensible reader with
 * `changed` pre-declared in the ref slot, where writing `current` is legal.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { useRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useViewReader, type ViewReaderRef } from "../components/session-view-readers.ts";

describe("view reader SSR safety", () => {
	it("server-renders a component that assigns .changed during render", () => {
		function ReaderHost() {
			const reader = useViewReader<string>();
			reader.changed = () => {};
			return <span>{reader.current === null ? "empty" : "set"}</span>;
		}
		assert.equal(renderToStaticMarkup(<ReaderHost />), "<span>empty</span>");
	});

	it("returns an extensible reader with changed pre-declared, so assignment never adds properties", () => {
		const seen: ViewReaderRef<string>[] = [];
		function ReaderHost() {
			const reader = useViewReader<string>();
			seen.push(reader);
			reader.changed = () => {};
			reader.changed = () => {}; // re-render-style repeat assignment
			return null;
		}
		renderToStaticMarkup(<ReaderHost />);
		const reader = seen[0]!;
		assert.equal(Object.isExtensible(reader), true);
		assert.ok(Object.prototype.hasOwnProperty.call(reader, "changed"), "changed is an own property from creation");
		assert.equal(seen.length, 1);
	});

	it("the chat owner uses useViewReader instead of casting sealed refs", () => {
		const source = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");
		assert.equal(source.includes("as ViewReaderRef"), false, "no useRef-as-ViewReaderRef casts");
		assert.equal(source.includes("as SessionInputViewReader"), false);
		assert.match(source, /useViewReader<PluginSessionViewInput>\(\)/);
		assert.match(source, /useViewReader<NativeQuestionViewState>\(\)/);
	});
});

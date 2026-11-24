/**
 * SSR safety for the session view readers (2026-11-20; retargeted 2026-11-24
 * after the upstream v0.7.0 merge). The server renderer seals the object
 * useRef returns, so `useRef(...) as ViewReaderRef` crashes when a component
 * assigns `reader.changed = …` during render — a hard load of /chat/<id>
 * returned 500. The chat owner now creates stable reader objects in useState
 * initializers: `changed` exists from creation, later writes never add
 * properties, and no sealed ref object is ever cast.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import React, { useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ViewReaderRef } from "../components/session-view-readers.ts";

describe("view reader SSR safety", () => {
	it("server-renders the production useState reader pattern that assigns .changed during render", () => {
		function ReaderHost() {
			const [reader] = useState<ViewReaderRef<string>>(() => ({ current: null, changed: undefined }));
			reader.changed = () => {};
			reader.changed = () => {}; // re-render-style repeat assignment
			return <span>{reader.current === null ? "empty" : "set"}</span>;
		}
		assert.equal(renderToStaticMarkup(<ReaderHost />), "<span>empty</span>");
	});

	it("the useState initializer produces an extensible reader with changed pre-declared", () => {
		const seen: ViewReaderRef<string>[] = [];
		function ReaderHost() {
			const [reader] = useState<ViewReaderRef<string>>(() => ({ current: null, changed: undefined }));
			seen.push(reader);
			reader.changed = () => {};
			return null;
		}
		renderToStaticMarkup(<ReaderHost />);
		const reader = seen[0]!;
		assert.equal(Object.isExtensible(reader), true);
		assert.ok(Object.prototype.hasOwnProperty.call(reader, "changed"), "changed is an own property from creation");
	});

	it("the chat owner creates readers outside sealed refs (no useRef casts)", () => {
		const source = readFileSync(new URL("../components/chat.tsx", import.meta.url), "utf8");
		assert.equal(source.includes("as ViewReaderRef"), false, "no useRef-as-ViewReaderRef casts");
		assert.equal(source.includes("as SessionInputViewReader"), false);
		assert.match(source, /useState<SessionInputViewReader>\(\(\) => \(/, "the input reader is a plain lazy object");
		assert.match(source, /useState<ViewReaderRef<NativeQuestionViewState>>\(\(\) => \(/, "dock readers are plain lazy objects");
	});

	it("the sealed-ref workaround hook is gone: exactly one reader mechanism exists", () => {
		const source = readFileSync(new URL("../components/session-view-readers.ts", import.meta.url), "utf8");
		assert.equal(source.includes("useViewReader"), false, "no second reader mechanism to mislead future readers");
	});
});

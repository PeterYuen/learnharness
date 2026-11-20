/** Private read-only bridges to the actual mounted input owners; never a second state model. */
import { useRef } from "react";
import type { QuestionData, PluginSubmissionTarget, PluginNativeQuestionViewDraft, PluginSessionViewInput } from "@/src/core";
export interface ViewReaderRef<T> { current: (() => T) | null; changed?(): void }

/**
 * A view reader whose identity is stable across client renders. The server
 * renderer seals the object useRef returns, so `useRef(...) as ViewReaderRef`
 * crashes on the first `reader.changed = …` assignment during SSR (adding a
 * property to a sealed object throws). Storing the reader in a ref slot keeps
 * writes legal there: `current` exists on the sealed box, and our own object
 * is extensible with `changed` already present.
 */
export function useViewReader<T>(): ViewReaderRef<T> {
	const box = useRef<ViewReaderRef<T> | null>(null);
	if (!box.current) box.current = { current: null, changed: undefined };
	return box.current;
}
export interface NativeQuestionViewState {
  question: QuestionData;
  draft: Omit<PluginNativeQuestionViewDraft, "readingThinking">;
}
export type SessionInputViewReader = ViewReaderRef<PluginSessionViewInput>;
export interface SessionViewTargets {
  text: Extract<PluginSubmissionTarget, { type: "text" }>;
  answer(question: QuestionData): Extract<PluginSubmissionTarget, { type: "answer" }> | undefined;
  thinking?: Extract<PluginSubmissionTarget, { type: "thinking" }>;
  pluginQuestion?: Extract<PluginSubmissionTarget, { type: "plugin-question-answer" }>;
  pluginProblem?: Extract<PluginSubmissionTarget, { type: "plugin-problem-submission" }>;
}

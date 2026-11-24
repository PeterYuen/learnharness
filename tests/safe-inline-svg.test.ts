/**
 * Review M-1 (2026-11-24): the render-boundary SVG gate. SVG injected with
 * dangerouslySetInnerHTML must block the injection surface (script,
 * foreignObject, handlers, external references) while accepting what the
 * annotation and mermaid paths legitimately produce.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { inlineSvgProblem } from "../src/core/safe-inline-svg.ts";

const accepted: [string, string][] = [
	["plain chart", '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#fff"/></svg>'],
	["internal fragment reference", '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"/></defs><use href="#g"/><rect fill="url(#g)" width="5" height="5"/></svg>'],
	["mermaid-style style block", '<svg viewBox="0 0 10 10"><style>.x{fill:url(#g)}</style><text class="x">hi</text></svg>'],
	["embedded learner image", '<svg viewBox="0 0 40 30"><image href="data:image/png;base64,iVBORw0KGgo=" width="40" height="30"/></svg>'],
	["namespace declarations", '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><image xlink:href="data:image/png;base64,AAA"/></svg>'],
	["data:image/svg+xml reference", '<svg viewBox="0 0 10 10"><image href="data:image/svg+xml,%3Csvg/%3E"/></svg>'],
];

const rejected: [string, string][] = [
	["script element", '<svg viewBox="0 0 10 10"><script src="https://evil.invalid/x.js"/></svg>'],
	["inline script body", '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>'],
	["foreignObject", '<svg viewBox="0 0 10 10"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject></svg>'],
	["event handler", '<svg viewBox="0 0 10 10"><rect onclick="alert(1)" width="5" height="5"/></svg>'],
	["external href", '<svg viewBox="0 0 10 10"><use href="https://evil.invalid/x.svg#y"/></svg>'],
	["protocol-relative href", '<svg viewBox="0 0 10 10"><a href="//evil.invalid"><rect width="5" height="5"/></a></svg>'],
	["external url() reference", '<svg viewBox="0 0 10 10"><rect fill="url(https://evil.invalid/pattern.svg#p)" width="5" height="5"/></svg>'],
	["doctype", '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://evil.invalid/svg11.dtd"><svg viewBox="0 0 10 10"/>'],
	["entity declaration", '<!DOCTYPE svg [<!ENTITY x "y">]><svg viewBox="0 0 10 10"/>'],
	["processing instruction", '<?xml-stylesheet href="https://evil.invalid/s.xsl"?><svg viewBox="0 0 10 10"/>'],
];

it("accepts what the legitimate SVG producers emit", () => {
	for (const [label, svg] of accepted) assert.equal(inlineSvgProblem(svg), null, label);
});

it("rejects the injection surface", () => {
	for (const [label, svg] of rejected) assert.notEqual(inlineSvgProblem(svg), null, label);
});

it("the inline-injection boundaries call the gate", () => {
	for (const file of ["../components/session-overlay.tsx", "../components/md-blocks.tsx"]) {
		const source = readFileSync(new URL(file, import.meta.url), "utf8");
		assert.ok(source.includes("inlineSvgProblem"), `${file} gates its inline SVG`);
	}
});

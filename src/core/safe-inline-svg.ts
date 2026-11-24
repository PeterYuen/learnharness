/**
 * Structural gate for SVG markup inserted with `dangerouslySetInnerHTML`
 * (review M-1, 2026-11-24). Inline `<script>` does not execute via
 * innerHTML in Chromium, but `<use href>`, `foreignObject`-carried HTML
 * and event-handler attributes remain reachable, so SVG that arrives by a
 * non-annotation route (tool result, restored artifact, copied session)
 * gets checked at the render boundary, not only inside the annotation
 * sub-agent. Deliberately cheaper than annotationPlacementProblem: no
 * learner-image protocol rules, just the injection surface.
 */

const DECLARATION = /<!DOCTYPE|<!ENTITY/i;
const PROCESSING = /<\?/;
const DYNAMIC = /<(script|foreignObject)[\s>/]/i;
const HANDLER = /(?:^|[\s<(])on[a-z]+\s*=/i;
const HREF = /(?:^|[\s<(])(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi;
const URL_REF = /\burl\s*\(\s*(["']?)([^)]*)\1\s*\)/gi;

/** A resource reference is safe only as a same-document fragment or an
 *  inline image data URL (the annotation path embeds the learner image as
 *  a data: URI, and data:image SVG loaded through <image> is inert). */
function safeReference(value: string): boolean {
	if (value.startsWith("#")) return true;
	return /^data:image\/(png|jpe?g|gif|webp|svg\+xml)(?:[;,;][^,]*)?[,;]?/i.test(value);
}

/** Returns a human-readable problem string, or null when inline injection is safe. */
export function inlineSvgProblem(svg: string): string | null {
	if (DECLARATION.test(svg)) return "SVG declares entities or a document type";
	if (PROCESSING.test(svg)) return "SVG contains a processing instruction";
	if (DYNAMIC.test(svg)) return "SVG contains script or foreignObject";
	if (HANDLER.test(svg)) return "SVG contains event handler attributes";
	for (const match of svg.matchAll(HREF)) {
		if (!safeReference(match[2] ?? "")) return "SVG references an external resource";
	}
	for (const match of svg.matchAll(URL_REF)) {
		const value = (match[2] ?? "").trim();
		if (!safeReference(value)) return "SVG references resources outside the document";
	}
	return null;
}

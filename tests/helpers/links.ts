/**
 * Link-creation helpers for tests (2026-11-24). Windows file symlinks need
 * developer mode or administrator privilege — bare `fs.symlinkSync(file)`
 * fails with EPERM on unprivileged runners. Directory links work everywhere
 * as junctions, which Node reports as symlinks in `lstat`, so security tests
 * that assert "refuses a symlinked root" keep their semantics. File-symlink
 * probes let suites skip instead of erroring where the platform cannot.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let fileLinks: boolean | undefined;

/** Cached probe: can this machine create file symlinks at all? */
export function canSymlinkFiles(): boolean {
	if (fileLinks === undefined) {
		const probe = fs.mkdtempSync(path.join(os.tmpdir(), "lh-link-probe-"));
		try {
			fs.writeFileSync(path.join(probe, "target"), "probe");
			fs.symlinkSync(path.join(probe, "target"), path.join(probe, "link"));
			fileLinks = true;
		} catch {
			fileLinks = false;
		} finally {
			fs.rmSync(probe, { recursive: true, force: true });
		}
	}
	return fileLinks;
}

/** Skip the test when the platform cannot create file symlinks. */
export function requireFileSymlink(t: { skip(message?: string): void }): void {
	if (!canSymlinkFiles()) t.skip("file symlinks need developer mode or administrator privilege");
}

/** A directory link that works without elevation on Windows (junction). */
export function linkDirectory(target: string, alias: string): void {
	fs.symlinkSync(target, alias, process.platform === "win32" ? "junction" : "dir");
}

/** A file link that works without elevation on Windows (hardlink fallback).
 *  Hardlinks share content but not link identity: security tests that assert
 *  a REJECTED read still reject the same bytes, but tests matching the link
 *  itself should prefer requireFileSymlink + symlinkSync. */
export function linkFile(target: string, alias: string): void {
	if (process.platform === "win32" && !canSymlinkFiles()) fs.linkSync(target, alias);
	else fs.symlinkSync(target, alias);
}

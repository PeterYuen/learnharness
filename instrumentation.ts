/** Plugins use the documented per-server initialization hook. A plugin failure
 * must not prevent access to existing learning data or teaching/practice. */
export async function register() {
	if (process.env.NEXT_RUNTIME === "nodejs") {
		// Security (2026-11-18): the API has no per-user login in browser mode.
		// A wildcard bind (Next's own default for a bare `next start`, or an
		// explicit -H 0.0.0.0) exposes every chat, setting, and key to the
		// network. The packaged shell sets LH_DESKTOP_SERVER and pins loopback;
		// warn loudly for everyone else so an accidental exposure is visible.
		const wildcardBound =
			process.env.HOSTNAME === "0.0.0.0" ||
			process.env.HOSTNAME === "::" ||
			process.argv.includes("0.0.0.0") ||
			process.argv.includes("::");
		if (wildcardBound && !process.env.LH_DESKTOP_SERVER) {
			console.warn(
				"[security] Server is listening on ALL interfaces (0.0.0.0/::). " +
				"Browser-only mode has no login: anyone who can reach this port can read chats and keys. " +
				"Use 127.0.0.1 (the app default) unless you deliberately enabled LAN access.",
			);
		}
		const { initializeModelCatalog } = await import("./src/server/remote-model-catalog.ts");
		initializeModelCatalog();
		const { initializePlugins } = await import("./src/server/plugins.ts");
		try { await initializePlugins(); }
		catch (error) { console.error("[plugins] Initialization failed; plugin management will report the error:", error); }
	}
}

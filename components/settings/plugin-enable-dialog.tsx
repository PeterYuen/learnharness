"use client";

import { useState } from "react";
import { HostDialog } from "@/components/host-dialog";
import { PLUGIN_PERMISSION_LABELS, type PluginInfo, type PluginPermission } from "@/src/core";

/** Pure body of the first-enable consent dialog (no portal/layer deps). */
export function PluginEnableBody({ plugin, busy, failure, onCancel, onConfirm }: {
	plugin: PluginInfo;
	busy: boolean;
	failure: string;
	onCancel: () => void;
	onConfirm: () => void;
}) {
	const requested: readonly PluginPermission[] = plugin.manifest?.permissions ?? [];
	const name = plugin.manifest?.name ?? plugin.id;
	return <div role="dialog" aria-modal="true" aria-label={`Enable ${name}`} data-testid="plugin-enable-dialog"
		onClick={(event) => event.stopPropagation()} className="w-[32rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-card p-5 shadow-xl">
		<h2 className="text-sm font-semibold">Enable {name}?</h2>
		<p className="mt-1.5 text-sm text-muted-foreground">This plugin will be granted access to:</p>
		{requested.length > 0 ? <ul className="mt-2 space-y-2">
			{requested.map((permission) => <li key={permission} data-testid={`plugin-permission-${permission}`} className="rounded-lg border border-border/60 px-3 py-2">
				<span className="block text-sm">{PLUGIN_PERMISSION_LABELS[permission].label}</span>
				<span className="mt-0.5 block text-xs text-muted-foreground">{PLUGIN_PERMISSION_LABELS[permission].detail}</span>
			</li>)}
		</ul> : <p data-testid="plugin-permission-full" className="mt-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground">
			Full access to chat sessions and the knowledge graph. This plugin declares no permission restrictions.
		</p>}
		<p className="mt-3 text-xs text-muted-foreground">Plugins are trusted local code and are not sandboxed; permissions limit only the host data facade, not what plugin code can do on your machine.</p>
		{failure && <p role="alert" data-testid="plugin-enable-failure" className="mt-3 text-xs text-destructive">{failure}</p>}
		<div className="mt-4 flex justify-end gap-2">
			<button type="button" data-testid="plugin-enable-cancel" disabled={busy} onClick={onCancel} className="rounded-sm px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40">Cancel</button>
			<button type="button" data-testid="plugin-enable-confirm" disabled={busy} onClick={onConfirm} className="rounded-sm border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs text-primary transition-colors hover:bg-primary/20 disabled:opacity-40">{busy ? "Enabling…" : "Enable plugin"}</button>
		</div>
	</div>;
}

/** First-enable consent for community plugins. The server scopes the host's
 * `learning` facade to these same manifest permissions; plugin Node code is
 * still trusted local code (see PLUGIN_TRUST_WARNING). */
export function PluginEnableDialog({ plugin, onCancel, onConfirm }: {
	plugin: PluginInfo | undefined;
	onCancel: () => void;
	onConfirm: () => Promise<void>;
}) {
	const [busy, setBusy] = useState(false);
	const [failure, setFailure] = useState("");
	if (!plugin) return null;
	const run = () => {
		if (busy) return;
		setBusy(true); setFailure("");
		onConfirm().then(onCancel).catch((error) => { setFailure(error instanceof Error ? error.message : String(error)); setBusy(false); });
	};
	const frame = <PluginEnableBody plugin={plugin} busy={busy} failure={failure} onCancel={onCancel} onConfirm={run} />;
	return <HostDialog open frame={frame} onClose={() => {
		if (busy) return "blocked";
		onCancel(); return "closed";
	}} backdropProps={{ className: "fixed inset-0 z-50 flex items-center justify-center bg-background/80" }}>{frame.props.children}</HostDialog>;
}

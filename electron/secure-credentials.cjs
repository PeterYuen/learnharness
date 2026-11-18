"use strict";

/**
 * Credential-file codec (security, 2026-11-18): Electron's safeStorage
 * encrypts tokens with the OS credential store (Keychain / DPAPI / libsecret)
 * while the existing 0600 JSON file keeps its strict shape/validation and
 * atomic writes. Credential files written before this change are READABLE
 * plaintext, so decode() accepts both forms and migrateCredentialFile()
 * rewrites legacy plaintext through the store on first launch.
 *
 * When no OS keyring is available (e.g. headless Linux), encryption is
 * unavailable and the file stays plaintext-0600 — the previous behavior,
 * never a crash or a silently unreadable credential.
 */
const fs = require("node:fs/promises");

const plainCodec = {
	encode: (text) => text,
	decode: (text) => text,
	isEncrypted: () => false,
	encryptionAvailable: () => false,
};

function credentialCodec(safeStorage) {
	if (!safeStorage) return plainCodec;
	const available = () => {
		try { return safeStorage.isEncryptionAvailable() === true; } catch { return false; }
	};
	const isEncrypted = (text) => typeof text === "string" && !!text.trim() && !text.trim().startsWith("{");
	return {
		available,
		isEncrypted,
		encode(text) {
			if (!available()) return text;
			return safeStorage.encryptString(text).toString("base64");
		},
		decode(text) {
			if (!available() || !isEncrypted(text)) return text;
			try {
				return safeStorage.decryptString(Buffer.from(text.trim(), "base64"));
			} catch {
				// Never hand a garbage "credential" to the strict validators —
				// fail as a storage error so the UI asks the user to reconnect.
				throw Object.assign(new Error("Encrypted credentials could not be decrypted"), { code: "storage" });
			}
		},
	};
}

/** Rewrite a legacy plaintext credential file through the store (atomic,
 * validated), so it becomes OS-encrypted on the next write. No-op when the
 * file is missing, already encrypted, or no keyring exists. */
async function migrateCredentialFile(store, file, codec, io = fs) {
	if (!codec.available()) return false;
	let raw;
	try { raw = await io.readFile(file, "utf8"); }
	catch (error) { if (error.code === "ENOENT") return false; throw error; }
	if (codec.isEncrypted(raw)) return false;
	const state = await store.read();
	if (state == null) return false;
	await store.write(state);
	return true;
}

module.exports = { plainCodec, credentialCodec, migrateCredentialFile };

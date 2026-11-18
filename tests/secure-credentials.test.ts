/** OS-encrypted credential files: safeStorage codec + legacy migration. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
const require = createRequire(import.meta.url);
const { plainCodec, credentialCodec, migrateCredentialFile } = require("../electron/secure-credentials.cjs");
const { fileStore: chatgptFileStore } = require("../electron/chatgpt.cjs");
const { fileStore: subscriptionFileStore } = require("../electron/subscription-store.cjs");

const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "lh-secure-store-"));
after(() => fs.rm(tmp, { recursive: true, force: true }));

const fakeSafeStorage = {
	isEncryptionAvailable: () => true,
	encryptString: (text: string) => Buffer.from(`ENC:${text}`),
	decryptString: (buf: Buffer) => {
		const text = buf.toString();
		if (!text.startsWith("ENC:")) throw new Error("not our ciphertext");
		return text.slice(4);
	},
};

const chatgptState = () => ({ version: 1, hostId: "urn:uuid:00000000-0000-4000-8000-000000000001", activeId: null, registrations: [] });
const subscriptionState = () => ({
	version: 1, allowBackgroundUse: true,
	connectionId: "12345678-1234-4123-8123-123456789abc",
	credential: { type: "oauth", access: "access-token", refresh: "refresh-token", expires: 1234 },
});

describe("credential codec", () => {
	it("round-trips through safeStorage and recognises both forms", () => {
		const codec = credentialCodec(fakeSafeStorage);
		const sealed = codec.encode('{"secret":"token"}');
		assert.equal(codec.isEncrypted(sealed), true);
		assert.equal(codec.decode(sealed), '{"secret":"token"}');
		assert.equal(codec.isEncrypted('{"version":1}'), false);
		assert.equal(codec.decode('{"version":1}'), '{"version":1}', "legacy plaintext stays readable");
	});

	it("fails closed on ciphertext it cannot decrypt", () => {
		const codec = credentialCodec(fakeSafeStorage);
		assert.throws(() => codec.decode(Buffer.from("garbage").toString("base64")), /could not be decrypted/);
	});

	it("falls back to plaintext when no OS keyring is available", () => {
		const codec = credentialCodec({ isEncryptionAvailable: () => false });
		assert.equal(codec.encode("plain"), "plain");
		assert.equal(codec.decode("plain"), "plain");
		assert.equal(plainCodec.encode("plain"), "plain");
	});
});

describe("encrypted store files", () => {
	it("ChatGPT: writes OS-encrypted bytes but reads back the validated state", async () => {
		const file = path.join(tmp, "chatgpt-credentials.json");
		const codec = credentialCodec(fakeSafeStorage);
		const store = chatgptFileStore(file, fs, codec);
		await store.write(chatgptState());
		const raw = await fs.readFile(file, "utf8");
		assert.ok(!raw.includes("hostId"), "no plaintext tokens on disk");
		assert.equal(codec.decode(raw), JSON.stringify(chatgptState()), "round-trips via safeStorage");
		assert.deepEqual(await store.read(), chatgptState());
	});

	it("ChatGPT: legacy plaintext is readable and migrates on first launch", async () => {
		const file = path.join(tmp, "chatgpt-legacy.json");
		const codec = credentialCodec(fakeSafeStorage);
		const legacy = JSON.stringify(chatgptState());
		await fs.writeFile(file, `${legacy}\n`, { mode: 0o600 });
		const store = chatgptFileStore(file, fs, codec);
		assert.deepEqual(await store.read(), chatgptState());
		assert.equal(await migrateCredentialFile(store, file, codec, fs), true);
		assert.ok(!(await fs.readFile(file, "utf8")).includes("hostId"));
		assert.deepEqual(await store.read(), chatgptState(), "still readable after migration");
		assert.equal(await migrateCredentialFile(store, file, codec, fs), false, "no-op once encrypted");
	});

	it("subscriptions: encrypts credentials and migrates legacy files", async () => {
		const file = path.join(tmp, "github-copilot-credentials.json");
		const codec = credentialCodec(fakeSafeStorage);
		await fs.writeFile(file, `${JSON.stringify(subscriptionState())}\n`, { mode: 0o600 });
		const store = subscriptionFileStore(file, "github-copilot", fs, codec);
		assert.deepEqual(await store.read(), subscriptionState());
		assert.equal(await migrateCredentialFile(store, file, codec, fs), true);
		assert.ok(!(await fs.readFile(file, "utf8")).includes("refresh-token"));
		assert.deepEqual(await store.read(), subscriptionState());
	});
});

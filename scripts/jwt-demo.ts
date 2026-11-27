// What Clerk's middleware does for us, by hand: sign a JWT, verify it, then
// watch verification fail when the token is tampered with or expires.
//
//   npm run jwt:demo
//
// Clerk signs with RS256 (a private key only Clerk has) and we verify with its
// public key. To keep the demo small this uses HS256: one shared secret both
// signs and verifies.
import { decodeJwt, decodeProtectedHeader, jwtVerify, SignJWT } from "jose";

const secret = new TextEncoder().encode(
	"a-demo-secret-never-hardcode-a-real-one",
);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function check(label: string, token: string) {
	try {
		const { payload } = await jwtVerify(token, secret);
		console.log(`✔ ${label}: valid, sub=${payload.sub} role=${payload.role}`);
	} catch (error) {
		const code = (error as { code?: string }).code ?? String(error);
		console.log(`✘ ${label}: rejected (${code})`);
	}
}

// 1. Sign: header + payload, then a signature over both
const token = await new SignJWT({ role: "fdo" })
	.setProtectedHeader({ alg: "HS256" })
	.setSubject("user_2fdo")
	.setIssuedAt()
	.setExpirationTime("5s")
	.sign(secret);

const [header, payload, signature] = token.split(".");
console.log("token:", token, "\n");
console.log(
	"header   ",
	header,
	"→",
	JSON.stringify(decodeProtectedHeader(token)),
);
console.log("payload  ", payload);
console.log("signature", signature, "\n");
console.log("Anyone can read the payload (it's only base64url):");
console.log(Buffer.from(payload ?? "", "base64url").toString(), "\n");

// 2. Verify the untouched token
await check("original token", token);

// 3. Tamper: change the role in the payload but keep the old signature
const forgedPayload = Buffer.from(
	JSON.stringify({ ...decodeJwt(token), role: "stock-manager" }),
).toString("base64url");
await check(
	"role changed to stock-manager",
	`${header}.${forgedPayload}.${signature}`,
);

// 4. Expire: wait past exp and try again
console.log("\nwaiting 6 seconds for the token to expire...");
await sleep(6000);
await check("same token, 6s later", token);

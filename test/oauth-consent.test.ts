import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import TeachMeHipaa, {
  ApiError,
  ConnectionError,
  OAuthError,
} from "../src/index.js";
import { createFakeTransport, textBody } from "./support/fake-transport.js";
import {
  APP_BASIC_AUTHORIZATION,
  APP_ID,
  APP_SECRET,
  REFRESH_TOKEN_1,
  TOKEN_ROUTE,
  grantTokenReply,
  oauthErrorReply,
} from "./support/fixtures.js";

const UNRESERVED_43_TO_128 = /^[A-Za-z0-9._~-]{43,128}$/;
const BASE64URL_43 = /^[A-Za-z0-9_-]{43}$/;

// RFC 7636 §4.2, computed with node:crypto rather than the SDK's Web Crypto.
const s256 = (codeVerifier: string): string =>
  createHash("sha256").update(codeVerifier, "ascii").digest("base64url");

describe("PKCE pairs", () => {
  it("derives the code challenge as the S256 hash of the code verifier", async () => {
    const pair = await TeachMeHipaa.oauth.createPkcePair();

    expect(pair.method).toBe("S256");
    expect(pair.codeVerifier).toMatch(UNRESERVED_43_TO_128);
    expect(pair.codeChallenge).toMatch(BASE64URL_43);
    expect(pair.codeChallenge).toBe(s256(pair.codeVerifier));
  });

  it("makes a fresh code verifier every time", async () => {
    const first = await TeachMeHipaa.oauth.createPkcePair();
    const second = await TeachMeHipaa.oauth.createPkcePair();

    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});

const REDIRECT_URI = "https://partner.example.com/oauth/callback?tenant=7";
const CHALLENGE = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

const consentParams = {
  clientId: APP_ID,
  redirectUri: REDIRECT_URI,
  scopes: ["learners:read", "learners:write"],
  state: "af0ifjsldkj",
  codeChallenge: CHALLENGE,
};

describe("Consent URL", () => {
  it("sends the admin to the console with the client, redirect, Scopes, state and S256 challenge", () => {
    const url = new URL(TeachMeHipaa.oauth.authorizeUrl(consentParams));

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://console.teachmehipaa.com/oauth/authorize",
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: "code",
      client_id: APP_ID,
      redirect_uri: REDIRECT_URI,
      scope: "learners:read learners:write",
      state: "af0ifjsldkj",
      code_challenge: CHALLENGE,
      code_challenge_method: "S256",
    });
  });

  it("encodes spaces in the scope as %20", () => {
    expect(TeachMeHipaa.oauth.authorizeUrl(consentParams)).toContain(
      "scope=learners%3Aread%20learners%3Awrite",
    );
  });

  it("refuses to build a consent URL without a state", () => {
    expect(() =>
      TeachMeHipaa.oauth.authorizeUrl({ ...consentParams, state: "" }),
    ).toThrow(TypeError);
  });

  it("makes states that are hard to guess", () => {
    const state = TeachMeHipaa.oauth.createState();

    expect(state).toMatch(BASE64URL_43);
    expect(state).not.toBe(TeachMeHipaa.oauth.createState());
  });

  it("uses an explicit authorizationUrl, which Sandbox requires", () => {
    expect(() =>
      TeachMeHipaa.oauth.authorizeUrl({
        ...consentParams,
        environment: "sandbox",
      }),
    ).toThrow(/authorizationUrl/);

    const url = new URL(
      TeachMeHipaa.oauth.authorizeUrl({
        ...consentParams,
        environment: "sandbox",
        authorizationUrl: "https://console.example.test/oauth/authorize",
      }),
    );
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://console.example.test/oauth/authorize",
    );
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

const VERIFIER = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const CODE = "SplxlOBeZQQYbYS6WxSbIA";
const exchangeParams = {
  clientId: APP_ID,
  clientSecret: APP_SECRET,
  code: CODE,
  redirectUri: REDIRECT_URI,
  codeVerifier: VERIFIER,
};

describe("Code exchange", () => {
  it("exchanges the code for an Access token, Refresh token, expiry and Scopes", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      grantTokenReply("jwt-org", REFRESH_TOKEN_1, 900),
    );

    const grant = await TeachMeHipaa.oauth.exchangeCode({
      ...exchangeParams,
      transport: fake.transport,
    });

    expect(grant).toEqual({
      accessToken: "jwt-org",
      refreshToken: REFRESH_TOKEN_1,
      expiresIn: 900,
      scopes: ["learners:read", "learners:write"],
    });
    const [request] = fake.requestsTo(TOKEN_ROUTE);
    expect(request?.url).toBe("https://api.tme.so/v1/auth/token");
    expect(request?.headers.authorization).toBe(APP_BASIC_AUTHORIZATION);
    expect(request?.headers["content-type"]).toBe(
      "application/x-www-form-urlencoded",
    );
    expect(Object.fromEntries(new URLSearchParams(textBody(request)))).toEqual({
      grant_type: "authorization_code",
      code: CODE,
      redirect_uri: REDIRECT_URI,
      code_verifier: VERIFIER,
    });
  });

  it("exchanges against the Sandbox token endpoint when asked", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      grantTokenReply("jwt-org", REFRESH_TOKEN_1),
    );

    await TeachMeHipaa.oauth.exchangeCode({
      ...exchangeParams,
      environment: "sandbox",
      transport: fake.transport,
    });

    expect(fake.requests[0]?.url).toBe(
      "https://api-teachmehipaa-dev.web.app/v1/auth/token",
    );
  });

  it("raises an OAuthError when the code is refused", async () => {
    const fake = createFakeTransport().script(
      TOKEN_ROUTE,
      oauthErrorReply("invalid_grant", "The code has expired or was used"),
    );

    const exchange = TeachMeHipaa.oauth.exchangeCode({
      ...exchangeParams,
      transport: fake.transport,
    });

    await expect(exchange).rejects.toBeInstanceOf(OAuthError);
    await expect(exchange).rejects.toMatchObject({
      code: "invalid_grant",
      status: 400,
    });
  });

  it("never retries a network failure, and says the code may be spent", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, () => {
      throw new TypeError("fetch failed");
    });

    const exchange = TeachMeHipaa.oauth.exchangeCode({
      ...exchangeParams,
      transport: fake.transport,
    });

    await expect(exchange).rejects.toBeInstanceOf(ConnectionError);
    await expect(exchange).rejects.toThrow(/consumed/);
    await expect(exchange).rejects.toThrow(/consent/);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
  });

  it("never retries a server error either", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, {
      status: 503,
      json: { error: "temporarily_unavailable" },
    });

    const exchange = TeachMeHipaa.oauth.exchangeCode({
      ...exchangeParams,
      transport: fake.transport,
    });

    await expect(exchange).rejects.toBeInstanceOf(OAuthError);
    expect(fake.requestsTo(TOKEN_ROUTE)).toHaveLength(1);
  });

  it("raises an ApiError when the token endpoint returns no Refresh token", async () => {
    const fake = createFakeTransport().script(TOKEN_ROUTE, {
      json: { access_token: "jwt-org", token_type: "Bearer", expires_in: 900 },
    });

    await expect(
      TeachMeHipaa.oauth.exchangeCode({
        ...exchangeParams,
        transport: fake.transport,
      }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});

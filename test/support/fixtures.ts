import type { ScriptedReply } from "./fake-transport.js";

export const CLIENT_ID = "cli_01JD7Z3M1V4Q8T2K5N9R6W0XYZ";
export const CLIENT_SECRET = "tmh_cs_c2VjcmV0LXNlY3JldC1zZWNyZXQtc2VjcmV0LXM";
export const ORG_ID = "org_acme";
export const LEARNER_ID = "sub_01JD80AB2C3D4E5F6G7H8J9K0M";
/** The path prefix of every org-scoped route, as the fake transport sees it. */
export const ORG = `/v1/organizations/${ORG_ID}`;

export const TOKEN_ROUTE = "POST /v1/auth/token";
export const INTROSPECTION_ROUTE = "GET /v1/auth/introspection";
export const LEARNER_ROUTE = `GET /v1/organizations/${ORG_ID}/learners/${LEARNER_ID}`;

/** `dev#/components/schemas/ClientCredentialsTokenResponse`, §2.1 example. */
export const tokenReply = (
  accessToken = "access-token-1",
  expiresIn = 900,
): ScriptedReply => ({
  json: {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: expiresIn,
    scope: "learners:read learners:write",
  },
  headers: { "cache-control": "no-store", pragma: "no-cache" },
});

/** `dev#/components/schemas/TokenIntrospection` for an API client. */
export const introspectionReply = (
  orgId: string | null = ORG_ID,
): ScriptedReply => ({
  json: {
    actorType: "client",
    clientId: CLIENT_ID,
    subjectId: null,
    orgId,
    scopes: ["learners:read", "learners:write"],
    mode: "live",
    expiresAt: "2026-11-15T12:15:00.000Z",
  },
});

/** `dev#/components/schemas/LearnerDto`. */
export const learnerBody = {
  learnerId: LEARNER_ID,
  email: "ana@example.com",
  name: "Ana Example",
  externalId: "hr-123",
  status: "in_progress",
  course: { courseId: "hipaa-2026", title: "HIPAA Training 2026" },
  invitedAt: "2026-11-01T09:00:00.000Z",
  startedAt: "2026-11-02T10:30:00.000Z",
  completedAt: null,
  dueAt: "2026-12-01T00:00:00.000Z",
  certificate: null,
};

export const learnerReply = (
  headers: Readonly<Record<string, string>> = {},
): ScriptedReply => ({ json: learnerBody, headers });

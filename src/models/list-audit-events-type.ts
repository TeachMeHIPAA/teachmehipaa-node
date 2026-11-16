// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

/** Known values are listed; the API may add more at any time, so handle values you don't recognize. */
export type ListAuditEventsType =
  | "enrollment.transition"
  | "organization.updated"
  | "organization.closed"
  | "organization.reopened"
  | "member.role_changed"
  | "member.transferred"
  | "member.removed"
  | "certificate.issued"
  | "certificate.revoked"
  | "seat.granted"
  | "api_client.created"
  | "api_client.secret_rotated"
  | "api_client.revoked"
  | "learner.updated"
  | "learner.launch_link_created"
  | "api_client.updated"
  | (string & {});

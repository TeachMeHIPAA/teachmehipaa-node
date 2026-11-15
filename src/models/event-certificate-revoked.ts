// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { CertificateRevokedEventData } from "./certificate-revoked-event-data.js";

export interface EventCertificateRevoked {
  readonly eventId: string;
  readonly eventType: "certificate.revoked";
  readonly orgId: string;
  /** An ISO 8601 date-time string. */
  readonly occurredAt: string;
  readonly data: CertificateRevokedEventData;
}

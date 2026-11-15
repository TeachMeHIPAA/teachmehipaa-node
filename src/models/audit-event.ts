// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { AuditEventApiClientCreated } from "./audit-event-api-client-created.js";
import type { AuditEventApiClientRevoked } from "./audit-event-api-client-revoked.js";
import type { AuditEventApiClientSecretRotated } from "./audit-event-api-client-secret-rotated.js";
import type { AuditEventApiClientUpdated } from "./audit-event-api-client-updated.js";
import type { AuditEventCertificateIssued } from "./audit-event-certificate-issued.js";
import type { AuditEventCertificateRevoked } from "./audit-event-certificate-revoked.js";
import type { AuditEventEnrollmentTransition } from "./audit-event-enrollment-transition.js";
import type { AuditEventLearnerLaunchLinkCreated } from "./audit-event-learner-launch-link-created.js";
import type { AuditEventLearnerUpdated } from "./audit-event-learner-updated.js";
import type { AuditEventMemberRemoved } from "./audit-event-member-removed.js";
import type { AuditEventMemberRoleChanged } from "./audit-event-member-role-changed.js";
import type { AuditEventMemberTransferred } from "./audit-event-member-transferred.js";
import type { AuditEventOauthGrantCreated } from "./audit-event-oauth-grant-created.js";
import type { AuditEventOauthGrantRevoked } from "./audit-event-oauth-grant-revoked.js";
import type { AuditEventOauthGrantUpdated } from "./audit-event-oauth-grant-updated.js";
import type { AuditEventOrganizationClosed } from "./audit-event-organization-closed.js";
import type { AuditEventOrganizationCreatedByPartner } from "./audit-event-organization-created-by-partner.js";
import type { AuditEventOrganizationReopened } from "./audit-event-organization-reopened.js";
import type { AuditEventOrganizationUpdated } from "./audit-event-organization-updated.js";
import type { AuditEventSeatGranted } from "./audit-event-seat-granted.js";
import type { AuditEventSeatOrderCreated } from "./audit-event-seat-order-created.js";
import type { AuditEventSeatOrderFailed } from "./audit-event-seat-order-failed.js";
import type { AuditEventSeatOrderPaid } from "./audit-event-seat-order-paid.js";

/** Tell the variants apart by `type`. New variants may be added; handle values you don't recognize. */
export type AuditEvent =
  | AuditEventApiClientCreated
  | AuditEventApiClientRevoked
  | AuditEventApiClientSecretRotated
  | AuditEventApiClientUpdated
  | AuditEventCertificateIssued
  | AuditEventCertificateRevoked
  | AuditEventEnrollmentTransition
  | AuditEventLearnerLaunchLinkCreated
  | AuditEventLearnerUpdated
  | AuditEventMemberRemoved
  | AuditEventMemberRoleChanged
  | AuditEventMemberTransferred
  | AuditEventOauthGrantCreated
  | AuditEventOauthGrantRevoked
  | AuditEventOauthGrantUpdated
  | AuditEventOrganizationClosed
  | AuditEventOrganizationCreatedByPartner
  | AuditEventOrganizationReopened
  | AuditEventOrganizationUpdated
  | AuditEventSeatGranted
  | AuditEventSeatOrderCreated
  | AuditEventSeatOrderFailed
  | AuditEventSeatOrderPaid;

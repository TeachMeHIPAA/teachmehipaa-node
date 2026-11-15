// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { Requester } from "../core/requester.js";
import { AuditEvents } from "./audit-events.js";
import { Auth } from "./auth.js";
import { CertificateVerifications } from "./certificate-verifications.js";
import { Certificates } from "./certificates.js";
import { Compliance } from "./compliance.js";
import { Courses } from "./courses.js";
import { Enrollments } from "./enrollments.js";
import { Events } from "../extensions/events.js";
import { Learners } from "./learners.js";
import { Members } from "./members.js";
import { Operations } from "./operations.js";
import { Partners } from "./partners.js";
import { PaymentMethod } from "./payment-method.js";
import { SeatOrders } from "./seat-orders.js";
import { Seats } from "./seats.js";
import { WebhookSubscriptions } from "./webhook-subscriptions.js";

/** Every API resource, as properties of the client. */
export class ApiResources {
  readonly auditEvents: AuditEvents;
  readonly auth: Auth;
  readonly certificateVerifications: CertificateVerifications;
  readonly certificates: Certificates;
  readonly compliance: Compliance;
  readonly courses: Courses;
  readonly enrollments: Enrollments;
  readonly events: Events;
  readonly learners: Learners;
  readonly members: Members;
  readonly operations: Operations;
  readonly partners: Partners;
  readonly paymentMethod: PaymentMethod;
  readonly seatOrders: SeatOrders;
  readonly seats: Seats;
  readonly webhookSubscriptions: WebhookSubscriptions;

  constructor(requester: Requester) {
    this.auditEvents = new AuditEvents(requester);
    this.auth = new Auth(requester);
    this.certificateVerifications = new CertificateVerifications(requester);
    this.certificates = new Certificates(requester);
    this.compliance = new Compliance(requester);
    this.courses = new Courses(requester);
    this.enrollments = new Enrollments(requester);
    this.events = new Events(requester);
    this.learners = new Learners(requester);
    this.members = new Members(requester);
    this.operations = new Operations(requester);
    this.partners = new Partners(requester);
    this.paymentMethod = new PaymentMethod(requester);
    this.seatOrders = new SeatOrders(requester);
    this.seats = new Seats(requester);
    this.webhookSubscriptions = new WebhookSubscriptions(requester);
  }
}

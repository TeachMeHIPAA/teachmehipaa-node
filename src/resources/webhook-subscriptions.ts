// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { EmptyResponse, WithLastResponse } from "../core/response.js";
import type { Operation } from "../models/operation.js";
import type { WebhookSubscription } from "../models/webhook-subscription.js";
import type { WebhookSubscriptionCreate } from "../models/webhook-subscription-create.js";
import type { WebhookSubscriptionCreated } from "../models/webhook-subscription-created.js";
import type { WebhookSubscriptionPatch } from "../models/webhook-subscription-patch.js";

/** Parameters for `webhookSubscriptions.create`. */
export type WebhookSubscriptionCreateParams = WebhookSubscriptionCreate;

/** Parameters for `webhookSubscriptions.list`. */
export interface WebhookSubscriptionListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
}

/** Parameters for `webhookSubscriptions.update`. */
export type WebhookSubscriptionUpdateParams = WebhookSubscriptionPatch;

export class WebhookSubscriptions {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Create a webhook subscription
   *
   * Subscribes an HTTPS endpoint to event types and creates its signing secret. Requires the `webhooks:manage` or `org:admin` scope.
   */
  create(
    params: WebhookSubscriptionCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<WebhookSubscriptionCreated>> {
    return this.#requester.request<WebhookSubscriptionCreated>({
      method: "POST",
      path: "/webhook-subscriptions",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * Delete a webhook subscription
   *
   * Deletes a webhook subscription and its signing secret. Requires the `webhooks:manage` or `org:admin` scope.
   */
  delete(
    subscriptionId: string,
    options?: RequestOptions,
  ): Promise<EmptyResponse> {
    return this.#requester.request<object>({
      method: "DELETE",
      path: "/webhook-subscriptions/{subscriptionId}",
      pathParams: { subscriptionId },
      organizationScoped: true,
      retrySafe: false,
      idempotencyKey: "none",
      response: { kind: "empty" },
      options,
    });
  }

  /**
   * List all webhook subscriptions
   *
   * Returns a list of the organization's webhook subscriptions. Signing secrets are never returned. Requires the `webhooks:manage` or `org:admin` scope.
   */
  list(
    params?: WebhookSubscriptionListParams,
    options?: RequestOptions,
  ): PagePromise<WebhookSubscription> {
    return requestPage<WebhookSubscription>(
      this.#requester,
      {
        method: "GET",
        path: "/webhook-subscriptions",
        organizationScoped: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: { limit: params?.limit, cursor: params?.cursor },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Retry failed deliveries
   *
   * Delivers the subscription's failed events again. Requires the `webhooks:manage` or `org:admin` scope.
   */
  redrive(
    subscriptionId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Operation>> {
    return this.#requester.request<Operation>({
      method: "POST",
      path: "/webhook-subscriptions/{subscriptionId}:redrive",
      pathParams: { subscriptionId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Retrieve a webhook subscription
   *
   * Retrieves a webhook subscription. Requires the `webhooks:manage` or `org:admin` scope.
   */
  retrieve(
    subscriptionId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<WebhookSubscription>> {
    return this.#requester.request<WebhookSubscription>({
      method: "GET",
      path: "/webhook-subscriptions/{subscriptionId}",
      pathParams: { subscriptionId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }

  /**
   * Send a test event
   *
   * Sends a signed test delivery to the subscription's endpoint, so you can check your verifier. Requires the `webhooks:manage` or `org:admin` scope.
   */
  test(
    subscriptionId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Operation>> {
    return this.#requester.request<Operation>({
      method: "POST",
      path: "/webhook-subscriptions/{subscriptionId}:test",
      pathParams: { subscriptionId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Update a webhook subscription
   *
   * Updates a webhook subscription; parameters you don't send are left unchanged. Send its current `ETag` in `If-Match`. The signing secret doesn't change. Requires the `webhooks:manage` or `org:admin` scope.
   */
  update(
    subscriptionId: string,
    params: WebhookSubscriptionUpdateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<WebhookSubscription>> {
    return this.#requester.request<WebhookSubscription>({
      method: "PATCH",
      path: "/webhook-subscriptions/{subscriptionId}",
      pathParams: { subscriptionId },
      organizationScoped: true,
      retrySafe: false,
      idempotencyKey: "none",
      body: params,
      contentType: "application/merge-patch+json",
      options,
    });
  }
}

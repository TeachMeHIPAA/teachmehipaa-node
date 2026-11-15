// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { EmptyResponse, WithLastResponse } from "../core/response.js";
import type { BillingPaymentMethod } from "../models/billing-payment-method.js";
import type { PaymentMethodConfirmRequest } from "../models/payment-method-confirm-request.js";
import type { PaymentMethodPrepare } from "../models/payment-method-prepare.js";
import type { PaymentMethodSetup } from "../models/payment-method-setup.js";
import type { PaymentMethodSetupRequest } from "../models/payment-method-setup-request.js";

/** Parameters for `paymentMethod.confirm`. */
export type PaymentMethodConfirmParams = PaymentMethodConfirmRequest;

/** Parameters for `paymentMethod.setup`. */
export type PaymentMethodSetupParams = PaymentMethodSetupRequest;

export class PaymentMethod {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Finish saving a card
   *
   * Makes the card from a confirmed SetupIntent the organization's default for seat orders. Safe to repeat. Requires the `seats:purchase` or `billing:write` scope.
   */
  confirm(
    params: PaymentMethodConfirmParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<BillingPaymentMethod>> {
    return this.#requester.request<BillingPaymentMethod>({
      method: "POST",
      path: "/billing/payment-method:confirm",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      body: params,
      options,
    });
  }

  /**
   * Delete the saved card
   *
   * Removes the saved card. Seats already bought aren't affected. Requires the `seats:purchase` or `billing:write` scope.
   */
  delete(options?: RequestOptions): Promise<EmptyResponse> {
    return this.#requester.request<object>({
      method: "DELETE",
      path: "/billing/payment-method",
      organizationScoped: true,
      retrySafe: false,
      idempotencyKey: "none",
      response: { kind: "empty" },
      options,
    });
  }

  /**
   * Start saving a card
   *
   * Creates a Stripe SetupIntent for a card form in your own page. Confirm it with Stripe.js, then finish saving the card. Saving a card never charges it. Requires the `seats:purchase` or `billing:write` scope.
   */
  prepare(
    options?: RequestOptions,
  ): Promise<WithLastResponse<PaymentMethodPrepare>> {
    return this.#requester.request<PaymentMethodPrepare>({
      method: "POST",
      path: "/billing/payment-method:prepare",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      options,
    });
  }

  /**
   * Retrieve the saved card
   *
   * Retrieves the card seat orders charge: its brand, last four digits and expiry. Card numbers are never returned. Requires the `seats:purchase` or `billing:write` scope.
   */
  retrieve(
    options?: RequestOptions,
  ): Promise<WithLastResponse<BillingPaymentMethod>> {
    return this.#requester.request<BillingPaymentMethod>({
      method: "GET",
      path: "/billing/payment-method",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }

  /**
   * Save a card with Checkout
   *
   * Creates a Stripe-hosted page where the buyer saves the card that seat orders charge. The card becomes the organization's default. Requires the `seats:purchase` or `billing:write` scope.
   */
  setup(
    params: PaymentMethodSetupParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<PaymentMethodSetup>> {
    return this.#requester.request<PaymentMethodSetup>({
      method: "POST",
      path: "/billing/payment-method:setup",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }
}

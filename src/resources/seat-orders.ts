// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestPage, type PagePromise } from "../core/pagination.js";
import type { RequestOptions } from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type { WithLastResponse } from "../core/response.js";
import type { SeatOrder } from "../models/seat-order.js";
import type { SeatOrderCreateRequest } from "../models/seat-order-create-request.js";
import type { SeatOrderCreated } from "../models/seat-order-created.js";
import type { SeatOrderQuote } from "../models/seat-order-quote.js";
import type { SeatOrderQuoteRequest } from "../models/seat-order-quote-request.js";

/** Parameters for `seatOrders.create`. */
export type SeatOrderCreateParams = SeatOrderCreateRequest;

/** Parameters for `seatOrders.list`. */
export interface SeatOrderListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
}

/** Parameters for `seatOrders.quote`. */
export type SeatOrderQuoteParams = SeatOrderQuoteRequest;

export class SeatOrders {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Create a seat order
   *
   * Buys seats at list price. Pay with a Stripe-hosted checkout, the organization's saved card, or an invoice when it's enabled. Send the `expectedTotal` and `currency` from the quote you showed the buyer: if the price changed, nothing is charged. Seats are granted once payment succeeds. Requires the `seats:purchase` or `billing:write` scope.
   */
  create(
    params: SeatOrderCreateParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<SeatOrderCreated>> {
    return this.#requester.request<SeatOrderCreated>({
      method: "POST",
      path: "/seat-orders",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * List all seat orders
   *
   * Returns a list of the organization's seat orders, oldest first. Requires the `seats:purchase` or `billing:write` scope.
   */
  list(
    params?: SeatOrderListParams,
    options?: RequestOptions,
  ): PagePromise<SeatOrder> {
    return requestPage<SeatOrder>(this.#requester, {
      method: "GET",
      path: "/seat-orders",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      query: { limit: params?.limit, cursor: params?.cursor },
      options,
    });
  }

  /**
   * Quote a seat order
   *
   * Gets the list price for a number of seats in the organization's currency, before tax. The quote is for display and expires after 15 minutes. Requires the `seats:purchase` or `billing:write` scope.
   */
  quote(
    params: SeatOrderQuoteParams,
    options?: RequestOptions,
  ): Promise<WithLastResponse<SeatOrderQuote>> {
    return this.#requester.request<SeatOrderQuote>({
      method: "POST",
      path: "/seat-orders:quote",
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      body: params,
      options,
    });
  }

  /**
   * Retrieve a seat order
   *
   * Retrieves a seat order, its status and the seats it granted. Requires the `seats:purchase` or `billing:write` scope.
   */
  retrieve(
    seatOrderId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<SeatOrder>> {
    return this.#requester.request<SeatOrder>({
      method: "GET",
      path: "/seat-orders/{seatOrderId}",
      pathParams: { seatOrderId },
      organizationScoped: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}

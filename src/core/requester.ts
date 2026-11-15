import { TeachMeHipaaError } from "./errors.js";
import { createOrganizationBinding } from "./organization.js";
import { errorFromResponse, readBody } from "./problem.js";
import type { RequestOptions } from "./request-options.js";
import {
  responseMetadata,
  withLastResponse,
  type WithLastResponse,
} from "./response.js";
import type { TokenProvider } from "./token-provider.js";
import type { HttpMethod, Transport } from "./transport.js";

export type QueryParams = Readonly<
  Record<string, string | number | boolean | undefined>
>;

export interface RequestSpec {
  readonly method: HttpMethod;
  /** Path template relative to the base URL, e.g. `/learners/{learnerId}`. */
  readonly path: string;
  readonly pathParams?: Readonly<Record<string, string>>;
  /** Org-scoped paths are prefixed with `/organizations/{orgId}`. */
  readonly organizationScoped: boolean;
  readonly query?: QueryParams | undefined;
  readonly options?: RequestOptions | undefined;
}

export interface RequesterSettings {
  readonly baseUrl: string;
  readonly userAgent: string;
  readonly transport: Transport;
  readonly tokenProvider: TokenProvider;
  readonly timeout: number;
  readonly organizationId: string | undefined;
}

/** Sends API requests with auth, the Organization binding and error mapping. */
export interface Requester {
  request<T extends object>(spec: RequestSpec): Promise<WithLastResponse<T>>;
}

const expandPath = (
  template: string,
  params: Readonly<Record<string, string>>,
): string =>
  template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new TypeError(`Missing path parameter "${name}"`);
    }
    return encodeURIComponent(value);
  });

const queryString = (query: QueryParams | undefined): string => {
  const search = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([name, value]) => {
    if (value !== undefined) {
      search.append(name, String(value));
    }
  });
  const encoded = search.toString();
  return encoded === "" ? "" : `?${encoded}`;
};

export const createRequester = (settings: RequesterSettings): Requester => {
  const send = async <T extends object>(
    method: HttpMethod,
    path: string,
    query: QueryParams | undefined,
    options: RequestOptions,
  ): Promise<WithLastResponse<T>> => {
    const accessToken = await settings.tokenProvider.getAccessToken();
    const response = await settings.transport({
      method,
      url: `${settings.baseUrl}${path}${queryString(query)}`,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: "application/json",
        "user-agent": settings.userAgent,
        ...(options.requestId === undefined
          ? {}
          : { "x-request-id": options.requestId }),
      },
      timeout: options.timeout ?? settings.timeout,
    });
    const body = await readBody(response);
    if (
      !response.ok ||
      !body.json ||
      typeof body.value !== "object" ||
      body.value === null
    ) {
      throw errorFromResponse(response, body);
    }
    return withLastResponse(body.value as T, responseMetadata(response));
  };

  const organization = createOrganizationBinding(async () => {
    const introspection = await send<{ readonly orgId?: unknown }>(
      "GET",
      "/auth/introspection",
      undefined,
      {},
    );
    if (typeof introspection.orgId === "string" && introspection.orgId !== "") {
      return introspection.orgId;
    }
    const { lastResponse } = introspection;
    throw new TeachMeHipaaError({
      message:
        "The Access token is not bound to an Organization. Pass organizationId when you create the client.",
      status: lastResponse.status,
      code: null,
      title: null,
      detail: null,
      errors: [],
      requestId: lastResponse.requestId,
      headers: lastResponse.headers,
      raw: introspection,
    });
  }, settings.organizationId);

  return {
    async request<T extends object>(
      spec: RequestSpec,
    ): Promise<WithLastResponse<T>> {
      const relative = expandPath(spec.path, spec.pathParams ?? {});
      const path = spec.organizationScoped
        ? `/organizations/${encodeURIComponent(await organization.organizationId())}${relative}`
        : relative;
      return send<T>(spec.method, path, spec.query, spec.options ?? {});
    },
  };
};

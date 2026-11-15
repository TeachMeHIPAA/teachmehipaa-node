// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.
import { requestOperation, type Operation } from "../core/operations.js";
import { requestPage, type PagePromise } from "../core/pagination.js";
import type {
  DownloadOptions,
  RequestOptions,
} from "../core/request-options.js";
import type { Requester } from "../core/requester.js";
import type {
  BinaryResponse,
  BinaryStreamResponse,
  WithLastResponse,
} from "../core/response.js";
import type { Certificate } from "../models/certificate.js";
import type { CertificateLinks } from "../models/certificate-links.js";
import type { CertificatesExportRequest } from "../models/certificates-export-request.js";

/** Parameters for `certificates.export`. */
export type CertificateExportParams = CertificatesExportRequest;

/** Parameters for `certificates.list`. */
export interface CertificateListParams {
  /** How many objects to return, between 1 and 100. Defaults to 20. */
  readonly limit?: number;
  /** The `nextCursor` from the previous page. */
  readonly cursor?: string;
  /** Filter to one holder (canonical subject id). */
  readonly subjectId?: string;
}

export class Certificates {
  readonly #requester: Requester;

  constructor(requester: Requester) {
    this.#requester = requester;
  }

  /**
   * Download a certificate
   *
   * Downloads the certificate as a PDF. Revoked and expired certificates are watermarked. Requires the `certificates:read` scope.
   *
   * Resolves with the whole file in `data`, or with `asStream: true`, as a web `ReadableStream` in `stream`.
   */
  downloadPdf(
    certId: string,
    options: DownloadOptions & { readonly asStream: true },
  ): Promise<WithLastResponse<BinaryStreamResponse>>;
  /**
   * Download a certificate
   *
   * Downloads the certificate as a PDF. Revoked and expired certificates are watermarked. Requires the `certificates:read` scope.
   *
   * Resolves with the whole file in `data`, or with `asStream: true`, as a web `ReadableStream` in `stream`.
   */
  downloadPdf(
    certId: string,
    options?: DownloadOptions & { readonly asStream?: false },
  ): Promise<WithLastResponse<BinaryResponse>>;
  /**
   * Download a certificate
   *
   * Downloads the certificate as a PDF. Revoked and expired certificates are watermarked. Requires the `certificates:read` scope.
   *
   * Resolves with the whole file in `data`, or with `asStream: true`, as a web `ReadableStream` in `stream`.
   */
  downloadPdf(
    certId: string,
    options?: DownloadOptions,
  ): Promise<WithLastResponse<BinaryResponse | BinaryStreamResponse>>;
  downloadPdf(
    certId: string,
    options?: DownloadOptions,
  ): Promise<WithLastResponse<BinaryResponse | BinaryStreamResponse>> {
    return this.#requester.request<BinaryResponse | BinaryStreamResponse>({
      method: "GET",
      path: "/certificates/{certId}/content",
      pathParams: { certId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      response: {
        kind: "binary",
        contentType: "application/pdf",
        stream: options?.asStream === true,
      },
      options,
    });
  }

  /**
   * Export certificates
   *
   * Exports the organization's certificate records as CSV. Requires the `certificates:read` scope.
   *
   * Resolves with an Operation; `await operation.wait()` for its final state.
   */
  export(
    params: CertificateExportParams,
    options?: RequestOptions,
  ): Promise<Operation> {
    return requestOperation(this.#requester, {
      method: "POST",
      path: "/certificates:export",
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "required",
      body: params,
      options,
    });
  }

  /**
   * List all certificates
   *
   * Returns a list of the organization's certificates. Pass `subjectId` to list one learner's.
   */
  list(
    params?: CertificateListParams,
    options?: RequestOptions,
  ): PagePromise<Certificate> {
    return requestPage<Certificate>(
      this.#requester,
      {
        method: "GET",
        path: "/certificates",
        organizationScoped: true,
        authenticated: true,
        retrySafe: true,
        idempotencyKey: "none",
        query: {
          limit: params?.limit,
          cursor: params?.cursor,
          subjectId: params?.subjectId,
        },
        options,
      },
      { style: "cursor", cursorParam: "cursor" },
    );
  }

  /**
   * Retrieve a certificate
   *
   * Retrieves a certificate.
   */
  retrieve(
    certId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<Certificate>> {
    return this.#requester.request<Certificate>({
      method: "GET",
      path: "/certificates/{certId}",
      pathParams: { certId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }

  /**
   * Retrieve certificate links
   *
   * Retrieves the certificate's LinkedIn add-to-profile link and its public `tme.so` verification link. Requires the `certificates:read` scope.
   */
  retrieveLinks(
    certId: string,
    options?: RequestOptions,
  ): Promise<WithLastResponse<CertificateLinks>> {
    return this.#requester.request<CertificateLinks>({
      method: "GET",
      path: "/certificates/{certId}/credentials",
      pathParams: { certId },
      organizationScoped: true,
      authenticated: true,
      retrySafe: true,
      idempotencyKey: "none",
      options,
    });
  }
}

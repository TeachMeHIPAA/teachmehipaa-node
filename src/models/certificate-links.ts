// Generated from openapi/sdk-ir.json — do not edit. Run `npm run generate`.

export interface CertificateLinks {
  /** The certificate. */
  readonly certificateId: string;
  /** Adds the certificate to the holder's LinkedIn profile. */
  readonly linkedInUrl: string;
  /** The public `tme.so` verification link. */
  readonly shortLink: string;
  /** The verification link's id. */
  readonly tinyId: string;
  readonly paywalled?: boolean;
}

// The parts of `openapi/sdk-ir.json` the generator reads. The vendored
// `sdk-ir.schema.json` is the authority; `validate.ts` checks the input
// against it before anything here is trusted.

export type TypeRef =
  | {
      readonly kind: "primitive";
      readonly type:
        | "string"
        | "integer"
        | "number"
        | "boolean"
        | "dateTime"
        | "binary"
        | "json";
    }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "array"; readonly items: TypeRef }
  | { readonly kind: "map"; readonly values: TypeRef };

export interface RefType {
  readonly kind: "ref";
  readonly name: string;
}

export interface IrField {
  readonly name: string;
  readonly description: string | null;
  readonly required: boolean;
  readonly nullable: boolean;
  readonly type: TypeRef;
}

export interface IrObjectType {
  readonly kind: "object";
  readonly name: string;
  readonly description: string | null;
  readonly fields: readonly IrField[];
  readonly additionalFields: true;
  readonly mergePatch: boolean;
}

export interface IrEnumType {
  readonly kind: "enum";
  readonly name: string;
  readonly description: string | null;
  readonly values: readonly string[];
  readonly open: true;
}

export type UnionDiscriminator =
  | {
      readonly kind: "property";
      readonly property: string;
      readonly mapping: Readonly<Record<string, string>>;
    }
  | {
      readonly kind: "presence";
      readonly mapping: Readonly<Record<string, string>>;
      readonly fallback: string | null;
    };

export interface IrUnionType {
  readonly kind: "union";
  readonly name: string;
  readonly description: string | null;
  readonly discriminator: UnionDiscriminator;
}

export type IrType = IrObjectType | IrEnumType | IrUnionType;

export interface IrParam {
  readonly name: string;
  readonly description: string | null;
  readonly required: boolean;
  readonly type: TypeRef;
}

export type BodyConstraint =
  | {
      readonly kind: "const";
      readonly path: readonly string[];
      readonly value: string | number | boolean | null;
    }
  | {
      readonly kind: "variant";
      readonly path: readonly string[];
      readonly requiredProperty: string;
    };

export interface IrRequestBody {
  readonly contentType: string;
  readonly required: boolean;
  readonly type: TypeRef;
  readonly binaryParts: readonly {
    readonly name: string;
    readonly contentType: string;
  }[];
  readonly constraints: readonly BodyConstraint[];
}

export type IrResponse =
  | { readonly kind: "model"; readonly type: TypeRef }
  | { readonly kind: "page"; readonly type: RefType }
  | { readonly kind: "binary"; readonly contentType: string }
  | { readonly kind: "operation"; readonly type: RefType }
  | { readonly kind: "empty" }
  | {
      readonly kind: "writeResult";
      readonly type: RefType;
      readonly existing: RefType;
      readonly created: RefType;
    };

export type Requirement = "required" | "optional" | "none";

export type IrSecurity =
  | { readonly kind: "none" }
  | { readonly kind: "bearer"; readonly anyOf: readonly (readonly string[])[] };

export interface IrMethod {
  readonly name: string;
  readonly operationId: string;
  readonly summary: string | null;
  readonly description: string | null;
  readonly httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: {
    readonly template: string;
    readonly customVerb: string | null;
  };
  readonly orgScoped: boolean;
  readonly pathParams: readonly IrParam[];
  readonly queryParams: readonly IrParam[];
  readonly headerParams: readonly IrParam[];
  readonly requestBody: IrRequestBody | null;
  readonly response: IrResponse;
  readonly pagination: {
    readonly style: "cursor" | "after";
    readonly cursorParam: string;
    readonly limitParam: string;
    readonly maxLimit: number;
    readonly itemType: TypeRef;
  } | null;
  readonly idempotencyKey: Requirement;
  readonly ifMatch: Requirement;
  readonly ifNoneMatch: Requirement;
  readonly retrySafe: boolean;
  readonly security: IrSecurity;
}

export interface IrResource {
  readonly path: readonly string[];
  readonly methods: readonly IrMethod[];
}

export interface Ir {
  readonly irVersion: number;
  readonly source: { readonly release: string; readonly sha256: string };
  readonly resources: readonly IrResource[];
  readonly types: readonly IrType[];
}

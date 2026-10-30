/**
 * The Standard Schema interface (https://standardschema.dev), copied as the
 * spec asks so that no validation library is needed. Any schema that
 * implements it can be used as a form rule.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>
}

// oxlint-disable-next-line typescript/no-namespace -- the shape the spec publishes
export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => Result<Output> | Promise<Result<Output>>
    readonly types?: Types<Input, Output> | undefined
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult

  export interface SuccessResult<Output> {
    readonly value: Output
    readonly issues?: undefined
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>
  }

  export interface Issue {
    readonly message: string
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined
  }

  export interface PathSegment {
    readonly key: PropertyKey
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input
    readonly output: Output
  }
}

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    '~standard' in value &&
    typeof (value as StandardSchemaV1)['~standard']?.validate === 'function'
  )
}

/** An issue's path as a field path, e.g. `address.city` or `tags.0`. */
export function issuePath(issue: StandardSchemaV1.Issue): string {
  return (issue.path ?? [])
    .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
    .join('.')
}

/** Run a schema and return its issues, empty when the value passes. */
export async function schemaIssues(
  schema: StandardSchemaV1,
  value: unknown,
): Promise<ReadonlyArray<StandardSchemaV1.Issue>> {
  const result = await schema['~standard'].validate(value)
  return result.issues ?? []
}

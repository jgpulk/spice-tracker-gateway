// class-transformer's @Transform runs before class-validator's @IsString(),
// so calling .trim()/.toLowerCase()/.toUpperCase() directly on the raw value
// throws (uncaught -> 500) whenever a client sends a non-string, non-nullish
// value (a number, boolean, array, object) for a field that expects a
// trimmed string. These guard on typeof first so malformed input reaches
// @IsString() and fails cleanly with a 400 instead.
export const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export const trimUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

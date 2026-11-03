import { ZodError } from "zod";

interface ApiErrorOptions {
  statusCode: number;
  message?: string;
  errors?: unknown[];
  stack?: string;
}

class ApiError extends Error {
  public readonly statusCode: number;
  public readonly success = false;
  public readonly data = null;
  public readonly errors: unknown[];

  constructor({
    statusCode,
    message = "Something went wrong",
    errors = [],
    stack,
  }: ApiErrorOptions) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;

    this.errors = errors.flatMap((error) => {
      if (error instanceof ZodError) {
        return error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
      }

      return [error];
    });

    Object.setPrototypeOf(this, new.target.prototype);

    if (stack) {
      this.stack = stack;
    } else if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export { ApiError };

import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Errors we *expect* — bad input, missing auth, absent records. These carry a
 * status and a stable machine-readable code so the client can react (e.g. show
 * "Incorrect password" inline) instead of dumping a stack trace at the user.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "You need to sign in to do that.") {
    return new ApiError(401, "unauthorized", message);
  }
  static forbidden(message = "You don't have access to this.") {
    return new ApiError(403, "forbidden", message);
  }
  static notFound(message = "We couldn't find that.") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(code: string, message: string) {
    return new ApiError(409, code, message);
  }
  static tooMany(message = "Too many attempts. Try again in a minute.") {
    return new ApiError(429, "rate_limited", message);
  }
}

export type ApiErrorBody = {
  error: { code: string; message: string; details?: unknown };
};

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json<ApiErrorBody>(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    // Flatten to { field: "message" } so forms can render errors inline.
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json<ApiErrorBody>(
      {
        error: {
          code: "validation_failed",
          message: "Please check the highlighted fields.",
          details: fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  // Anything else is a bug. Log it server-side, tell the user something honest
  // and generic, and never leak internals to the browser.
  console.error("[api] unhandled error", error);
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong on our end. Please try again.",
      },
    },
    { status: 500 },
  );
}

type Handler<Ctx> = (request: Request, context: Ctx) => Promise<Response> | Response;

/** Wraps a route handler so every throw becomes a well-formed JSON error. */
export function route<Ctx>(handler: Handler<Ctx>): Handler<Ctx> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return jsonError(error);
    }
  };
}

/** Parses a JSON body, turning malformed payloads into a 400 rather than a 500. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw ApiError.badRequest("Expected a JSON request body.");
  }
}

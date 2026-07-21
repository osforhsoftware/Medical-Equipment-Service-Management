import { type Request, type Response, type NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { env } from "@/config/env";
import { failure } from "@/utils/response";

/** AppError — throw this anywhere to return a specific HTTP status code */
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Global error handler middleware.
 * Must be registered LAST in the Express app (after all routes).
 */
export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Known application error
  if (err instanceof AppError) {
    res.status(err.statusCode).json(failure(err.message));
    return;
  }

  // Prisma unique constraint violation
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json(failure("A record with that value already exists"));
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json(failure("Record not found"));
      return;
    }
    res.status(400).json(failure(`Database error: ${err.code}`));
    return;
  }

  // Validation errors (from Zod)
  if (err.name === "ZodError") {
    res.status(422).json(failure(err.message));
    return;
  }

  // Unknown error
  if (env.NODE_ENV === "development") {
    console.error("[error]", err);
    res.status(500).json(failure(err.message));
  } else {
    res.status(500).json(failure("Internal server error"));
  }
};

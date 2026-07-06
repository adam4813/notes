import { PathEscapeError } from "@notes/tome";
import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";

interface NodeErrnoException extends Error {
  code?: string;
}

/** Maps domain/validation errors to appropriate HTTP status codes. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({ error: "ValidationError", issues: error.issues });
    }

    if (error instanceof PathEscapeError) {
      return reply.status(400).send({ error: "PathEscapeError", message: error.message });
    }

    const errno = error as NodeErrnoException;
    if (errno.code === "ENOENT") {
      return reply.status(404).send({ error: "NotFound", message: errno.message });
    }
    if (errno.code === "EEXIST") {
      return reply.status(409).send({ error: "Conflict", message: errno.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "InternalError", message: errno.message });
  });
}

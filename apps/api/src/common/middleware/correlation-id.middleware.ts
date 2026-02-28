import crypto from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = (req.headers["x-correlation-id"] as string) ?? crypto.randomUUID();

    req.headers["x-correlation-id"] = correlationId;
    res.setHeader("x-correlation-id", correlationId);

    next();
  }
}

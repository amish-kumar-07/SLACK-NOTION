import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";

interface JwtPayload {
  id: string;
  email: string;
  role: "admin" | "user";
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return next(AppError.unauthorized("Token missing"));
    }

    const token = authHeader.split(" ")[1];
    if(!token)
    {
      return next(AppError.notFound("Token Not Found"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET!
    ) as unknown as JwtPayload;

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (err) {
    console.error("JWT error:", err);
    return next(AppError.unauthorized("Invalid or expired token"));
  }
}



export function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.log("role:", req.user);
  if (!req.user) {
    return next(AppError.unauthorized());
  }

  if (req.user.role === 'user') {
    return next(AppError.forbidden());
  }

  next();
}

export function userMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return next(AppError.unauthorized());
  }

  if (req.user.role === 'admin') {
    return next(AppError.forbidden());
  }

  next();
}

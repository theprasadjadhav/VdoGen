import type { Request } from "express";
import type { jwtType } from ".";


declare global {
  namespace Express {
    interface Request {
      user?: jwtType['data'];
    }
  }
}


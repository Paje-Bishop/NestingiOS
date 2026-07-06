declare global {
  namespace Express {
    interface Request {
      personId: number;
    }
  }
}

export {};

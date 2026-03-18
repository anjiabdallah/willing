import { Request, Response, NextFunction } from 'express';
import { Multer } from 'multer';

const uploadSingle = (multer: Multer, fieldName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    multer.single(fieldName)(req, res, (err: unknown) => {
      if (err instanceof Error) {
        res.status(400);
        next(err);
        return;
      }

      if (err) {
        res.status(400);
        next(new Error('Upload failed'));
        return;
      }

      next();
    });
  };
};

export default uploadSingle;

import { type NextFunction, type Request, type Response } from "express";
import { fileStorageService } from "@/services/fileStorage.service";
import { AppError } from "@/middleware/errorHandler";
import { success } from "@/utils/response";

export class FilesController {
  upload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw new AppError("A file is required", 422);
      const data = await fileStorageService.save(req.tenantId!, req.user!.userId, req.file);
      res.status(201).json(success("File uploaded", data));
    } catch (error) { next(error); }
  };

  metadata = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await fileStorageService.metadata(
        req.tenantId!, req.params.id, req.user!.userId, req.user!.role,
      );
      res.json(success("File metadata fetched", data));
    } catch (error) { next(error); }
  };

  download = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { file, buffer } = await fileStorageService.download(
        req.tenantId!, req.params.id, req.user!.userId, req.user!.role,
      );
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader("Content-Length", String(file.size));
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(buffer);
    } catch (error) { next(error); }
  };
}

export const filesController = new FilesController();

import { type Request, type Response, type NextFunction } from "express";
import { usersService } from "@/services/users.service";
import { success } from "@/utils/response";

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const role = req.query.role as string | undefined;
      const isActiveParam = req.query.isActive as string | undefined;
      const isActive = isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
      const data = await usersService.list(req.tenantId!, { role, isActive });
      res.json(success("Users fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await usersService.getById(req.params.id, req.tenantId!);
      res.json(success("User fetched successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await usersService.create(req.tenantId!, req.body);
      res.status(201).json(success("User created successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await usersService.update(req.params.id, req.tenantId!, req.body);
      res.json(success("User updated successfully", data));
    } catch (err) {
      next(err);
    }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await usersService.delete(req.params.id, req.tenantId!, req.user!.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();

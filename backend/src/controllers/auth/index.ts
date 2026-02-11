import { Router } from "express";
import { SignupSchema , LoginSchema} from "../../types/zodSchema.js";
import { createUser , findOne } from "../../services/auth/index.js";
import { AppError } from "../../utils/AppError.js";
import jwt from "jsonwebtoken";


const authRouter = Router();

authRouter.post("/signup", async (req, res, next) => {
  try {
    const { success, data } = SignupSchema.safeParse(req.body);

    if (!success) {
      return next(AppError.validation("Invalid signup data"));
    }

    const user = await createUser(
      data.name,
      data.email,
      data.password,
      data.role
    );

    if (!user) {
      return next(AppError.conflict("Email already exists"));
    }

    return res.status(201).json({
      success: true,
      user,
    });

  } catch (err) {
    return next(err instanceof AppError ? err : AppError.internal());
  }
});


authRouter.post("/login", async (req, res, next) => {
  try {
    const { success, data } = LoginSchema.safeParse(req.body);

    if (!success) {
      return next(AppError.validation("Invalid Schema!"));
    }

    const user = await findOne(data.email);

    if (!user) {
      return next(AppError.notFound("User Not Found"));
    }

    if (user.password !== data.password) {
      return next(AppError.validation("Incorrect Password"));
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!
    );

    return res.status(200).json({
      success: true,
      token,
    });

  } catch (err) {
    console.error(err);
    return next(err instanceof AppError ? err : AppError.internal());
  }
});


export default authRouter;

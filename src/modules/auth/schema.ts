import { z } from "zod";

export const signupSchema = z
  .object({
    email: z.email().min(3).max(255),
    password: z.string().min(6).max(255),
    confirmPassword: z.string().min(6).max(255),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const signupReturnSchema = z.object({
  email: z.email(),
});

export const loginSchema = z.object({
  email: z.email().min(3).max(255),
  password: z.string().min(6).max(255),
});

export const loginReturnSchema = z.object({
  email: z.email(),
  token: z.string(),
});

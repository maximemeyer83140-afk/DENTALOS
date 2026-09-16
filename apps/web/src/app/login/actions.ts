"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/lib/auth";

export interface LoginFormState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      totpCode: formData.get("totpCode") || undefined,
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Email, mot de passe ou code incorrect." };
    }
    throw error;
  }
}

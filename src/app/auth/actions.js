"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/neon";
import { syncAuthProfile } from "@/server/auth/sync-profile";

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

const signUpSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(12).max(128),
});

const resetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

function formString(formData, name) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signInWithEmail(_previousState, formData) {
  const parsed = signInSchema.safeParse({
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address and password." };
  }

  let result;

  try {
    result = await auth.signIn.email(parsed.data);
  } catch (error) {
    console.error("Neon Auth email sign-in request failed.", {
      message: error instanceof Error ? error.message : "Unknown authentication error",
    });

    return {
      error: "Unable to reach the sign-in service. Please try again.",
    };
  }

  const { error } = result;

  if (error) {
    return { error: error.message || "Sign in failed. Please try again." };
  }

  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to load the signed-in user profile.", {
      cause: sessionError,
    });
  }

  if (session?.user) {
    await syncAuthProfile(session.user);
  }

  redirect("/");
}

export async function signUpWithEmail(_previousState, formData) {
  const parsed = signUpSchema.safeParse({
    name: formString(formData, "name"),
    email: formString(formData, "email"),
    password: formString(formData, "password"),
  });

  if (!parsed.success) {
    return {
      error:
        "Enter a valid name and email. Passwords must be at least 12 characters.",
    };
  }

  let result;

  try {
    result = await auth.signUp.email(parsed.data);
  } catch (error) {
    console.error("Neon Auth email sign-up request failed.", {
      message: error instanceof Error ? error.message : "Unknown authentication error",
    });

    return {
      error: "Unable to reach the account service. Please try again.",
    };
  }

  const { error } = result;

  if (error) {
    return { error: error.message || "Account creation failed. Please try again." };
  }

  const { data: session, error: sessionError } = await auth.getSession();

  if (sessionError) {
    throw new Error("Unable to load the new user profile.", {
      cause: sessionError,
    });
  }

  if (session?.user) {
    await syncAuthProfile(session.user);
  }

  redirect("/");
}

export async function requestPasswordReset(_previousState, formData) {
  const parsed = resetRequestSchema.safeParse({
    email: formString(formData, "email"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email address." };
  }

  const appBaseUrl = process.env.APP_BASE_URL;

  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL is required for password reset links.");
  }

  const redirectTo = new URL("/auth/reset-password", appBaseUrl).toString();

  try {
    const { error } = await auth.requestPasswordReset({
      email: parsed.data.email,
      redirectTo,
    });

    if (error) {
      console.error("Neon Auth password reset request failed.", {
        message: error.message || "Unknown authentication error",
      });
      return {
        error: "Unable to request a reset email. Please try again.",
      };
    }
  } catch (error) {
    console.error("Neon Auth password reset request failed.", {
      message: error instanceof Error ? error.message : "Unknown authentication error",
    });
    return {
      error: "Unable to reach the password service. Please try again.",
    };
  }

  return {
    success:
      "If an account exists for this address, Neon Auth will send password reset instructions.",
  };
}

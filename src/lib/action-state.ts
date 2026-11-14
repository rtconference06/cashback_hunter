import { ValidationError } from "@/lib/validation";

export type FieldErrors = {
  email?: string;
};

export type ActionState = {
  error?: string;
  notice?: string;
  fieldErrors?: FieldErrors;
} | null;

export function validationToActionState(error: ValidationError): ActionState {
  if (error.field === "email") return { fieldErrors: { email: error.message } };
  return { error: error.message };
}

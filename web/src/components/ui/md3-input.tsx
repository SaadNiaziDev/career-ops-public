import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

export function Md3Input({
  icon,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  icon?: string;
}) {
  return (
    <label className={cn("md3-field", className)}>
      {icon ? (
        <MaterialSymbol name={icon} size={20} className="md3-field__icon" />
      ) : null}
      <input className="md3-field__input" {...props} />
    </label>
  );
}

export function Md3Textarea({
  icon,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & {
  icon?: string;
  ref?: Ref<HTMLTextAreaElement>;
}) {
  return (
    <label className={cn("md3-field md3-field--textarea", className)}>
      {icon ? (
        <MaterialSymbol name={icon} size={20} className="md3-field__icon mt-1 self-start" />
      ) : null}
      <textarea className="md3-field__input min-h-[80px] resize-y" {...props} />
    </label>
  );
}

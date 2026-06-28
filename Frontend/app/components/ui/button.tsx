import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className = "",
  variant = "default",
  type = "button",
  ...props
}: ButtonProps) {
  const variantClass = variant === "outline" ? "btn-outline" : "btn-primary";

  return (
    <button
      type={type}
      className={`${variantClass} ${className}`.trim()}
      {...props}
    />
  );
}

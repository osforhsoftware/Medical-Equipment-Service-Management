import * as React from "react";

import { normalizeNumberInputValue } from "@/lib/numberInput";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onFocus, onBlur, onChange, onMouseUp, ...props }, ref) => {
    const isNumber = type === "number";

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      if (isNumber) {
        // Select default "0" (or any current value) so the next keystroke replaces it
        // instead of appending and creating leading zeroes like "010".
        const input = event.currentTarget;
        requestAnimationFrame(() => {
          if (document.activeElement === input) input.select();
        });
      }
      onFocus?.(event);
    };

    const handleMouseUp = (event: React.MouseEvent<HTMLInputElement>) => {
      if (isNumber) {
        // Prevent the browser from clearing the selection right after focus+click.
        event.preventDefault();
      }
      onMouseUp?.(event);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isNumber) {
        const normalized = normalizeNumberInputValue(event.target.value);
        if (normalized !== event.target.value) {
          event.target.value = normalized;
        }
      }
      onChange?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      if (isNumber) {
        const raw = event.target.value.trim();
        // Empty / incomplete → leave empty for string forms; number parents
        // that use `Number(x) || 0` will restore 0 on the next render.
        if (raw === "" || raw === "-" || raw === "." || raw === "-.") {
          if (event.target.value !== "") {
            event.target.value = "";
            onChange?.(event);
          }
        } else {
          const normalized = normalizeNumberInputValue(raw);
          if (normalized !== event.target.value) {
            event.target.value = normalized;
            onChange?.(event);
          }
        }
      }
      onBlur?.(event);
    };

    return (
      <input
        {...props}
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground shadow-none ring-offset-background transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/80 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 md:text-sm",
          className,
        )}
        ref={ref}
        onFocus={handleFocus}
        onMouseUp={handleMouseUp}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

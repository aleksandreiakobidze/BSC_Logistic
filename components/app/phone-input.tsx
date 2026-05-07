"use client";

import * as React from "react";
import PhoneInputLib from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface PhoneFieldProps {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function PhoneField({
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "+995 …",
  className,
}: PhoneFieldProps) {
  const [val, setVal] = React.useState(defaultValue ?? "");

  const currentValue = controlledValue !== undefined ? controlledValue : val;

  function handleChange(v: string | undefined) {
    const next = v ?? "";
    if (controlledValue === undefined) setVal(next);
    onChange?.(v);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={currentValue} />}
      <PhoneInputLib
        international
        defaultCountry="GE"
        value={currentValue}
        onChange={handleChange}
        placeholder={placeholder}
        className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-within:ring-1 focus-within:ring-ring ${className ?? ""}`}
      />
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { searchDescriptions } from "./actions";

/** Free-text description with suggestions from the user's own recent entries (native datalist). */
export function DescriptionInput({
  name = "description",
  defaultValue,
  autoFocus,
  placeholder,
  "aria-label": ariaLabel,
}: {
  name?: string;
  defaultValue?: string;
  autoFocus?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const listId = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  function suggest(value: string) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setOptions(await searchDescriptions(value));
      } catch {
        setOptions([]); // suggestions are a convenience; never block typing
      }
    }, 200);
  }

  return (
    <>
      <Input
        name={name}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={500}
        list={listId}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onInput={(e) => suggest(e.currentTarget.value)}
        onFocus={(e) => suggest(e.currentTarget.value)}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </>
  );
}

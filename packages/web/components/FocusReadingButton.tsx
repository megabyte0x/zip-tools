"use client";

import { Focus } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import styles from "./ReaderShell.module.css";

export function FocusReadingButton() {
  const [focused, setFocused] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      className={styles.focusControl}
      aria-pressed={focused}
      title={focused ? "Show the sidebars" : "Hide the sidebars to focus on the proposal"}
      onClick={() => setFocused((value) => !value)}
    >
      <Focus aria-hidden="true" />
      <span>Focus reading</span>
      {focused ? <span className={styles.focusState} aria-hidden="true">On</span> : null}
    </Button>
  );
}

export type RowClick = {
  /** The click landed on (or inside) a link, button, input or summary. */
  targetInteractive: boolean;
  modifier: boolean;
  button: number;
  selection: string;
};

/** A table row acts as a link only for a plain primary click that is not selecting text. */
export function shouldNavigateRow(click: RowClick): boolean {
  if (click.targetInteractive || click.modifier || click.button !== 0) return false;
  return click.selection.trim() === "";
}

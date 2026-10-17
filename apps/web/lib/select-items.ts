import * as React from "react";

// Base UI 1.9 hanya tahu label item terpilih dari prop `items` di Root — item di
// dalam Popup tidak pernah terdaftar, dan Popup di-unmount saat dropdown tertutup.
// Tanpa `items`, trigger menampilkan value mentah (mis. cuid kelas) atau placeholder
// selamanya. Helper ini menurunkan peta {value: label} dari anak <SelectItem>.
export function itemsFromChildren(
  children: React.ReactNode,
  isItem: (type: unknown) => boolean,
): Record<string, React.ReactNode> | undefined {
  const map: Record<string, React.ReactNode> = {};
  walk(children, isItem, map);
  return Object.keys(map).length > 0 ? map : undefined;
}

function walk(
  children: React.ReactNode,
  isItem: (type: unknown) => boolean,
  map: Record<string, React.ReactNode>,
): void {
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode };
    if (isItem(child.type)) {
      if (props.value != null && !(props.value in map)) {
        // Hanya label primitif (mis. {c.name}); label berisi elemen dibiarkan kosong
        // supaya jatuh kembali ke value, sama seperti sebelum perbaikan ini.
        const label = React.Children.toArray(props.children)
          .filter((n) => typeof n === "string" || typeof n === "number")
          .join("");
        if (label) map[props.value] = label;
      }
      return;
    }
    if (props.children != null) walk(props.children, isItem, map);
  });
}

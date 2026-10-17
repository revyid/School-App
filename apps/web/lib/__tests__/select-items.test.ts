import { describe, expect, it } from "vitest";
import * as React from "react";
import { itemsFromChildren } from "../select-items";

const Item = (_props: { value?: string; children?: React.ReactNode }): null => null;
const Popup = (props: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, props.children);
const isItem = (t: unknown) => t === Item;

describe("itemsFromChildren", () => {
  it("maps value -> label untuk item langsung", () => {
    const children = [React.createElement(Item, { key: "a", value: "c1" }, "XI B")];
    expect(itemsFromChildren(children, isItem)).toEqual({ c1: "XI B" });
  });

  it("menemukan item di dalam wrapper (Positioner/Popup) dan Fragment", () => {
    const children = React.createElement(
      Popup,
      null,
      React.createElement(Item, { value: "1" }, "Sen"),
      React.createElement(React.Fragment, null, React.createElement(Item, { value: "2" }, "Sel")),
    );
    expect(itemsFromChildren(children, isItem)).toEqual({ 1: "Sen", 2: "Sel" });
  });

  it("menggabungkan label dari beberapa anak teks", () => {
    const children = [React.createElement(Item, { key: "a", value: "fis" }, "Fisika", " (baru)")];
    expect(itemsFromChildren(children, isItem)).toEqual({ fis: "Fisika (baru)" });
  });

  it("item pertama menang saat value duplikat", () => {
    const children = [
      React.createElement(Item, { key: "a", value: "x" }, "Pertama"),
      React.createElement(Item, { key: "b", value: "x" }, "Kedua"),
    ];
    expect(itemsFromChildren(children, isItem)).toEqual({ x: "Pertama" });
  });

  it("melewati label berisi elemen (jatuh kembali ke value)", () => {
    const children = [React.createElement(Item, { key: "a", value: "x" }, React.createElement("b", null, "tebal"))];
    expect(itemsFromChildren(children, isItem)).toBeUndefined();
  });

  it("mengembalikan undefined bila tak ada item", () => {
    expect(itemsFromChildren(null, isItem)).toBeUndefined();
    expect(itemsFromChildren(["teks biasa"], isItem)).toBeUndefined();
  });
});

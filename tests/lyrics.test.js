import { describe, it, expect } from "vitest";
import { parseLRC } from "../src/lyrics/parse.js";
import { cleanTitle } from "../src/lyrics/lrclib.js";

describe("parseLRC", () => {
  it("reads timestamps in milliseconds and sorts lines", () => {
    const out = parseLRC("[00:12.50] second\n[00:01.00] first\n[ar:Someone]\nno tag here");
    expect(out).toEqual([{ t: 1000, text: "first" }, { t: 12500, text: "second" }]);
  });
  it("repeats a line that carries several timestamps and keeps instrumental gaps", () => {
    const out = parseLRC("[00:05.00][00:20.00] chorus\n[00:10.00]");
    expect(out.map(l => [l.t, l.text])).toEqual([[5000, "chorus"], [10000, ""], [20000, "chorus"]]);
  });
});

describe("cleanTitle", () => {
  it("drops bracketed extras and dash suffixes", () => {
    expect(cleanTitle("Lover (From \"Film\") [Remix]")).toBe("Lover");
    expect(cleanTitle("Song Name - Remastered 2011")).toBe("Song Name");
  });
});

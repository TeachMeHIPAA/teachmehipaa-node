// TypeDoc names a Markdown document after its path, such as
// "docs/guides/webhooks", unless it has `title` front matter, which GitHub
// would render as a table above each guide. This names each document after
// its first heading instead, so the site and GitHub read the same.
import { Converter } from "typedoc";

/** @param {import("typedoc").Application} app */
export const load = (app) => {
  app.converter.on(Converter.EVENT_CREATE_DOCUMENT, (_context, document) => {
    const text = document.content.map((part) => part.text).join("");
    const heading = /^# (.+)$/m.exec(text)?.[1]?.trim();
    if (heading !== undefined) {
      document.name = heading;
    }
  });
};

import fs from "fs";
import path from "path";
import { JSDOM } from "jsdom";

export async function addScriptToHtml(content: string, outputPath: string) {
  try {
    const html = fs.readFileSync(
      path.resolve(__dirname, "..", "public", "index.html"),
      "utf-8",
    );

    // Parse HTML with JSDOM
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Create the script element
    const script = document.createElement("script");
    script.textContent = content;
    document.head.appendChild(script);

    // Serialize and save the modified HTML
    const modifiedHtml = dom.serialize();

    fs.writeFileSync(outputPath, modifiedHtml);
  } catch (error) {
    console.log(error);
  }
}

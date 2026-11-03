import { readFile, writeFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const root = new URL("./", import.meta.url);
let html = await readFile(new URL("index.html", root), "utf8");
const css = await readFile(new URL("styles.css", root), "utf8");
const config = await readFile(new URL("config.js", root), "utf8");
const script = await readFile(new URL("app.js", root), "utf8");
html = html.replace('<link rel="stylesheet" href="styles.css">', `<style>${css}</style>`);
html = html.replace('<script src="config.js" defer></script><script src="app.js" defer></script>', "");
for (const [name, mime] of [["hero-logo.webm", "video/webm"], ["logo.svg", "image/svg+xml"], ["openai.svg", "image/svg+xml"]]) {
  const bytes = await readFile(new URL(name, root));
  html = html.replaceAll(`"${name}"`, `"data:${mime};base64,${bytes.toString("base64")}"`);
}
html = html.replace("</body>", `<script>${config.replaceAll("</script", "<\\/script")}</script><script>${script.replaceAll("</script", "<\\/script")}</script></body>`);
await writeFile(new URL("Hubitos-动态助手-demo.html", root), html, "utf8");
const configContext = { window: {} };
runInNewContext(config, configContext);
await writeFile(new URL("config.json", root), JSON.stringify(configContext.window.HUBITOS_HOME_CONFIG, null, 2), "utf8");
console.log("Built standalone HTML.");

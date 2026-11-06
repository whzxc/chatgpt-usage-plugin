import { fileURLToPath } from "node:url";
import path from "node:path";
import { createServer } from "vite";
const root = fileURLToPath(new URL("../", import.meta.url));
export async function startDesignDev(port = 5191) {
  const server = await createServer({
    configFile: path.join(root, "vite.config.ts"),
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
      fs: { allow: [root] },
    },
    plugins: [
      {
        name: "usage-design-review",
        enforce: "pre",
        resolveId(source, importer) {
          if (
            importer &&
            source.startsWith(".") &&
            path
              .resolve(path.dirname(importer), source)
              .replace(/\.tsx?$/, "") === path.join(root, "ui/app/bridge")
          )
            return path.join(root, "tooling/design-review/bridge.ts");
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url?.split("?")[0] !== "/__design/review")
              return next();
            try {
              const html = await vite.transformIndexHtml(
                request.url,
                `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${path.join(root, "tooling/design-review/main.tsx")}"></script></body></html>`,
              );
              response.setHeader("Content-Type", "text/html");
              response.setHeader("Cache-Control", "no-store");
              response.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
  });
  await server.listen();
  return () => server.close();
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const stop = await startDesignDev();
  console.log(
    "Design review: http://127.0.0.1:5191/__design/review?fixture=cup-overview-ready",
  );
  process.on("SIGINT", () => void stop());
  process.on("SIGTERM", () => void stop());
}

/**
 * Lance les vérifications ROSACE avec les serveurs Vite nécessaires.
 * Conserve le code métier inchangé et arrête les serveurs même en cas d'échec.
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const vite = resolve("node_modules/vite/bin/vite.js");
const host = "127.0.0.1";
let server = null;

async function command(name, env = {}) {
  console.log("\n[ROSACE] " + name);
  await new Promise((ok, fail) => {
    const child = spawn(npm, ["run", name], {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });
    child.once("error", fail);
    child.once("exit", (code, signal) => {
      if (code === 0) ok();
      else fail(new Error(name + " a échoué (" + (signal ?? "exit " + code) + ")."));
    });
  });
}

async function startServer(mode, port) {
  const url = "http://" + host + ":" + port;
  console.log("\n[ROSACE] Démarrage " + mode + " : " + url);
  server = spawn(process.execPath, [vite, ...(mode === "preview" ? ["preview"] : []), "--host", host, "--port", String(port), "--strictPort"], {
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: process.env,
  });
  let startError = null;
  server.once("error", (error) => { startError = error; });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (startError) throw startError;
    if (server.exitCode !== null) throw new Error(mode + " s'est arrêté prématurément.");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return url;
    } catch { /* Attendre le démarrage. */ }
    await delay(250);
  }
  throw new Error("Serveur " + mode + " indisponible après 20 secondes.");
}

function stopServer() {
  if (!server) return;
  const child = server;
  server = null;
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch (error) {
    if (error?.code !== "ESRCH") console.warn("Impossible d'arrêter le serveur :", error);
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopServer();
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  });
}

try {
  await command("test");
  await command("typecheck");
  await command("build");
  await command("licenses");
  const devUrl = await startServer("dev", 5173);
  await command("test:browser", { BASE_URL: devUrl });
  await command("test:a11y", { BASE_URL: devUrl });
  stopServer();
  const previewUrl = await startServer("preview", 4173);
  await command("test:preview", { BASE_URL: previewUrl });
  console.log("\n[ROSACE] Validation complète réussie.");
} catch (error) {
  console.error("\n[ROSACE] Validation échouée :", error);
  process.exitCode = 1;
} finally {
  stopServer();
}

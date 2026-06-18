import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { CONTROL_PORT, OMT_PORT } from "./network_constants";

const execFileAsync = promisify(execFile);

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("which", [command]);
    return true;
  } catch {
    return false;
  }
}

async function runFirewallCommand(command: string, args: string[]): Promise<void> {
  try {
    await execFileAsync(command, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Firewall] ${command} ${args.join(" ")} failed: ${message}`);
  }
}

export async function ensureFirewallRules(): Promise<void> {
  const appPath = process.execPath;

  if (process.platform === "win32") {
    await runFirewallCommand("netsh", [
      "advfirewall",
      "firewall",
      "add",
      "rule",
      "name=HallelujahBeamer OMT TCP",
      "dir=in",
      "action=allow",
      "protocol=TCP",
      `localport=${OMT_PORT}`,
    ]);
    await runFirewallCommand("netsh", [
      "advfirewall",
      "firewall",
      "add",
      "rule",
      "name=HallelujahBeamer Discovery UDP",
      "dir=in",
      "action=allow",
      "protocol=UDP",
      `localport=${CONTROL_PORT}`,
    ]);
    return;
  }

  if (process.platform === "darwin") {
    const socketFilterFw = "/usr/libexec/ApplicationFirewall/socketfilterfw";
    await runFirewallCommand(socketFilterFw, ["--add", appPath]);
    await runFirewallCommand(socketFilterFw, ["--unblockapp", appPath]);
    return;
  }

  if (process.platform === "linux") {
    if (await commandExists("firewall-cmd")) {
      await runFirewallCommand("firewall-cmd", ["--add-port", `${OMT_PORT}/tcp`, "--permanent"]);
      await runFirewallCommand("firewall-cmd", ["--add-port", `${CONTROL_PORT}/udp`, "--permanent"]);
      await runFirewallCommand("firewall-cmd", ["--reload"]);
      return;
    }

    if (await commandExists("ufw")) {
      await runFirewallCommand("ufw", ["allow", `${OMT_PORT}/tcp`, "comment", "HallelujahBeamer OMT"]);
      await runFirewallCommand("ufw", ["allow", `${CONTROL_PORT}/udp`, "comment", "HallelujahBeamer Discovery"]);
      return;
    }

    console.warn("[Firewall] No supported Linux firewall manager found.");
  }
}

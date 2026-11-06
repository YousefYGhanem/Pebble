import { execFile, spawn } from 'node:child_process'

// Can a phone on the same network reach this PC? Windows blocks incoming connections when the network is set to
// "Public", or when no firewall rule lets this program in. Both are checked (read-only) when phone drop starts.

export interface Reach { profile: 'Private' | 'Public' | 'DomainAuthenticated' | 'unknown'; allowed: boolean }

const ps = (script: string) => new Promise<string>(resolve =>
  // encoded: quotes in a -Command argument do not survive Windows' command-line parsing
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000 }, (_e, out) => resolve(String(out).trim())))

/** The active network's type, and whether an enabled inbound "allow" rule covers this program on it. */
export async function checkReach(exe: string): Promise<Reach> {
  const out = await ps(
    '$p = (Get-NetConnectionProfile | Where-Object IPv4Connectivity -ne Disconnected | Select-Object -First 1).NetworkCategory\n' +
    `$exe = '${exe.replace(/'/g, "''")}'\n` +
    // Windows keeps the rule's path in lower case: compare without case
    '$ok = @(Get-NetFirewallApplicationFilter | Where-Object { $_.Program -ieq $exe } | Get-NetFirewallRule | ' +
    'Where-Object { $_.Enabled -eq "True" -and $_.Direction -eq "Inbound" -and $_.Action -eq "Allow" -and ($_.Profile -eq "Any" -or "$($_.Profile)" -match "$p") }).Count -gt 0\n' +
    '"$p|$ok"')
  const [profile, ok] = out.split('|')
  return { profile: (['Private', 'Public', 'DomainAuthenticated'].includes(profile!) ? profile : 'unknown') as Reach['profile'], allowed: ok === 'True' }
}

/**
 * Adds the firewall rule that lets this program take connections on private networks. Windows asks you first
 * (administrator prompt); nothing changes if you say no.
 */
export function allowInFirewall(exe: string) {
  const rule = `New-NetFirewallRule -DisplayName 'Pebble phone drop' -Direction Inbound -Action Allow -Profile Private -Program '${exe.replace(/'/g, "''")}'`
  spawn('powershell.exe', ['-NoProfile', '-Command', `Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList '-NoProfile','-Command',"${rule.replace(/"/g, '`"')}"`],
    { windowsHide: true, detached: true, stdio: 'ignore' }).unref()
}

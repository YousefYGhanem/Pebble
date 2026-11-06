// Code signing through SignPath (signpath.io; free for open-source projects through the SignPath Foundation).
// electron-builder calls this for every .exe it builds (win.signtoolOptions.sign in electron-builder.yml), before it
// writes latest.yml, so the update checksums are those of the signed files.
// Until the SIGNPATH_* secrets exist (docs/RELEASING.md → Code signing) it does nothing and the build stays unsigned.
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')

exports.default = async function sign(configuration) {
  const env = process.env
  if (!env.SIGNPATH_API_TOKEN) return
  const file = configuration.path, signed = `${file}.signed`
  const q = s => `'${String(s).replace(/'/g, "''")}'` // a PowerShell string
  const origin = env.GITHUB_SHA ? ` -Origin @{ RepositoryData = @{ SourceControlManagementType = 'git'; Url = ${q(`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}`)}; BranchName = ${q(env.GITHUB_REF_NAME)}; CommitId = ${q(env.GITHUB_SHA)} }; BuildData = @{ Url = ${q(`${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`)} } }` : ''
  const command = 'Import-Module SignPath; Submit-SigningRequest' +
    ` -InputArtifactPath ${q(file)} -OutputArtifactPath ${q(signed)} -WaitForCompletion -Force` +
    ' -OrganizationId $env:SIGNPATH_ORGANIZATION_ID -ApiToken $env:SIGNPATH_API_TOKEN' +
    ' -ProjectSlug $env:SIGNPATH_PROJECT_SLUG -SigningPolicySlug $env:SIGNPATH_POLICY_SLUG' + origin
  execFileSync('pwsh', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' })
  fs.renameSync(signed, file)
}

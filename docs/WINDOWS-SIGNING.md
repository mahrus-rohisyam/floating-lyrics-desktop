# Windows release signing

The Windows release workflow requires a trusted code-signing certificate before publishing a new release. No certificate or password is stored in this repository. The existing alpha.2 installer remains unsigned. Modern publicly trusted certificates normally keep private keys in hardware-backed storage; the PFX path below works only if your provider explicitly supports exporting a suitable signing key.

## Local build with a certificate already in Windows

1. Obtain a **code-signing** certificate from a trusted provider. An SSL/TLS certificate or self-signed certificate will not establish a verified publisher for public downloads. Follow the provider's instructions to make its private key available in `Cert:\CurrentUser\My` on the build machine.
2. Open `certmgr.msc` → Personal → Certificates and copy the certificate's 40-character SHA-1 **thumbprint**. Obtain the provider's timestamp URL.
3. Set the variables in the PowerShell session (fill your own values):

   ```powershell
   $env:FL_WINDOWS_SIGN_THUMBPRINT = '<40-character-thumbprint>'
   $env:FL_WINDOWS_SIGN_TIMESTAMP_URL = '<provider-timestamp-url>'
   $env:FL_REQUIRE_WINDOWS_SIGNING = '1'
   npm.cmd run desktop:build
   ```

4. Verify **both** the bundled application executable and installer. The output is under `.tools/release-target/release/` by default:

   ```powershell
   Get-AuthenticodeSignature '.tools/release-target/release/floating-lyrics.exe' | Select-Object Status,SignerCertificate
   Get-ChildItem '.tools/release-target/release/bundle/nsis/*.exe' | ForEach-Object { Get-AuthenticodeSignature $_.FullName | Select-Object Status,SignerCertificate }
   ```

   Both statuses must be `Valid`. Check the actual executable name in the build output if it changes. A signed new file may still receive a SmartScreen reputation warning. Cortex XDR can make a separate policy decision.

## Modern cloud signing command

Tauri can call a provider's signing CLI for each Windows executable and installer. Set `FL_WINDOWS_SIGN_COMMAND` to a command containing Tauri's `%1` file placeholder, and `FL_REQUIRE_WINDOWS_SIGNING=1` when building locally. Do not set the thumbprint variables in the same build. The provider CLI and its authentication must already be available in the build environment.

For the [Azure Artifact Signing CLI](https://v2.tauri.app/distribute/sign/windows/#azure-artifact-signing), an example command is:

```text
artifact-signing-cli -e https://<your-region>.codesigning.azure.net -a <account> -c <certificate-profile> -d "Floating Lyrics Preview" %1
```

In GitHub repository **Settings → Secrets and variables → Actions**, set `WINDOWS_SIGN_COMMAND` as a secret, set `WINDOWS_SIGN_PROVIDER` as a variable with value `artifact-signing`, and add secrets `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID`. The workflow installs the CLI and passes those credentials to it. Confirm your account is eligible for this Microsoft service before choosing it. If you use another provider, adapt its CLI setup step and command; the app's Tauri signing hook is already available.

## PFX certificate path, if your provider supports it

The workflow can instead import a PFX certificate into the temporary Windows runner account. This path is suitable only if your certificate provider permits PFX export. If your key is hardware-backed or your provider uses a cloud signing service, use its `signCommand` integration above instead of trying to extract the key.

Set these GitHub repository settings under **Settings → Secrets and variables → Actions**:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `WINDOWS_SIGN_PFX_BASE64` | Base64 encoding of the complete PFX file. |
| Secret | `WINDOWS_SIGN_PFX_PASSWORD` | PFX export password. |
| Secret | `WINDOWS_SIGN_THUMBPRINT` | SHA-1 thumbprint of the certificate in the PFX. |
| Variable | `WINDOWS_SIGN_TIMESTAMP_URL` | Timestamp URL supplied by the certificate provider. |

Generate the Base64 value locally without writing an extra file:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\private\your-code-signing-cert.pfx'))
```

Paste the result directly into the GitHub secret. Do not put the PFX, password, or Base64 output in a commit, issue, log, or chat. The workflow checks that all values exist before either platform job can publish. The Windows job imports the PFX, checks its thumbprint, and passes the signing settings into Tauri. Verify the uploaded installer on a clean machine after release.

Use **either** the cloud command or PFX configuration; remove the old settings when switching methods. The workflow keeps the release as a draft until Windows signature verification and both platform builds succeed.

For an eligible open-source project, [SignPath Foundation](https://signpath.org/terms.html) is another route, but it has its own acceptance and release rules. Its certificate displays SignPath Foundation as the publisher. A standard personal or organization certificate displays its verified holder name.

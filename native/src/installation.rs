use crate::*;
#[derive(Clone)]
pub struct Installation {
    #[cfg(windows)]
    pub app: PathBuf,
    pub binary: PathBuf,
}
#[cfg(not(windows))]
pub fn installation() -> Option<Installation> {
    if !cfg!(target_os = "macos") {
        return None;
    }
    for root in [
        PathBuf::from("/Applications"),
        dirs::home_dir()?.join("Applications"),
    ] {
        for name in ["ChatGPT", "Codex"] {
            let app = root.join(format!("{name}.app"));
            let binary = app.join("Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex");
            if binary.is_file() {
                return Some(Installation { binary });
            }
        }
    }
    None
}
#[cfg(windows)]
pub fn installation() -> Option<Installation> {
    windows::installation()
}

#[cfg(windows)]
mod windows {
    use super::*;
    use std::{os::windows::process::CommandExt, sync::OnceLock};
    pub(super) fn installation() -> Option<Installation> {
        static CACHE: OnceLock<std::sync::Mutex<Option<Installation>>> = OnceLock::new();
        let mut cache = CACHE.get_or_init(Default::default).lock().ok()?;
        if let Some(i) = cache
            .as_ref()
            .filter(|i| i.app.is_file() && i.binary.is_file())
        {
            return Some(i.clone());
        }
        let out = std::process::Command::new("powershell.exe")
        .args(["-NoProfile", "-NonInteractive", "-Command", "[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new(); Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1 -ExpandProperty InstallLocation"])
        .creation_flags(0x08000000).output().ok()?;
        if !out.status.success() {
            return None;
        }
        let location = String::from_utf8(out.stdout).ok()?;
        let app = PathBuf::from(location.trim()).join("app/ChatGPT.exe");
        if !app.is_file() {
            return None;
        }
        let resources = app.parent()?.join("resources");
        // Store executables cannot be launched by an unpackaged process. Keep the
        // bundled CLI and its sibling helpers together in a user-owned directory.
        let names = [
            "codex.exe",
            "codex-code-mode-host.exe",
            "codex-windows-sandbox-setup.exe",
            "codex-command-runner.exe",
        ];
        use sha2::{Digest, Sha256};
        use std::io::Read;
        let mut digest = Sha256::new();
        for name in names {
            digest.update(name.as_bytes());
            let mut file = std::fs::File::open(resources.join(name)).ok()?;
            let mut bytes = [0; 65536];
            loop {
                let len = file.read(&mut bytes).ok()?;
                if len == 0 {
                    break;
                }
                digest.update(&bytes[..len]);
            }
        }
        let directory = root()
            .join("bin/codex-desktop")
            .join(format!("{:x}", digest.finalize()));
        private_dir(&directory).ok()?;
        for name in names {
            let source = resources.join(name);
            let destination = directory.join(name);
            if std::fs::metadata(&destination).ok().map(|m| m.len())
                != Some(std::fs::metadata(&source).ok()?.len())
            {
                let temporary = directory.join(format!("{name}.tmp"));
                std::fs::copy(source, &temporary).ok()?;
                std::fs::rename(temporary, destination).ok()?;
            }
        }
        let installation = Installation {
            app,
            binary: directory.join("codex.exe"),
        };
        *cache = Some(installation.clone());
        Some(installation)
    }
}

// Build-only Rust helper. Retain original dependency copyright/license files.
use std::{env, fs, path::PathBuf};
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let registry = PathBuf::from(
        env::var("CARGO_HOME").unwrap_or_else(|_| format!("{}/.cargo", env::var("HOME").unwrap())),
    )
    .join("registry/src");
    let lock = fs::read_to_string("vendor/link-style-core/Cargo.lock")?;
    let mut name = String::new();
    for line in lock.lines() {
        if let Some(value) = line.strip_prefix("name = \"") {
            name = value.trim_end_matches('"').to_owned();
        }
        if let Some(value) = line.strip_prefix("version = \"") {
            let version = value.trim_end_matches('"');
            if name.is_empty() || name == "link-style-core" {
                continue;
            }
            let package = format!("{name}-{version}");
            let source = fs::read_dir(&registry)?
                .filter_map(Result::ok)
                .map(|entry| entry.path().join(&package))
                .find(|p| p.is_dir())
                .ok_or_else(|| format!("Missing cached {package}; run cargo fetch first"))?;
            let target = PathBuf::from("docs/licenses").join(&package);
            let mut copied = 0;
            for entry in fs::read_dir(source)? {
                let entry = entry?;
                let filename = entry.file_name();
                let text = filename.to_string_lossy().to_ascii_lowercase();
                if entry.file_type()?.is_file()
                    && (text.starts_with("license")
                        || text.starts_with("copying")
                        || text.starts_with("copyright"))
                {
                    fs::create_dir_all(&target)?;
                    fs::copy(entry.path(), target.join(filename))?;
                    copied += 1;
                }
            }
            if copied == 0 {
                return Err(format!("No license files found for {package}").into());
            }
            println!("{package}: {copied} notice files");
        }
    }
    Ok(())
}

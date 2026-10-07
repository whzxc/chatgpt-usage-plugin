use chatgpt_usage_plugin::{plugin, Result};
#[tokio::main]
async fn main() {
    let result: Result<()> = match std::env::args().nth(1).as_deref() {
        None | Some("mcp") => plugin::stdio().await,
        Some("--version") => {
            println!("{}", env!("CARGO_PKG_VERSION"));
            Ok(())
        }
        _ => Err("Usage: chatgpt-usage [mcp | --version]".into()),
    };
    if let Err(error) = result {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

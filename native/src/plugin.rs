//! Standalone local plugin entrypoint over the same leased Core used by Desktop.
use crate::*;
use base64::{engine::general_purpose::STANDARD, Engine};
use tokio::io::{AsyncWriteExt, BufReader};
const HTML: &str = include_str!("../../dist/plugin/app.html");
const ICON: &[u8] = include_bytes!("../../plugins/usage/assets/icon.svg");
fn icons() -> Value {
    json!([{"src":format!("data:image/svg+xml;base64,{}", STANDARD.encode(ICON)),"mimeType":"image/svg+xml","sizes":["any"]}])
}
fn uri() -> String {
    format!(
        "ui://chatgpt-usage/panel-{}-{}.html",
        env!("CARGO_PKG_VERSION"),
        &hash(HTML)[..12]
    )
}
fn tool(name: &str, title: &str, entry: Option<&str>) -> Value {
    let mut meta = json!({"ui":{"resourceUri":uri(),"visibility":["app"]}});
    if let Some(entry) = entry {
        meta["openai/ui"] = json!({"entrypoints":[{"type":entry}]});
    }
    json!({"name":name,"title":title,"icons":icons(),"description":"Read Codex usage from readable native logs. No model turn or account changes.","inputSchema":{"type":"object","properties":{"taskPage":{"type":"integer","minimum":1},"taskPageSize":{"type":"integer","enum":[5,10,20,50,100]},"taskSearch":{"type":"string","maxLength":200},"refreshQuota":{"type":"boolean"},"scope":{"enum":["global","thread"]},"threadId":{"type":"string","maxLength":128},"days":{"enum":[1,7,30]},"turnId":{"type":"string","maxLength":128},"toolId":{"type":"string","maxLength":256},"responseOffset":{"type":"integer","minimum":0},"toolOffset":{"type":"integer","minimum":0}},"additionalProperties":false},"annotations":{"readOnlyHint":true,"destructiveHint":false,"openWorldHint":false},"_meta":meta})
}
pub fn tools() -> Value {
    json!({"tools":[tool("usage_overview","Usage overview",Some("global")),
        tool("usage_task","Task usage",Some("thread")),tool("usage_refresh","Refresh usage",None)]})
}
async fn dispatch(request: Value) -> Value {
    let id = request["id"].clone();
    let params = &request["params"];
    let result: Result<Value> = match string(&request, "method") {
        "initialize" => Ok(
            json!({"protocolVersion":"2025-11-25","capabilities":{"tools":{},"resources":{}},
            "serverInfo":{"name":"chatgpt-usage","version":env!("CARGO_PKG_VERSION"),"icons":icons()}}),
        ),
        "ping" => Ok(json!({})),
        "tools/list" => Ok(tools()),
        "resources/list" => Ok(
            json!({"resources":[{"uri":uri(),"name":"Usage Insights","mimeType":"text/html;profile=mcp-app"}]}),
        ),
        "resources/read" if params["uri"] == uri() => resource().await,
        "tools/call"
            if ["usage_overview", "usage_task", "usage_refresh"]
                .contains(&string(params, "name")) =>
        {
            let name = string(params, "name");
            let args = params.get("arguments").cloned().unwrap_or(json!({}));
            let scope = if name == "usage_overview"
                || (name == "usage_refresh" && args["scope"] == "global")
            {
                "global"
            } else {
                "thread"
            };
            let quota = crate::quota::snapshot(args["refreshQuota"] == true).await;
            let meta = json!({"threadId":params["_meta"]["threadId"],"thread_id":params["_meta"]["thread_id"]});
            match crate::usage::query(args, meta, scope.into()).await {
                Ok(mut data) => {
                    data["quota"] = quota;
                    Ok(
                        json!({"content":[{"type":"text","text":"Codex usage panel; detailed statistics are displayed only in the panel."}],
                        "structuredContent":{"scope":scope,"state":data["state"]},"_meta":{"ui":{"resourceUri":uri()},"usage":data}}),
                    )
                }
                Err(error) => Err(error),
            }
        }
        _ => Err("method not found".into()),
    };
    match result {
        Ok(result) => json!({"jsonrpc":"2.0","id":id,"result":result}),
        Err(message) => json!({"jsonrpc":"2.0","id":id,"error":{"code":-32601,"message":message}}),
    }
}
async fn resource() -> Result<Value> {
    let mut html = HTML.to_owned();
    let mut meta =
        json!({"ui":{"prefersBorder":false,"csp":{"connectDomains":[],"resourceDomains":[]}}});
    if cfg!(debug_assertions) {
        if let Some(path) = std::env::var("CHATGPT_USAGE_DEV_HTML")
            .ok()
            .filter(|path| !path.is_empty())
        {
            // The explicit dev manifest owns this path. Release builds never read it.
            if let Ok(current) = std::fs::read_to_string(&path) {
                html = current;
            }
            let revision = hash(&html);
            meta["usage/devRevision"] = json!(revision);
            meta["ui"]["csp"]["frameDomains"] = json!(["blob:"]);
            let config = json!({"uri":uri(),"revision":revision})
                .to_string()
                .replace('<', "\\u003c");
            let loader = include_str!("../../ui/plugin-dev.js");
            html = html.replace(
                "</body>",
                &format!("<script>window.__USAGE_DEV__={config};{loader}</script></body>"),
            );
        }
    }
    Ok(
        json!({"contents":[{"uri":uri(),"mimeType":"text/html;profile=mcp-app","text":html,"_meta":meta}]}),
    )
}
pub async fn stdio() -> Result<()> {
    init_crypto();
    let mut reader = BufReader::new(tokio::io::stdin());
    let stdout = Arc::new(Mutex::new(tokio::io::stdout()));
    let mut jobs = tokio::task::JoinSet::new();
    let mut waits = std::collections::HashMap::<String, tokio::task::AbortHandle>::new();
    loop {
        let bytes = crate::line(&mut reader, 1024 * 1024).await?;
        if bytes.is_empty() {
            break;
        }
        while let Some(Ok(key)) = jobs.try_join_next() {
            waits.remove(&key);
        }
        let request: Value = serde_json::from_slice(&bytes).map_err(|_| "invalid JSON-RPC")?;
        if request["method"] == "notifications/cancelled" {
            if let Some(wait) = waits.remove(&request["params"]["requestId"].to_string()) {
                wait.abort();
            }
            continue;
        }
        if request["id"].is_null() {
            continue;
        }
        let key = request["id"].to_string();
        // Keep reading cancellation/EOF when the bounded request pool is full.
        if jobs.len() >= 8 || waits.contains_key(&key) {
            let mut out = stdout.lock().await;
            out.write_all(format!("{}\n", json!({"jsonrpc":"2.0","id":request["id"],"error":{"code":-32000,"message":"Too many requests or duplicate wait id"}})).as_bytes()).await.map_err(|e| e.to_string())?;
            out.flush().await.map_err(|e| e.to_string())?;
            continue;
        }
        let (out, completed) = (stdout.clone(), key.clone());
        let task = jobs.spawn(async move {
            let result = dispatch(request).await;
            if !result.is_null() {
                let mut o = out.lock().await;
                let _ = o.write_all(format!("{result}\n").as_bytes()).await;
                let _ = o.flush().await;
            }
            completed
        });
        waits.insert(key, task);
    }
    jobs.abort_all();
    while jobs.join_next().await.is_some() {}
    crate::usage::stop();
    Ok(())
}

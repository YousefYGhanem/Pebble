using System.Text;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// `pebble-native mcp`: an MCP server (stdio, JSON-RPC 2.0) so any agent that speaks MCP can reach you through Pebble,
// also agents Pebble has no hooks for. Add it once, e.g.  claude mcp add pebble -- "<path>\pebble-native.exe" mcp
//   notify    a message in the island + a Windows notification
//   ask_user  a question in the island; waits for your answer (up to 10 minutes) and returns it
static class Mcp
{
    static readonly JsonObject Tools = new()
    {
        ["tools"] = new JsonArray(
            (JsonNode)new JsonObject
            {
                ["name"] = "notify",
                ["description"] = "Show the user a short message in the Pebble island on their screen (and a Windows notification). Use it when a long task finished or something needs their attention.",
                ["inputSchema"] = new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["text"] = new JsonObject { ["type"] = "string", ["description"] = "The message, one short sentence" },
                        ["title"] = new JsonObject { ["type"] = "string", ["description"] = "Who it is from, e.g. the project name" },
                        ["kind"] = new JsonObject { ["type"] = "string", ["enum"] = new JsonArray("done", "error", "running") }
                    },
                    ["required"] = new JsonArray("text")
                }
            },
            (JsonNode)new JsonObject
            {
                ["name"] = "ask_user",
                ["description"] = "Ask the user a question in the Pebble island and wait for the answer (up to 10 minutes). Offer options when the answer is a choice.",
                ["inputSchema"] = new JsonObject
                {
                    ["type"] = "object",
                    ["properties"] = new JsonObject
                    {
                        ["question"] = new JsonObject { ["type"] = "string" },
                        ["options"] = new JsonObject { ["type"] = "array", ["items"] = new JsonObject { ["type"] = "string" }, ["description"] = "Up to 6 answers to pick from (the user may also type their own)" },
                        ["title"] = new JsonObject { ["type"] = "string" }
                    },
                    ["required"] = new JsonArray("question")
                }
            })
    };

    public static async Task<int> Run()
    {
        using var input = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        using var output = Console.OpenStandardOutput();
        var gate = new SemaphoreSlim(1);
        async Task Send(JsonObject msg)
        {
            var bytes = Encoding.UTF8.GetBytes(msg.ToJsonString() + "\n");
            await gate.WaitAsync();
            try { await output.WriteAsync(bytes); await output.FlushAsync(); } finally { gate.Release(); }
        }
        var pending = new List<Task>();
        string? line;
        while ((line = await input.ReadLineAsync()) != null)
        {
            if (line.Length == 0) continue;
            JsonObject? req;
            try { req = JsonNode.Parse(line)?.AsObject(); } catch { await Send(Error(null, -32700, "parse error")); continue; }
            if (req == null) continue;
            var id = req["id"]?.DeepClone();
            if (id == null) continue; // a notification (e.g. notifications/initialized): no answer
            pending.Add(Task.Run(async () => await Send(await Handle(req, id)))); // ask_user waits; other calls go on meanwhile
        }
        await Task.WhenAll(pending); // the client closed stdin: finish what it asked for first
        return 0;
    }

    static async Task<JsonObject> Handle(JsonObject req, JsonNode id)
    {
        var method = req["method"]?.GetValue<string>();
        var p = req["params"] as JsonObject ?? [];
        switch (method)
        {
            case "initialize":
                return Result(id, new JsonObject
                {
                    ["protocolVersion"] = p["protocolVersion"]?.GetValue<string>() ?? "2025-06-18",
                    ["capabilities"] = new JsonObject { ["tools"] = new JsonObject() },
                    ["serverInfo"] = new JsonObject { ["name"] = "pebble", ["version"] = Program.Version }
                });
            case "ping": return Result(id, []);
            case "tools/list": return Result(id, (JsonObject)Tools.DeepClone());
            case "tools/call":
                var args = p["arguments"] as JsonObject ?? [];
                try { return Result(id, Text(await Call(p["name"]?.GetValue<string>() ?? "", args))); }
                catch (Exception e) { return Result(id, Text(e.Message, isError: true)); }
            default: return Error(id, -32601, "method not found: " + method);
        }
    }

    static async Task<string> Call(string tool, JsonObject a)
    {
        if (Hooks.Pebble() is not { } cfg) throw new Exception("Pebble is not set up on this PC.");
        var (port, token) = cfg;
        string S(string k) => a[k]?.GetValue<string>() ?? "";
        try
        {
            switch (tool)
            {
                case "notify":
                    if (S("text").Length == 0) throw new Exception("text is required");
                    await Hooks.Notify(port, token, S("text"), S("kind") is { Length: > 0 } k ? k : "done", S("title") is { Length: > 0 } t ? t : "Agent");
                    return "Shown to the user.";
                case "ask_user":
                    if (S("question").Length == 0) throw new Exception("question is required");
                    var options = (a["options"] as JsonArray)?.Select(o => o?.GetValue<string>() ?? "").Where(o => o.Length > 0) ?? [];
                    var answer = await Hooks.Ask(port, token, S("question"), options, S("title") is { Length: > 0 } ti ? ti : "Agent");
                    return answer ?? "The user did not answer (they may be away). Continue with your best judgement or ask again later.";
                default: throw new Exception("unknown tool " + tool);
            }
        }
        catch (HttpRequestException e) when (e.StatusCode == null) { throw new Exception("Pebble is not running, so the user cannot see this."); }
    }

    static JsonObject Text(string text, bool isError = false) =>
        new() { ["content"] = new JsonArray((JsonNode)new JsonObject { ["type"] = "text", ["text"] = text }), ["isError"] = isError };
    static JsonObject Result(JsonNode id, JsonObject result) => new() { ["jsonrpc"] = "2.0", ["id"] = id.DeepClone(), ["result"] = result };
    static JsonObject Error(JsonNode? id, int code, string message) =>
        new() { ["jsonrpc"] = "2.0", ["id"] = id?.DeepClone(), ["error"] = new JsonObject { ["code"] = code, ["message"] = message } };
}

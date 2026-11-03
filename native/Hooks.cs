using System.Text;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// Run by Claude Code as hooks (JSON on stdin), and the `pebble` command for scripts. Both talk to Pebble's local
// server with its token. They never block an agent when Pebble is not running: every failure is a quiet exit 0.
static class Hooks
{
    static HttpClient Client(string token, TimeSpan timeout)
    {
        var http = new HttpClient { Timeout = timeout };
        http.DefaultRequestHeaders.Add("X-Pebble-Token", token);
        return http;
    }

    static async Task<string> Stdin()
    {
        using var r = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        return await r.ReadToEndAsync();
    }

    static void Stderr(string text)
    {
        var bytes = Encoding.UTF8.GetBytes(text + "\n");
        using var e = Console.OpenStandardError();
        e.Write(bytes);
    }

    /// <summary>
    /// `hook window --port P --token T` (SessionStart, UserPromptSubmit; async): tells Pebble which window runs this
    /// session (the terminal or editor among this hook's parents), for "jump to terminal".
    /// `hook reply --port P --token T` (Stop; asyncRewake): waits until you reply in the island; your text goes to
    /// stderr with exit 2, which wakes Claude with it. Exit 0: nothing to send.
    /// `hook relay --agent A --port P --token T [--reply continue]` (Gemini CLI, Cursor): passes the hook's JSON to Pebble
    /// with the agent's process id, then always prints what the agent expects back (`{}`, or `{"continue":true}`), also
    /// when Pebble is not running: an agent must never be blocked by Pebble.
    /// </summary>
    public static async Task<int> Run(string kind, Dictionary<string, string> o)
    {
        var input = "";
        try { input = await Stdin(); } catch { }
        if (kind == "relay")
        {
            await Relay(input, o);
            using var stdout = Console.OpenStandardOutput();
            stdout.Write(Encoding.UTF8.GetBytes(o.GetValueOrDefault("reply") == "continue" ? "{\"continue\":true}\n" : "{}\n"));
            return 0;
        }
        try
        {
            var sid = JsonNode.Parse(input)?["session_id"]?.GetValue<string>();
            if (string.IsNullOrEmpty(sid) || !o.TryGetValue("port", out var port) || !o.TryGetValue("token", out var token)) return 0;
            var url = $"http://127.0.0.1:{port}";
            if (kind == "window")
            {
                var (pid, hwnd) = Windows.WindowOfTree((uint)Environment.ProcessId, tryConsole: true);
                if (pid == 0) return 0;
                using var http = Client(token, TimeSpan.FromSeconds(3));
                var chain = new JsonArray();
                foreach (var a in Windows.Ancestors(Windows.ParentOf((uint)Environment.ProcessId))) chain.Add((JsonNode)JsonValue.Create(a));
                var body = new JsonObject { ["session_id"] = sid, ["pid"] = pid, ["hwnd"] = (long)hwnd, ["process"] = Windows.NameOf(pid), ["chain"] = chain }.ToJsonString();
                await http.PostAsync(url + "/window", new StringContent(body, Encoding.UTF8, "application/json"));
                return 0;
            }
            if (kind == "reply")
            {
                using var http = Client(token, TimeSpan.FromSeconds(1800));
                var answer = JsonNode.Parse(await http.GetStringAsync(url + "/wait?session=" + Uri.EscapeDataString(sid)))?["reply"]?.GetValue<string>();
                if (string.IsNullOrWhiteSpace(answer)) return 0;
                Stderr(answer);
                return 2;
            }
        }
        catch { /* Pebble closed, timed out, or answered elsewhere */ }
        return 0;
    }

    static async Task Relay(string input, Dictionary<string, string> o)
    {
        try
        {
            if (!o.TryGetValue("port", out var port) || !o.TryGetValue("token", out var token) || !o.TryGetValue("agent", out var agent)) return;
            var body = JsonNode.Parse(input)?.AsObject();
            if (body == null) return;
            body["_pid"] = Windows.ParentOf((uint)Environment.ProcessId); // the agent (or the shell it started us from)
            using var http = Client(token, TimeSpan.FromSeconds(3));
            await http.PostAsync($"http://127.0.0.1:{port}/hook?agent={Uri.EscapeDataString(agent)}", new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"));
        }
        catch { /* Pebble not running: the agent goes on as if nothing happened */ }
    }

    /// <summary>
    /// `pebble notify "Build done" [--kind done|error|running] [--title CI]`
    /// `pebble ask "Ship it?" [--options Yes,No] [--title Deploy]`  → prints your answer (exit 1 when unanswered)
    /// Exit 2 when Pebble is not running.
    /// </summary>
    public static async Task<int> Cli(string[] args)
    {
        if (args.Length < 2 || (args[0] != "notify" && args[0] != "ask"))
        {
            Console.WriteLine("usage: pebble notify \"text\" [--kind done|error|running] [--title T]\n       pebble ask \"question\" [--options A,B] [--title T]");
            return 64;
        }
        var opts = Options(args.Skip(2).ToArray());
        if (Pebble() is not { } cfg) { Stderr("Pebble is not set up on this PC (start it once)."); return 2; }
        var (port, token) = cfg;
        try
        {
            if (args[0] == "notify") { await Notify(port, token, args[1], opts.GetValueOrDefault("kind", "done"), opts.GetValueOrDefault("title", "")); return 0; }
            var options = opts.GetValueOrDefault("options", "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            var answer = await Ask(port, token, args[1], options, opts.GetValueOrDefault("title", ""));
            if (string.IsNullOrEmpty(answer)) return 1;
            using var o = Console.OpenStandardOutput();
            o.Write(Encoding.UTF8.GetBytes(answer + "\n"));
            return 0;
        }
        catch (HttpRequestException e) when (e.StatusCode == null) { Stderr("Pebble is not running."); return 2; }
    }

    /// <summary>Pebble's port and token from %APPDATA%Pebble (%APPDATA% first, as Electron and scripts see it), or null.</summary>
    public static (int port, string token)? Pebble()
    {
        var appData = Environment.GetEnvironmentVariable("APPDATA") is { Length: > 0 } a ? a : Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "Pebble");
        string token;
        try { token = File.ReadAllText(Path.Combine(dir, "hook-token")).Trim(); } catch { return null; }
        var port = 47901;
        try { port = JsonNode.Parse(File.ReadAllText(Path.Combine(dir, "settings.json")))?["server"]?["port"]?.GetValue<int>() ?? port; } catch { }
        return (port, token);
    }

    public static async Task Notify(int port, string token, string text, string kind, string title)
    {
        using var http = Client(token, TimeSpan.FromSeconds(5));
        var body = new JsonObject { ["text"] = text, ["kind"] = kind, ["title"] = title };
        (await http.PostAsync($"http://127.0.0.1:{port}/notify", new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json"))).EnsureSuccessStatusCode();
    }

    /// <summary>Asks in the island and waits up to 10 minutes; null when nobody answered.</summary>
    public static async Task<string?> Ask(int port, string token, string question, IEnumerable<string> options, string title)
    {
        using var wait = Client(token, TimeSpan.FromSeconds(600));
        var list = new JsonArray();
        foreach (var x in options) list.Add((JsonNode)JsonValue.Create(x));
        var ask = new JsonObject { ["question"] = question, ["options"] = list, ["title"] = title };
        var res = await wait.PostAsync($"http://127.0.0.1:{port}/ask", new StringContent(ask.ToJsonString(), Encoding.UTF8, "application/json"));
        var answer = JsonNode.Parse(await res.Content.ReadAsStringAsync())?["answer"]?.GetValue<string>();
        return string.IsNullOrEmpty(answer) ? null : answer;
    }

    /// <summary>"--port 1 -Title x" → {port: 1, title: x} (keys lower-case; -X and --x both work).</summary>
    public static Dictionary<string, string> Options(string[] args)
    {
        var o = new Dictionary<string, string>();
        for (int i = 0; i < args.Length; i++)
            if (args[i].StartsWith('-') && i + 1 < args.Length) o[args[i].TrimStart('-').ToLowerInvariant()] = args[++i];
        return o;
    }
}

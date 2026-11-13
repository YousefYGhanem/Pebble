using System.Text;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// `pebble-native serve --owner <pid>`: Pebble's helper. One JSON object per line on stdin and stdout.
//   request   {"id": 1, "cmd": "window.focus", "args": {...}}
//   response  {"id": 1, "ok": true, "result": ...}   or   {"id": 1, "ok": false, "error": "..."}
//   event     {"event": "foreground", "data": ...}    for topics switched on with {"cmd": "watch", "args": {"topic", "on"}}
// It ends when stdin closes (Pebble quit or crashed), so it never outlives Pebble.
static class Server
{
    static readonly Lock outLock = new();
    static Stream stdout = Stream.Null;
    static uint owner;
    static readonly Dictionary<string, CancellationTokenSource> watches = [];

    public static void Emit(JsonObject o)
    {
        var bytes = Encoding.UTF8.GetBytes(o.ToJsonString() + "\n");
        lock (outLock) { stdout.Write(bytes); stdout.Flush(); }
    }

    static void Event(string name, JsonNode? data) => Emit(new JsonObject { ["event"] = name, ["data"] = data });

    public static async Task<int> Run(uint ownerPid)
    {
        owner = ownerPid;
        stdout = Console.OpenStandardOutput();
        using var reader = new StreamReader(Console.OpenStandardInput(), Encoding.UTF8);
        Event("ready", new JsonObject { ["version"] = Program.Version, ["pid"] = Environment.ProcessId });
        string? line;
        while ((line = await reader.ReadLineAsync()) != null)
        {
            // each request keeps its own line: the task may start after the loop has already read the next one
            var request = line;
            if (request.Length > 0) _ = Task.Run(() => Handle(request));
        }
        return 0;
    }

    static async Task Handle(string line)
    {
        JsonNode? id = null;
        try
        {
            var req = JsonNode.Parse(line)!.AsObject();
            id = req["id"]?.DeepClone();
            var args = req["args"] as JsonObject ?? [];
            var result = await Dispatch((string)req["cmd"]!, args);
            Emit(new JsonObject { ["id"] = id, ["ok"] = true, ["result"] = result });
        }
        catch (Exception e) { Emit(new JsonObject { ["id"] = id, ["ok"] = false, ["error"] = e.Message }); }
    }

    static int Int(JsonObject a, string k) => a[k]?.GetValue<int>() ?? throw new ArgumentException($"{k} is required");
    static long Long(JsonObject a, string k, long fallback = 0) => a[k] is JsonValue v ? v.GetValue<long>() : fallback;
    static string Str(JsonObject a, string k) => a[k]?.GetValue<string>() ?? throw new ArgumentException($"{k} is required");

    static async Task<JsonNode?> Dispatch(string cmd, JsonObject a) => cmd switch
    {
        "ping" => "pong",
        "window.foreground" => Windows.Foreground(owner),
        "window.fromPoint" => Windows.FromPoint(Int(a, "x"), Int(a, "y"), owner),
        "window.focus" => Windows.Focus((nint)Long(a, "hwnd"), (uint)Long(a, "pid")),
        "window.ofProcess" => OfProcess((uint)Long(a, "pid")),
        "window.minimize" => Windows.Minimize((nint)Long(a, "hwnd")),
        "windows.list" => Windows.List(),
        "screen.capture" => CaptureTo(a),
        "media.get" => await Media.Get(),
        "media.art" => await Media.Art(),
        "media.control" => await Media.Control(Str(a, "action"), Long(a, "positionMs")),
        "audio.get" => AudioState(),
        "audio.set" => AudioSet(a),
        "power.get" => Win32.PowerMode(),
        "power.set" => Win32.SetPowerMode(Str(a, "mode")),
        "mic.mute" => Audio.MicSetMute(a["on"]?.GetValue<bool>() ?? !(Audio.MicMuted() ?? false)),
        "radios.get" => await Radios.Get(),
        "radios.set" => await Radios.Set(Str(a, "kind"), a["on"]?.GetValue<bool>() ?? false),
        "speech.voices" => Speech.Voices(),
        "speech.say" => await Say(a),
        "input.dictate" => Dictate(),
        "ocr.file" => await Ocr.File(Str(a, "file")),
        "window.capture" => CaptureWindow((nint)Long(a, "hwnd"), Str(a, "file")),
        "uia.read" => Uia.Read((nint)Long(a, "hwnd")),
        "uia.send" => Uia.Send((nint)Long(a, "hwnd"), (uint)Long(a, "pid"), Str(a, "text")),
        "watch" => Watch(Str(a, "topic"), a["on"]?.GetValue<bool>() ?? true),
        _ => throw new ArgumentException("unknown command " + cmd)
    };

    static JsonObject OfProcess(uint pid)
    {
        var (p, h) = Windows.WindowOfTree(pid, false);
        var chain = new JsonArray();
        foreach (var a in Windows.Ancestors(pid)) chain.Add((JsonNode)JsonValue.Create(a));
        return new JsonObject { ["pid"] = p, ["hwnd"] = (long)h, ["process"] = p == 0 ? "" : Windows.NameOf(p), ["chain"] = chain };
    }
    static string CaptureTo(JsonObject a) { var f = Str(a, "file"); Capture.Region(Int(a, "x"), Int(a, "y"), Int(a, "w"), Int(a, "h"), f); return f; }
    /// <summary>A window as a PNG (what is on screen there: the window must be visible).</summary>
    static JsonObject CaptureWindow(nint hwnd, string file)
    {
        if (!Win32.IsWindow(hwnd)) throw new ArgumentException("that window is gone");
        var r = Windows.Rect(hwnd);
        Capture.Region((int)r["x"]!, (int)r["y"]!, (int)r["w"]!, (int)r["h"]!, file);
        return r;
    }
    // the 'audio' watch also carries what the island peeks at: the speakers' name, the mic's mute, Caps Lock and the
    // keyboard language, and Windows' clipboard counter (one poll, an event only when something changed)
    static JsonObject AudioState()
    {
        var (v, m, d) = Audio.Get();
        return new JsonObject { ["volume"] = v, ["muted"] = m, ["device"] = d, ["mic"] = Audio.MicMuted(), ["caps"] = Win32.CapsLock(), ["keyboard"] = Win32.KeyboardLanguage(), ["clip"] = Win32.GetClipboardSequenceNumber() };
    }
    static JsonObject AudioSet(JsonObject a)
    {
        if (a["volume"] is JsonValue v) Audio.SetVolume(v.GetValue<int>());
        if (a["muted"] is JsonValue m) Audio.SetMute(m.GetValue<bool>());
        return AudioState();
    }
    static async Task<string> Say(JsonObject a) { var f = Str(a, "file"); await Speech.Say(Str(a, "text"), a["language"]?.GetValue<string>(), f); return f; }
    static bool Dictate() { Windows.Dictate(); return true; }

    // ---------- watches: events while a topic is on ----------

    static bool Watch(string topic, bool on)
    {
        lock (watches)
        {
            if (watches.Remove(topic, out var old)) old.Cancel();
            if (!on) return false;
            var cts = new CancellationTokenSource();
            watches[topic] = cts;
            _ = topic switch
            {
                "foreground" => Poll(cts.Token, 400, () => Windows.Foreground(owner), d => Event("foreground", d)),
                "audio" => Poll(cts.Token, 300, AudioState, d => Event("audio", d)),
                "peaks" => Peaks(cts.Token),
                // while the left button is down: where the mouse is (dragging a file onto the island); one last event on release
                "drag" => Poll(cts.Token, 40, () => { var c = Windows.Cursor(); return c["down"]!.GetValue<bool>() ? c : null; }, d => Event("drag", d), idleMs: 150),
                "media" => WatchMedia(cts.Token),
                _ => throw new ArgumentException("unknown topic " + topic)
            };
            return true;
        }
    }

    /// <summary>Asks every interval (idleMs while the answer is null: nothing going on); emits only when the answer changed.</summary>
    static Task Poll(CancellationToken stop, int ms, Func<JsonNode?> read, Action<JsonNode?> emit, int? idleMs = null) => Task.Run(async () =>
    {
        string? last = "";
        while (!stop.IsCancellationRequested)
        {
            try
            {
                var now = read();
                var text = now?.ToJsonString();
                if (text != last) { last = text; emit(now); }
            }
            catch { /* the device went away for a moment: try again next time */ }
            await Task.Delay(last == null && idleMs is int idle ? idle : ms, stop).ContinueWith(_ => { });
        }
    });

    /// <summary>The sound level about 30 times a second, while the island shows a sound wave.</summary>
    static Task Peaks(CancellationToken stop) => Task.Run(async () =>
    {
        var silent = false;
        while (!stop.IsCancellationRequested)
        {
            try
            {
                var p = Math.Round(Audio.Peak(), 3);
                if (p > 0 || !silent) Event("peak", p); // one 0 when it goes quiet, then nothing until sound returns
                silent = p == 0;
            }
            catch { }
            await Task.Delay(33, stop).ContinueWith(_ => { });
        }
    });

    static async Task WatchMedia(CancellationToken stop)
    {
        var pending = 0;
        async void Changed()
        {
            // a song change fires several events at once: settle for 150 ms, then send one update
            if (Interlocked.Exchange(ref pending, 1) == 1) return;
            await Task.Delay(150);
            Interlocked.Exchange(ref pending, 0);
            if (!stop.IsCancellationRequested) try { Event("media", await Media.Get()); } catch { }
        }
        await Media.Watch(Changed);
        Changed();
    }
}

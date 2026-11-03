using System.Text;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// `pebble-native selftest`: tries every capability without changing anything on this PC (no volume, radio or window
// changes) and prints a JSON report. Exit 0 when all checks pass. Settings → Diagnostics shows the same report.
static class Selftest
{
    public static async Task<int> Run()
    {
        var checks = new JsonArray();
        var allOk = true;
        async Task Check(string name, Func<Task<string>> run)
        {
            string detail; bool ok;
            try { detail = await run(); ok = true; } catch (Exception e) { detail = e.GetType().Name + ": " + e.Message; ok = false; }
            allOk &= ok;
            checks.Add((JsonNode)new JsonObject { ["name"] = name, ["ok"] = ok, ["detail"] = detail });
        }
        var tmp = Path.Combine(Path.GetTempPath(), "pebble-selftest-" + Environment.ProcessId);

        await Check("process tree", () => Task.FromResult(Win32.ParentMap().ContainsKey((uint)Environment.ProcessId) ? "ok" : throw new Exception("own process missing")));
        await Check("windows", () => Task.FromResult($"{Win32.TopWindows().Count(Win32.IsAppWindow)} app windows"));
        await Check("foreground", () => Task.FromResult(Windows.Foreground(0)?["class"]?.GetValue<string>() ?? "desktop"));
        await Check("window under a point", () => Task.FromResult(Windows.FromPoint(100, 100, 0)?["process"]?.GetValue<string>() ?? "none"));
        await Check("screen capture", () =>
        {
            var f = tmp + ".png";
            Capture.Region(0, 0, 32, 32, f);
            var head = File.ReadAllBytes(f).Take(4).ToArray();
            File.Delete(f);
            return Task.FromResult(head.SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47 }) ? "png ok" : throw new Exception("not a PNG"));
        });
        await Check("volume", () => { var (v, m) = Audio.Get(); return Task.FromResult($"{v}%{(m ? " muted" : "")}"); });
        await Check("sound level", () => Task.FromResult($"peak {Audio.Peak():0.00}"));
        await Check("media", async () => (await Media.Get())?["app"]?.GetValue<string>() ?? "nothing playing");
        await Check("radios", async () => string.Join(", ", (await Radios.Get()).Select(r => $"{r!["kind"]} {((bool)r["on"]! ? "on" : "off")}")) is { Length: > 0 } s ? s : "none");
        await Check("voices", () => Task.FromResult($"{Speech.Voices().Count} voices"));
        await Check("speech", async () =>
        {
            var f = tmp + ".wav";
            await Speech.Say("test", null, f);
            var riff = Encoding.ASCII.GetString(File.ReadAllBytes(f), 0, 4);
            File.Delete(f);
            return riff == "RIFF" ? "wav ok" : throw new Exception("not a WAV");
        });

        await Check("text recognition (OCR)", async () =>
        {
            var f = tmp + "-ocr.png";
            Capture.Region(0, 0, 64, 64, f);
            try { await Ocr.File(f); return global::Windows.Media.Ocr.OcrEngine.AvailableRecognizerLanguages.Count + " languages"; } finally { File.Delete(f); }
        });
        await Check("UI Automation", () => Task.FromResult(Win32.TopWindows().FirstOrDefault(Win32.IsAppWindow) is var h && h != 0 ? $"{Uia.Read(h).Count} items in the front window" : "no window"));

        var report = new JsonObject { ["version"] = Program.Version, ["ok"] = allOk, ["checks"] = checks };
        using var o = Console.OpenStandardOutput();
        o.Write(Encoding.UTF8.GetBytes(report.ToJsonString() + "\n"));
        return allOk ? 0 : 1;
    }
}

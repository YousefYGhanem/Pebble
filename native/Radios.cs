using System.Text.Json.Nodes;
using Windows.Devices.Radios;
using Windows.Media.SpeechSynthesis;
using Windows.Storage.Streams;

namespace Pebble.Native;

// Wi-Fi and Bluetooth on/off (the same switches as Windows' quick settings).
static class Radios
{
    static string Kind(RadioKind k) => k switch { RadioKind.WiFi => "wifi", RadioKind.Bluetooth => "bluetooth", _ => k.ToString().ToLowerInvariant() };

    public static async Task<JsonArray> Get()
    {
        await Radio.RequestAccessAsync();
        var list = new JsonArray();
        foreach (var r in await Radio.GetRadiosAsync())
            if (r.Kind is RadioKind.WiFi or RadioKind.Bluetooth)
                list.Add((JsonNode)new JsonObject { ["kind"] = Kind(r.Kind), ["name"] = r.Name, ["on"] = r.State == RadioState.On });
        return list;
    }

    /// <summary>Switches a radio; returns false when Windows does not allow it (then open Windows' own settings).</summary>
    public static async Task<bool> Set(string kind, bool on)
    {
        if (await Radio.RequestAccessAsync() != RadioAccessStatus.Allowed) return false;
        foreach (var r in await Radio.GetRadiosAsync())
            if (Kind(r.Kind) == kind) return await r.SetStateAsync(on ? RadioState.On : RadioState.Off) == RadioAccessStatus.Allowed;
        return false;
    }
}

// Speaking with a Windows voice: text → a WAV file the island plays.
static class Speech
{
    public static JsonArray Voices()
    {
        var list = new JsonArray();
        foreach (var v in SpeechSynthesizer.AllVoices) list.Add((JsonNode)new JsonObject { ["id"] = v.Id, ["name"] = v.DisplayName, ["language"] = v.Language });
        return list;
    }

    /// <summary>language: "en", "nl-NL"… picks the first voice of that language (else the default voice).</summary>
    public static async Task Say(string text, string? language, string file)
    {
        using var synth = new SpeechSynthesizer();
        if (!string.IsNullOrEmpty(language))
        {
            var voice = SpeechSynthesizer.AllVoices.FirstOrDefault(v => v.Language.StartsWith(language, StringComparison.OrdinalIgnoreCase));
            if (voice != null) synth.Voice = voice;
        }
        using var stream = await synth.SynthesizeTextToStreamAsync(text);
        using var reader = new DataReader(stream.GetInputStreamAt(0));
        await reader.LoadAsync((uint)stream.Size);
        var bytes = new byte[stream.Size];
        reader.ReadBytes(bytes);
        Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(file))!);
        await File.WriteAllBytesAsync(file, bytes);
    }
}

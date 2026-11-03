using System.Text.Json.Nodes;
using Windows.Media.Control;
using Windows.Storage.Streams;

namespace Pebble.Native;

// What plays on this PC, from Windows itself (the same as the media controls by the volume): Spotify, YouTube in a
// browser, any other player. No login needed.
static class Media
{
    static GlobalSystemMediaTransportControlsSessionManager? manager;
    static readonly HashSet<GlobalSystemMediaTransportControlsSession> watched = [];

    static async Task<GlobalSystemMediaTransportControlsSessionManager> Manager() =>
        manager ??= await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();

    /// <summary>Whatever really plays wins (Spotify first), else what Windows calls current, else any.</summary>
    static GlobalSystemMediaTransportControlsSession? Pick(GlobalSystemMediaTransportControlsSessionManager m)
    {
        var all = m.GetSessions();
        bool Playing(GlobalSystemMediaTransportControlsSession s) =>
            s.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
        return all.Where(Playing).OrderByDescending(s => s.SourceAppUserModelId.Contains("Spotify", StringComparison.OrdinalIgnoreCase)).FirstOrDefault()
            ?? m.GetCurrentSession() ?? all.FirstOrDefault();
    }

    public static async Task<JsonObject?> Get()
    {
        var s = Pick(await Manager());
        if (s == null) return null;
        var p = await s.TryGetMediaPropertiesAsync();
        var info = s.GetPlaybackInfo();
        var t = s.GetTimelineProperties();
        return new JsonObject
        {
            ["app"] = s.SourceAppUserModelId,
            ["title"] = p.Title, ["artist"] = p.Artist, ["album"] = p.AlbumTitle,
            ["playing"] = info.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing,
            ["positionMs"] = (long)t.Position.TotalMilliseconds, ["durationMs"] = (long)(t.EndTime - t.StartTime).TotalMilliseconds,
            ["updatedAt"] = t.LastUpdatedTime.ToUnixTimeMilliseconds(),
            ["canSeek"] = info.Controls.IsPlaybackPositionEnabled, ["canNext"] = info.Controls.IsNextEnabled, ["canPrevious"] = info.Controls.IsPreviousEnabled
        };
    }

    /// <summary>The album art as a data: URL, or null.</summary>
    public static async Task<string?> Art()
    {
        var s = Pick(await Manager());
        if (s == null) return null;
        var p = await s.TryGetMediaPropertiesAsync();
        if (p.Thumbnail == null) return null;
        using var stream = await p.Thumbnail.OpenReadAsync();
        if (stream.Size == 0 || stream.Size > 4_000_000) return null;
        using var reader = new DataReader(stream.GetInputStreamAt(0));
        await reader.LoadAsync((uint)stream.Size);
        var bytes = new byte[stream.Size];
        reader.ReadBytes(bytes);
        return $"data:{(string.IsNullOrEmpty(stream.ContentType) ? "image/png" : stream.ContentType)};base64,{Convert.ToBase64String(bytes)}";
    }

    public static async Task<bool> Control(string action, long positionMs)
    {
        var s = Pick(await Manager());
        if (s == null) return false;
        return action switch
        {
            "play" => await s.TryPlayAsync(),
            "pause" => await s.TryPauseAsync(),
            "toggle" => await s.TryTogglePlayPauseAsync(),
            "next" => await s.TrySkipNextAsync(),
            "previous" => await s.TrySkipPreviousAsync(),
            "seek" => await s.TryChangePlaybackPositionAsync(TimeSpan.FromMilliseconds(positionMs).Ticks),
            _ => throw new ArgumentException("unknown action " + action)
        };
    }

    /// <summary>Calls changed() whenever the song, the player or play/pause changes.</summary>
    public static async Task Watch(Action changed)
    {
        var m = await Manager();
        void Attach()
        {
            foreach (var s in m.GetSessions())
            {
                if (!watched.Add(s)) continue;
                s.MediaPropertiesChanged += (_, _) => changed();
                s.PlaybackInfoChanged += (_, _) => changed();
                s.TimelinePropertiesChanged += (_, _) => changed();
            }
        }
        m.SessionsChanged += (_, _) => { Attach(); changed(); };
        m.CurrentSessionChanged += (_, _) => changed();
        Attach();
    }
}

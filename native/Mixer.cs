using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// The volume mixer: each app that plays sound on the default speakers, with its own volume and mute (Windows' volume
// mixer). CoreAudio sessions through source-generated COM, as in Audio.cs.

[GeneratedComInterface, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F")]
partial interface IAudioSessionManager2
{
    [PreserveSig] int GetAudioSessionControl(nint guid, int flags, out nint control);
    [PreserveSig] int GetSimpleAudioVolume(nint guid, int flags, out nint volume);
    [PreserveSig] int GetSessionEnumerator(out IAudioSessionEnumerator sessions);
}

[GeneratedComInterface, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8")]
partial interface IAudioSessionEnumerator
{
    [PreserveSig] int GetCount(out int count);
    [PreserveSig] int GetSession(int index, out IAudioSessionControl2 session);
}

[GeneratedComInterface, Guid("bfb7ff88-7239-4fc9-8fa2-07c950be9c6d")]
partial interface IAudioSessionControl2
{
    [PreserveSig] int GetState(out int state);
    [PreserveSig] int GetDisplayName(out nint name);
    [PreserveSig] int SetDisplayName(nint name, in Guid context);
    [PreserveSig] int GetIconPath(out nint path);
    [PreserveSig] int SetIconPath(nint path, in Guid context);
    [PreserveSig] int GetGroupingParam(out Guid param);
    [PreserveSig] int SetGroupingParam(in Guid param, in Guid context);
    [PreserveSig] int RegisterAudioSessionNotification(nint notify);
    [PreserveSig] int UnregisterAudioSessionNotification(nint notify);
    [PreserveSig] int GetSessionIdentifier(out nint id);
    [PreserveSig] int GetSessionInstanceIdentifier(out nint id);
    [PreserveSig] int GetProcessId(out uint pid);
    [PreserveSig] int IsSystemSoundsSession();
}

[GeneratedComInterface, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8")]
partial interface ISimpleAudioVolume
{
    [PreserveSig] int SetMasterVolume(float level, in Guid context);
    [PreserveSig] int GetMasterVolume(out float level);
    [PreserveSig] int SetMute(int mute, in Guid context);
    [PreserveSig] int GetMute(out int mute);
}

static class Mixer
{
    static readonly Guid CLSID_MMDeviceEnumerator = new("BCDE0395-E52F-467C-8E3D-C4579291692E");
    static readonly StrategyBasedComWrappers Wrappers = new();

    static List<(uint pid, IAudioSessionControl2 control)> Sessions()
    {
        var list = new List<(uint, IAudioSessionControl2)>();
        if (Win32.CoCreateInstance(CLSID_MMDeviceEnumerator, 0, 23, typeof(IMMDeviceEnumerator).GUID, out var ptr) < 0) return list;
        IMMDeviceEnumerator en;
        try { en = (IMMDeviceEnumerator)Wrappers.GetOrCreateObjectForComInstance(ptr, CreateObjectFlags.None); } finally { Marshal.Release(ptr); }
        if (en.GetDefaultAudioEndpoint(0 /* eRender */, 1, out var device) < 0) return list;
        if (device.Activate(typeof(IAudioSessionManager2).GUID, 23, 0, out var mptr) < 0) return list;
        IAudioSessionManager2 manager;
        try { manager = (IAudioSessionManager2)Wrappers.GetOrCreateObjectForComInstance(mptr, CreateObjectFlags.None); } finally { Marshal.Release(mptr); }
        if (manager.GetSessionEnumerator(out var sessions) < 0 || sessions.GetCount(out var n) < 0) return list;
        for (var i = 0; i < n; i++)
        {
            if (sessions.GetSession(i, out var s) < 0) continue;
            // the system's own sounds and expired sessions (an app that closed) are not shown
            if (s.IsSystemSoundsSession() == 0 || s.GetState(out var state) < 0 || state == 2 /* expired */) continue;
            if (s.GetProcessId(out var pid) < 0 || pid == 0) continue;
            list.Add((pid, s));
        }
        return list;
    }

    static string NameOf(uint pid)
    {
        try
        {
            using var p = Process.GetProcessById((int)pid);
            var title = p.MainWindowTitle;
            var name = p.ProcessName;
            return name.Length > 0 ? char.ToUpper(name[0]) + name[1..] : title;
        }
        catch { return $"#{pid}"; }
    }

    /// <summary>The apps with sound now: [{ name, volume 0–100, muted }], one row per app (an app may run several processes).</summary>
    public static JsonArray List()
    {
        var rows = new JsonArray();
        var seen = new HashSet<string>();
        foreach (var (pid, s) in Sessions())
        {
            if (!seen.Add(NameOf(pid))) continue;
            var v = (ISimpleAudioVolume)s;
            if (v.GetMasterVolume(out var level) < 0 || v.GetMute(out var mute) < 0) continue;
            rows.Add(new JsonObject { ["name"] = NameOf(pid), ["volume"] = (int)Math.Round(level * 100), ["muted"] = mute != 0 });
        }
        return rows;
    }

    /// <summary>Sets an app's volume and/or mute (every session of every process of that app).</summary>
    public static JsonArray Set(string name, int? volume, bool? muted)
    {
        foreach (var (p, s) in Sessions())
        {
            if (NameOf(p) != name) continue;
            var v = (ISimpleAudioVolume)s;
            if (volume is int x) v.SetMasterVolume(Math.Clamp(x, 0, 100) / 100f, Guid.Empty);
            if (muted is bool m) v.SetMute(m ? 1 : 0, Guid.Empty);
        }
        return List();
    }
}

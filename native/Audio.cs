using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;

namespace Pebble.Native;

// The default speakers: master volume, mute, their name and the live peak level (for the island's sound wave);
// the default microphone's mute (one key mutes it for every app).
// CoreAudio through source-generated COM (works under NativeAOT). Only the vtable slots up to the ones used are declared.

[GeneratedComInterface, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6")]
partial interface IMMDeviceEnumerator
{
    [PreserveSig] int EnumAudioEndpoints(int dataFlow, int stateMask, out nint devices);
    [PreserveSig] int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
}

[GeneratedComInterface, Guid("D666063F-1587-4E43-81F1-B948E807363F")]
partial interface IMMDevice
{
    [PreserveSig] int Activate(in Guid iid, int clsCtx, nint activationParams, out nint iface);
    [PreserveSig] int OpenPropertyStore(int access, out IPropertyStore store);
}

[StructLayout(LayoutKind.Sequential)] struct PROPERTYKEY { public Guid fmtid; public uint pid; }
[StructLayout(LayoutKind.Sequential)] struct PROPVARIANT { public ushort vt; public ushort r1, r2, r3; public nint p; }

[GeneratedComInterface, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99")]
partial interface IPropertyStore
{
    [PreserveSig] int GetCount(out uint count);
    [PreserveSig] int GetAt(uint index, out PROPERTYKEY key);
    [PreserveSig] int GetValue(in PROPERTYKEY key, out PROPVARIANT value);
}

[GeneratedComInterface, Guid("5CDF2C82-841E-4546-9722-0CF74078229A")]
partial interface IAudioEndpointVolume
{
    [PreserveSig] int RegisterControlChangeNotify(nint notify);
    [PreserveSig] int UnregisterControlChangeNotify(nint notify);
    [PreserveSig] int GetChannelCount(out uint count);
    [PreserveSig] int SetMasterVolumeLevel(float db, nint context);
    [PreserveSig] int SetMasterVolumeLevelScalar(float level, nint context);
    [PreserveSig] int GetMasterVolumeLevel(out float db);
    [PreserveSig] int GetMasterVolumeLevelScalar(out float level);
    [PreserveSig] int SetChannelVolumeLevel(uint channel, float db, nint context);
    [PreserveSig] int SetChannelVolumeLevelScalar(uint channel, float level, nint context);
    [PreserveSig] int GetChannelVolumeLevel(uint channel, out float db);
    [PreserveSig] int GetChannelVolumeLevelScalar(uint channel, out float level);
    [PreserveSig] int SetMute(int mute, nint context);
    [PreserveSig] int GetMute(out int mute);
}

[GeneratedComInterface, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064")]
partial interface IAudioMeterInformation
{
    [PreserveSig] int GetPeakValue(out float peak);
}

static class Audio
{
    static readonly Guid CLSID_MMDeviceEnumerator = new("BCDE0395-E52F-467C-8E3D-C4579291692E");
    static readonly StrategyBasedComWrappers Wrappers = new();
    static IAudioEndpointVolume? volume;
    static IAudioMeterInformation? meter;
    static IAudioEndpointVolume? mic;
    static string device = "";
    static DateTime fetched;
    static readonly Lock gate = new();

    static T Activate<T>(IMMDevice device, Guid iid)
    {
        Check(device.Activate(iid, 23 /* CLSCTX_ALL */, 0, out var ptr));
        try { return (T)Wrappers.GetOrCreateObjectForComInstance(ptr, CreateObjectFlags.None); } finally { Marshal.Release(ptr); }
    }

    static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }

    /// <summary>The default output device's controls, looked up again every few seconds (you may switch to headphones).</summary>
    static (IAudioEndpointVolume vol, IAudioMeterInformation meter) Endpoint()
    {
        lock (gate)
        {
            if (volume != null && meter != null && DateTime.UtcNow - fetched < TimeSpan.FromSeconds(3)) return (volume, meter);
            Check(Win32.CoCreateInstance(CLSID_MMDeviceEnumerator, 0, 23, typeof(IMMDeviceEnumerator).GUID, out var ptr));
            IMMDeviceEnumerator en;
            try { en = (IMMDeviceEnumerator)Wrappers.GetOrCreateObjectForComInstance(ptr, CreateObjectFlags.None); } finally { Marshal.Release(ptr); }
            Check(en.GetDefaultAudioEndpoint(0 /* eRender */, 1 /* eMultimedia */, out var speakers));
            volume = Activate<IAudioEndpointVolume>(speakers, typeof(IAudioEndpointVolume).GUID);
            meter = Activate<IAudioMeterInformation>(speakers, typeof(IAudioMeterInformation).GUID);
            device = NameOf(speakers);
            // no microphone: no mic button (not an error)
            mic = en.GetDefaultAudioEndpoint(1 /* eCapture */, 0 /* eConsole */, out var m) >= 0 ? Activate<IAudioEndpointVolume>(m, typeof(IAudioEndpointVolume).GUID) : null;
            fetched = DateTime.UtcNow;
            return (volume, meter);
        }
    }

    // PKEY_Device_FriendlyName: "Headphones (AirPods Pro)"
    static readonly PROPERTYKEY FriendlyName = new() { fmtid = new("A45C254E-DF1C-4EFD-8020-67D146A850E0"), pid = 14 };
    static string NameOf(IMMDevice d)
    {
        try
        {
            if (d.OpenPropertyStore(0 /* STGM_READ */, out var store) < 0) return "";
            if (store.GetValue(FriendlyName, out var v) < 0) return "";
            try { return v.vt == 31 /* VT_LPWSTR */ ? Marshal.PtrToStringUni(v.p) ?? "" : ""; } finally { Win32.PropVariantClear(ref v); }
        }
        catch { return ""; }
    }

    /// <summary>(volume 0–100, muted, the speakers' name)</summary>
    public static (int volume, bool muted, string device) Get()
    {
        var (v, _) = Endpoint();
        Check(v.GetMasterVolumeLevelScalar(out var level));
        Check(v.GetMute(out var mute));
        return ((int)Math.Round(level * 100), mute != 0, device);
    }

    /// <summary>The microphone muted? null: there is none.</summary>
    public static bool? MicMuted()
    {
        Endpoint();
        if (mic == null || mic.GetMute(out var m) < 0) return null;
        return m != 0;
    }

    /// <summary>Mutes or unmutes the default microphone (for every app at once); its new state.</summary>
    public static bool? MicSetMute(bool on)
    {
        Endpoint();
        if (mic == null) return null;
        Check(mic.SetMute(on ? 1 : 0, 0));
        return on;
    }

    public static void SetVolume(int percent) => Check(Endpoint().vol.SetMasterVolumeLevelScalar(Math.Clamp(percent, 0, 100) / 100f, 0));
    public static void SetMute(bool on) => Check(Endpoint().vol.SetMute(on ? 1 : 0, 0));

    /// <summary>The loudest sample right now, 0–1 (0 when nothing plays).</summary>
    public static float Peak()
    {
        Check(Endpoint().meter.GetPeakValue(out var p));
        return p;
    }
}

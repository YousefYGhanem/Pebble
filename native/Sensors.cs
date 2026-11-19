using System.Runtime.InteropServices;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// The game strip's readings that Node cannot get, all without administrator rights:
//  - GPU usage: the "GPU Engine" performance counters, as Task Manager (3D engines, every process, at most 100%)
//  - GPU temperature: the graphics driver's performance data (D3DKMT, WDDM 2.4+), as Task Manager; dedicated GPUs
//    report it, integrated ones mostly do not
//  - CPU temperature: Windows has no standard reading; some PCs report an ACPI thermal zone, and only a believable
//    one (30-110 °C) is passed on (many report a fixed board value)
static partial class Sensors
{
    [LibraryImport("pdh.dll", EntryPoint = "PdhOpenQueryW", StringMarshalling = StringMarshalling.Utf16)] private static partial int PdhOpenQuery(string? source, nint user, out nint query);
    [LibraryImport("pdh.dll", EntryPoint = "PdhAddEnglishCounterW", StringMarshalling = StringMarshalling.Utf16)] private static partial int PdhAddEnglishCounter(nint query, string path, nint user, out nint counter);
    [LibraryImport("pdh.dll")] private static partial int PdhCollectQueryData(nint query);
    [LibraryImport("pdh.dll", EntryPoint = "PdhGetFormattedCounterArrayW")] private static partial int PdhGetFormattedCounterArray(nint counter, uint format, ref uint size, out uint count, nint buffer);

    [StructLayout(LayoutKind.Sequential)] struct D3DKMT_ADAPTERINFO { public uint hAdapter; public long luid; public uint sources; public int precise; }
    [StructLayout(LayoutKind.Sequential)] unsafe struct D3DKMT_ENUMADAPTERS2 { public uint count; public D3DKMT_ADAPTERINFO* adapters; }
    [StructLayout(LayoutKind.Sequential)] unsafe struct D3DKMT_QUERYADAPTERINFO { public uint hAdapter; public int type; public void* data; public uint size; }
    [StructLayout(LayoutKind.Sequential)] struct D3DKMT_CLOSEADAPTER { public uint hAdapter; }
    // D3DKMT_ADAPTER_PERFDATA: Temperature in tenths of a degree Celsius
    [StructLayout(LayoutKind.Sequential)] struct PERFDATA { public uint physical; public ulong memFreq, memFreqMax, memFreqOC, memBandwidth, pcieBandwidth; public uint fanRpm, power, temperature; public byte powerOverride; }
    [LibraryImport("gdi32.dll")] private static unsafe partial int D3DKMTEnumAdapters2(D3DKMT_ENUMADAPTERS2* e);
    [LibraryImport("gdi32.dll")] private static unsafe partial int D3DKMTQueryAdapterInfo(D3DKMT_QUERYADAPTERINFO* q);
    [LibraryImport("gdi32.dll")] private static unsafe partial int D3DKMTCloseAdapter(D3DKMT_CLOSEADAPTER* c);

    const uint PDH_FMT_DOUBLE = 0x200;
    static nint query, gpuCounter, thermalCounter;
    static readonly Lock gate = new();

    /// <summary>{ gpu: % or null, gpuTemp: °C or null, cpuTemp: °C or null }</summary>
    public static JsonObject Read()
    {
        lock (gate)
        {
            if (query == 0 && PdhOpenQuery(null, 0, out query) == 0)
            {
                PdhAddEnglishCounter(query, @"\GPU Engine(*engtype_3D)\Utilization Percentage", 0, out gpuCounter);
                PdhAddEnglishCounter(query, @"\Thermal Zone Information(*)\Temperature", 0, out thermalCounter);
                PdhCollectQueryData(query); // a rate needs two readings: the first one is the baseline
                Thread.Sleep(100);
            }
            PdhCollectQueryData(query);
            var gpu = Values(gpuCounter);
            var zones = Values(thermalCounter).Select(k => k - 273.15).Where(c => c is >= 30 and <= 110).ToList();
            return new JsonObject
            {
                ["gpu"] = gpu.Count > 0 ? Math.Round(Math.Min(100, gpu.Sum())) : null,
                ["gpuTemp"] = GpuTemperature(),
                ["cpuTemp"] = zones.Count > 0 ? Math.Round(zones.Max()) : null
            };
        }
    }

    static unsafe List<double> Values(nint counter)
    {
        var list = new List<double>();
        if (counter == 0) return list;
        uint size = 0;
        PdhGetFormattedCounterArray(counter, PDH_FMT_DOUBLE, ref size, out _, 0);
        if (size == 0) return list;
        var buffer = Marshal.AllocHGlobal((int)size);
        try
        {
            if (PdhGetFormattedCounterArray(counter, PDH_FMT_DOUBLE, ref size, out var count, buffer) != 0) return list;
            for (var i = 0; i < count; i++)
            {
                var item = buffer + i * 24; // PDH_FMT_COUNTERVALUE_ITEM_W: name pointer, then { status, pad, double }
                if (Marshal.ReadInt32(item + 8) == 0) list.Add(BitConverter.Int64BitsToDouble(Marshal.ReadInt64(item + 16)));
            }
        }
        finally { Marshal.FreeHGlobal(buffer); }
        return list;
    }

    /// <summary>The hottest graphics adapter that reports a temperature, or null.</summary>
    static unsafe double? GpuTemperature()
    {
        var e = new D3DKMT_ENUMADAPTERS2();
        if (D3DKMTEnumAdapters2(&e) != 0 || e.count == 0) return null;
        var adapters = new D3DKMT_ADAPTERINFO[e.count];
        double? hottest = null;
        fixed (D3DKMT_ADAPTERINFO* p = adapters)
        {
            e.adapters = p;
            if (D3DKMTEnumAdapters2(&e) != 0) return null;
            for (var i = 0; i < e.count; i++)
            {
                var perf = new PERFDATA();
                var q = new D3DKMT_QUERYADAPTERINFO { hAdapter = p[i].hAdapter, type = 62 /* KMTQAITYPE_ADAPTERPERFDATA */, data = &perf, size = (uint)sizeof(PERFDATA) };
                if (D3DKMTQueryAdapterInfo(&q) == 0 && perf.temperature is > 0 and < 1500) hottest = Math.Max(hottest ?? 0, Math.Round(perf.temperature / 10.0));
                var c = new D3DKMT_CLOSEADAPTER { hAdapter = p[i].hAdapter };
                D3DKMTCloseAdapter(&c);
            }
        }
        return hottest;
    }
}

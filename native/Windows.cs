using System.Text.Json.Nodes;
using static Pebble.Native.Win32;

namespace Pebble.Native;

// Windows on the screen: what is in front, what is under a point, which window belongs to a process tree, and
// bringing one to the front. All coordinates are real (physical) pixels: the sidecar is per-monitor DPI aware.
static class Windows
{
    public static JsonObject Rect(nint hwnd)
    {
        GetWindowRect(hwnd, out var r);
        return new JsonObject { ["x"] = r.Left, ["y"] = r.Top, ["w"] = r.Right - r.Left, ["h"] = r.Bottom - r.Top };
    }

    static string ProcessName(uint pid)
    {
        try { using var p = System.Diagnostics.Process.GetProcessById((int)pid); return p.ProcessName; } catch { return ""; }
    }

    public static JsonObject Describe(nint hwnd) => new()
    {
        ["hwnd"] = (long)hwnd, ["pid"] = Pid(hwnd), ["process"] = ProcessName(Pid(hwnd)),
        ["class"] = ClassName(hwnd), ["title"] = Title(hwnd), ["rect"] = Rect(hwnd)
    };

    static readonly HashSet<string> Shell = ["Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd"];

    /// <summary>The window in front, or null for the desktop/taskbar or a window of the owner (Pebble itself).</summary>
    public static JsonObject? Foreground(uint ownerPid)
    {
        var h = GetForegroundWindow();
        if (h == 0 || Shell.Contains(ClassName(h)) || Pid(h) == ownerPid) return null;
        return new JsonObject { ["hwnd"] = (long)h, ["pid"] = Pid(h), ["class"] = ClassName(h), ["rect"] = Rect(h), ["title"] = Title(h), ["process"] = ProcessName(Pid(h)) };
    }

    /// <summary>The top-level app window under a point, skipping the owner's own windows (Pebble's island and overlay).</summary>
    public static JsonObject? FromPoint(int x, int y, uint ownerPid)
    {
        foreach (var h in TopWindows())
        {
            if (!IsAppWindow(h) || Pid(h) == ownerPid) continue;
            GetWindowRect(h, out var r);
            if (x >= r.Left && x < r.Right && y >= r.Top && y < r.Bottom) return Describe(h);
        }
        return null;
    }

    /// <summary>
    /// The window that runs a process: the first ancestor (starting at pid itself) that owns an app window
    /// (Windows Terminal, VS Code, a console window…). Falls back to the console window of the caller.
    /// </summary>
    public static (uint pid, nint hwnd) WindowOfTree(uint pid, bool tryConsole)
    {
        var parents = ParentMap();
        var owners = new Dictionary<uint, nint>();
        foreach (var h in TopWindows()) if (IsAppWindow(h)) owners.TryAdd(Pid(h), h);
        var seen = new HashSet<uint>();
        for (var p = pid; p != 0 && seen.Add(p); p = parents.GetValueOrDefault(p))
            if (owners.TryGetValue(p, out var hwnd)) return (p, hwnd);
        if (tryConsole)
        {
            var c = GetConsoleWindow();
            if (c != 0 && IsWindowVisible(c)) return (Pid(c), c);
        }
        return (0, 0);
    }

    public static uint ParentOf(uint pid) => ParentMap().GetValueOrDefault(pid);

    /// <summary>pid and its parents, up to the top (for finding the terminal tab that runs an agent).</summary>
    public static List<uint> Ancestors(uint pid)
    {
        var parents = ParentMap();
        var chain = new List<uint>();
        for (var p = pid; p != 0 && !chain.Contains(p) && chain.Count < 32; p = parents.GetValueOrDefault(p)) chain.Add(p);
        return chain;
    }

    public static string NameOf(uint pid) => ProcessName(pid);

    /// <summary>Brings a window to the front (restoring it when minimised). Windows only lets the app in front hand
    /// over the foreground: a quick Alt tap lifts that lock, and minimise + restore is the last resort.</summary>
    public static bool Focus(nint hwnd, uint pid)
    {
        if (hwnd == 0 || !IsWindow(hwnd)) hwnd = WindowOfTree(pid, false).hwnd;
        if (hwnd == 0) return false;
        if (IsIconic(hwnd)) ShowWindow(hwnd, SW_RESTORE);
        if (SetForegroundWindow(hwnd) && GetForegroundWindow() == hwnd) return true;
        keybd_event(VK_MENU, 0, 0, 0);
        keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
        SetForegroundWindow(hwnd);
        BringWindowToTop(hwnd);
        if (GetForegroundWindow() == hwnd) return true;
        ShowWindow(hwnd, 6 /* SW_MINIMIZE */);
        ShowWindow(hwnd, SW_RESTORE);
        return GetForegroundWindow() == hwnd;
    }

    /// <summary>Every open app window: its title and program (top first).</summary>
    public static JsonArray List()
    {
        var list = new JsonArray();
        foreach (var h in TopWindows())
            if (IsAppWindow(h) && Title(h) is { Length: > 0 } t) list.Add((JsonNode)new JsonObject { ["title"] = t, ["process"] = ProcessName(Pid(h)), ["hwnd"] = (long)h, ["pid"] = Pid(h) });
        return list;
    }

    /// <summary>Minimises a window (the focus guard's "go back").</summary>
    public static bool Minimize(nint hwnd) => hwnd != 0 && IsWindow(hwnd) && ShowWindow(hwnd, 6 /* SW_MINIMIZE */);

    /// <summary>The mouse in real pixels, and whether the left button is down (a file being dragged).</summary>
    public static JsonObject Cursor()
    {
        GetCursorPos(out var p);
        return new JsonObject { ["x"] = p.X, ["y"] = p.Y, ["down"] = (GetAsyncKeyState(0x01) & 0x8000) != 0 };
    }

    /// <summary>Starts Windows' voice typing (Win+H) in whatever field has focus.</summary>
    public static void Dictate()
    {
        keybd_event(VK_LWIN, 0, 0, 0);
        keybd_event((byte)'H', 0, 0, 0);
        keybd_event((byte)'H', 0, KEYEVENTF_KEYUP, 0);
        keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0);
    }
}

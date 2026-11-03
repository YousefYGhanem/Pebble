using System.Runtime.InteropServices;
using System.Runtime.InteropServices.Marshalling;
using System.Text.Json.Nodes;

namespace Pebble.Native;

// UI Automation for desktop chat apps (Claude, ChatGPT; beta): read what a window shows, and type a reply into its
// message box. Source-generated COM; only the vtable slots up to the ones used are declared (order from
// UIAutomationClient.h), unused ones as placeholders.

[GeneratedComInterface, Guid("30cbe57d-d9d0-452a-ab13-7ac5ac4825ee")]
partial interface IUIAutomation
{
    [PreserveSig] int CompareElements(nint a, nint b, out int same);
    [PreserveSig] int CompareRuntimeIds(nint a, nint b, out int same);
    [PreserveSig] int GetRootElement(out nint root);
    [PreserveSig] int ElementFromHandle(nint hwnd, out IUIAutomationElement element);
    [PreserveSig] int ElementFromPoint(long pt, out nint element);
    [PreserveSig] int GetFocusedElement(out nint element);
    [PreserveSig] int GetRootElementBuildCache(nint cache, out nint root);
    [PreserveSig] int ElementFromHandleBuildCache(nint hwnd, nint cache, out nint element);
    [PreserveSig] int ElementFromPointBuildCache(long pt, nint cache, out nint element);
    [PreserveSig] int GetFocusedElementBuildCache(nint cache, out nint element);
    [PreserveSig] int CreateTreeWalker(nint condition, out nint walker);
    [PreserveSig] int ControlViewWalker(out nint walker);
    [PreserveSig] int ContentViewWalker(out nint walker);
    [PreserveSig] int RawViewWalker(out nint walker);
    [PreserveSig] int RawViewCondition(out nint condition);
    [PreserveSig] int ControlViewCondition(out nint condition);
    [PreserveSig] int ContentViewCondition(out nint condition);
    [PreserveSig] int CreateCacheRequest(out nint request);
    [PreserveSig] int CreateTrueCondition(out nint condition);
}

[GeneratedComInterface, Guid("d22108aa-8ac5-49a5-837b-37bbb3d7591e")]
partial interface IUIAutomationElement
{
    [PreserveSig] int SetFocus();
    [PreserveSig] int GetRuntimeId(out nint ids);
    [PreserveSig] int FindFirst(int scope, nint condition, out nint found);
    [PreserveSig] int FindAll(int scope, nint condition, out IUIAutomationElementArray found);
    [PreserveSig] int FindFirstBuildCache(int scope, nint condition, nint cache, out nint found);
    [PreserveSig] int FindAllBuildCache(int scope, nint condition, nint cache, out nint found);
    [PreserveSig] int BuildUpdatedCache(nint cache, out nint updated);
    [PreserveSig] int GetCurrentPropertyValue(int id, nint variant);
    [PreserveSig] int GetCurrentPropertyValueEx(int id, int ignoreDefault, nint variant);
    [PreserveSig] int GetCachedPropertyValue(int id, nint variant);
    [PreserveSig] int GetCachedPropertyValueEx(int id, int ignoreDefault, nint variant);
    [PreserveSig] int GetCurrentPatternAs(int pattern, in Guid iid, out nint obj);
    [PreserveSig] int GetCachedPatternAs(int pattern, in Guid iid, out nint obj);
    [PreserveSig] int GetCurrentPattern(int pattern, out nint obj);
    [PreserveSig] int GetCachedPattern(int pattern, out nint obj);
    [PreserveSig] int GetCachedParent(out nint parent);
    [PreserveSig] int GetCachedChildren(out nint children);
    [PreserveSig] int CurrentProcessId(out int pid);
    [PreserveSig] int CurrentControlType(out int type);
    [PreserveSig] int CurrentLocalizedControlType(out nint bstr);
    [PreserveSig] int CurrentName(out nint bstr);
    [PreserveSig] int CurrentAcceleratorKey(out nint bstr);
    [PreserveSig] int CurrentAccessKey(out nint bstr);
    [PreserveSig] int CurrentHasKeyboardFocus(out int on);
    [PreserveSig] int CurrentIsKeyboardFocusable(out int on);
    [PreserveSig] int CurrentIsEnabled(out int on);
    [PreserveSig] int CurrentAutomationId(out nint bstr);
    [PreserveSig] int CurrentClassName(out nint bstr);
    [PreserveSig] int CurrentHelpText(out nint bstr);
    [PreserveSig] int CurrentCulture(out int culture);
    [PreserveSig] int CurrentIsControlElement(out int on);
    [PreserveSig] int CurrentIsContentElement(out int on);
    [PreserveSig] int CurrentIsPassword(out int on);
    [PreserveSig] int CurrentNativeWindowHandle(out nint hwnd);
    [PreserveSig] int CurrentItemType(out nint bstr);
    [PreserveSig] int CurrentIsOffscreen(out int on);
}

[GeneratedComInterface, Guid("14314595-b4bc-4055-95f2-58f2e42c9855")]
partial interface IUIAutomationElementArray
{
    [PreserveSig] int Length(out int length);
    [PreserveSig] int GetElement(int index, out IUIAutomationElement element);
}

[GeneratedComInterface, Guid("a94cd8b1-0844-4cd6-9d2d-640537ab39e9")]
partial interface IUIAutomationValuePattern
{
    [PreserveSig] int SetValue(nint bstr);
    [PreserveSig] int CurrentValue(out nint bstr);
}

static class Uia
{
    static readonly Guid CLSID_CUIAutomation = new("ff48dba4-60ef-4201-aa87-54103eef594e");
    const int TreeScope_Descendants = 4, ValuePatternId = 10002;
    const int Button = 50000, Edit = 50004, Text = 50020, Document = 50030;
    const int MaxElements = 4000;
    static readonly StrategyBasedComWrappers Wrappers = new();

    static void Check(int hr) { if (hr < 0) Marshal.ThrowExceptionForHR(hr); }

    static string Bstr(nint b) { if (b == 0) return ""; try { return Marshal.PtrToStringBSTR(b); } finally { Marshal.FreeBSTR(b); } }

    static IUIAutomation Automation()
    {
        Check(Win32.CoCreateInstance(CLSID_CUIAutomation, 0, 1 /* CLSCTX_INPROC_SERVER */, typeof(IUIAutomation).GUID, out var ptr));
        try { return (IUIAutomation)Wrappers.GetOrCreateObjectForComInstance(ptr, CreateObjectFlags.None); } finally { Marshal.Release(ptr); }
    }

    /// <summary>Every on-screen element of a window, in tree order (capped).</summary>
    static List<IUIAutomationElement> All(nint hwnd)
    {
        var uia = Automation();
        Check(uia.ElementFromHandle(hwnd, out var root));
        Check(uia.CreateTrueCondition(out var all));
        try
        {
            Check(root.FindAll(TreeScope_Descendants, all, out var found));
            found.Length(out var n);
            var list = new List<IUIAutomationElement>(Math.Min(n, MaxElements));
            for (int i = 0; i < n && i < MaxElements; i++)
                if (found.GetElement(i, out var e) >= 0 && e.CurrentIsOffscreen(out var off) >= 0 && off == 0) list.Add(e);
            return list;
        }
        finally { Marshal.Release(all); }
    }

    static int TypeOf(IUIAutomationElement e) => e.CurrentControlType(out var t) >= 0 ? t : 0;
    static string NameOf(IUIAutomationElement e) => e.CurrentName(out var b) >= 0 ? Bstr(b) : "";

    /// <summary>The texts, buttons and input boxes a window shows: [{t: "text"|"button"|"input", n: name}].</summary>
    public static JsonArray Read(nint hwnd)
    {
        if (!Win32.IsWindow(hwnd)) throw new ArgumentException("that window is gone");
        var list = new JsonArray();
        foreach (var e in All(hwnd))
        {
            var kind = TypeOf(e) switch { Text => "text", Button => "button", Edit => "input", Document => Focusable(e) ? "input" : null, _ => null };
            if (kind == null) continue;
            var name = NameOf(e);
            if (kind != "input" && string.IsNullOrWhiteSpace(name)) continue;
            list.Add((JsonNode)new JsonObject { ["t"] = kind, ["n"] = name.Length > 4000 ? name[..4000] : name });
        }
        return list;
    }

    static bool Focusable(IUIAutomationElement e) => e.CurrentIsKeyboardFocusable(out var f) >= 0 && f != 0;

    /// <summary>
    /// Types text into the window's message box and presses Enter. Refuses when the box already holds a draft (it is
    /// never overwritten) or when the window no longer belongs to the expected process.
    /// </summary>
    public static bool Send(nint hwnd, uint pid, string text)
    {
        if (!Win32.IsWindow(hwnd)) throw new ArgumentException("that window is gone");
        Win32.GetWindowThreadProcessId(hwnd, out var owner);
        if (owner != pid) throw new ArgumentException("that window now belongs to another program");
        // the message box: the last focusable input (chat apps keep it at the bottom)
        var box = All(hwnd).LastOrDefault(e => TypeOf(e) is Edit or Document && Focusable(e)) ?? throw new InvalidOperationException("no message box found");
        if (Draft(box).Trim().Length > 0) throw new InvalidOperationException("there is a draft in the message box: reply not sent");
        Windows.Focus(hwnd, pid);
        Check(box.SetFocus());
        Thread.Sleep(120);
        Input.Type(text);
        Input.Key(Input.VK_RETURN);
        return true;
    }

    static string Draft(IUIAutomationElement box)
    {
        if (box.GetCurrentPatternAs(ValuePatternId, typeof(IUIAutomationValuePattern).GUID, out var ptr) < 0 || ptr == 0) return "";
        try
        {
            var vp = (IUIAutomationValuePattern)Wrappers.GetOrCreateObjectForComInstance(ptr, CreateObjectFlags.None);
            return vp.CurrentValue(out var b) >= 0 ? Bstr(b) : "";
        }
        finally { Marshal.Release(ptr); }
    }
}

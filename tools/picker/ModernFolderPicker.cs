using System;
using System.Runtime.InteropServices;

namespace LocalTeX.NativeDialogs
{
    public static class ModernFolderPicker
    {
        private const int CancelledHResult = unchecked((int)0x800704C7);
        private static readonly Guid ClientGuid = new Guid("F1402CB1-2B6D-49BC-AE31-5CE7E83D3321");

        [DllImport("user32.dll")]
        private static extern IntPtr GetForegroundWindow();

        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
        private static extern int SHCreateItemFromParsingName(
            [MarshalAs(UnmanagedType.LPWStr)] string path,
            IntPtr bindContext,
            ref Guid interfaceId,
            out IShellItem shellItem);

        public static string Pick(string title, string okButtonLabel)
        {
            IFileOpenDialog dialog = null;
            IShellItem defaultFolder = null;
            IShellItem result = null;
            IntPtr displayName = IntPtr.Zero;

            try
            {
                dialog = (IFileOpenDialog)new FileOpenDialogComObject();

                FileOpenOptions options;
                dialog.GetOptions(out options);
                dialog.SetOptions(
                    options |
                    FileOpenOptions.PickFolders |
                    FileOpenOptions.ForceFileSystem |
                    FileOpenOptions.PathMustExist |
                    FileOpenOptions.NoChangeDirectory);

                dialog.SetTitle(title);
                dialog.SetOkButtonLabel(okButtonLabel);

                Guid clientGuid = ClientGuid;
                dialog.SetClientGuid(ref clientGuid);

                string desktop = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                Guid shellItemGuid = typeof(IShellItem).GUID;
                if (!string.IsNullOrWhiteSpace(desktop) &&
                    SHCreateItemFromParsingName(desktop, IntPtr.Zero, ref shellItemGuid, out defaultFolder) >= 0)
                {
                    dialog.SetDefaultFolder(defaultFolder);
                }

                int resultCode = dialog.Show(GetForegroundWindow());
                if (resultCode == CancelledHResult)
                {
                    return null;
                }

                Marshal.ThrowExceptionForHR(resultCode);
                dialog.GetResult(out result);
                result.GetDisplayName(ShellItemDisplayName.FileSystemPath, out displayName);
                return Marshal.PtrToStringUni(displayName);
            }
            finally
            {
                if (displayName != IntPtr.Zero)
                {
                    Marshal.FreeCoTaskMem(displayName);
                }

                ReleaseComObject(result);
                ReleaseComObject(defaultFolder);
                ReleaseComObject(dialog);
            }
        }

        private static void ReleaseComObject(object value)
        {
            if (value != null && Marshal.IsComObject(value))
            {
                Marshal.FinalReleaseComObject(value);
            }
        }
    }

    [Flags]
    internal enum FileOpenOptions : uint
    {
        NoChangeDirectory = 0x00000008,
        PickFolders = 0x00000020,
        ForceFileSystem = 0x00000040,
        PathMustExist = 0x00000800
    }

    internal enum FileDialogAddPlace : uint
    {
        Bottom = 0,
        Top = 1
    }

    internal enum ShellItemDisplayName : uint
    {
        FileSystemPath = 0x80058000
    }

    [ComImport]
    [Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
    [ClassInterface(ClassInterfaceType.None)]
    internal class FileOpenDialogComObject
    {
    }

    [ComImport]
    [Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IShellItem
    {
        void BindToHandler(IntPtr bindContext, ref Guid handlerId, ref Guid interfaceId, out IntPtr result);
        void GetParent(out IShellItem parent);
        void GetDisplayName(ShellItemDisplayName displayName, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem shellItem, uint hint, out int order);
    }

    [ComImport]
    [Guid("42F85136-DB7E-439C-85F1-E4075D135FC8")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IFileDialog
    {
        [PreserveSig]
        int Show(IntPtr parent);

        void SetFileTypes(uint count, IntPtr filterSpecifications);
        void SetFileTypeIndex(uint fileTypeIndex);
        void GetFileTypeIndex(out uint fileTypeIndex);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(FileOpenOptions options);
        void GetOptions(out FileOpenOptions options);
        void SetDefaultFolder(IShellItem shellItem);
        void SetFolder(IShellItem shellItem);
        void GetFolder(out IShellItem shellItem);
        void GetCurrentSelection(out IShellItem shellItem);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string text);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem shellItem);
        void AddPlace(IShellItem shellItem, FileDialogAddPlace location);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }

    [ComImport]
    [Guid("D57C7288-D4AD-4768-BE02-9D969532D960")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface IFileOpenDialog : IFileDialog
    {
        void GetResults(out IntPtr shellItemArray);
        void GetSelectedItems(out IntPtr shellItemArray);
    }
}
